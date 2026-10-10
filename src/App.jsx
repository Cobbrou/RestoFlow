import { useState, useEffect, useMemo, useCallback, lazy, Suspense } from "react";
import GlobalStyle from "./components/GlobalStyle.jsx";
import TopNav from "./components/TopNav.jsx";
import ToastStack from "./components/ToastStack.jsx";
import PinPadModal from "./components/PinPadModal.jsx";

import FloorPlan from "./views/salle/FloorPlan.jsx";
import OrderTaking from "./views/salle/OrderTaking.jsx";
import CuisineShell from "./views/cuisine/CuisineShell.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";

import { RestoFlowProvider } from "./context/RestoFlowContext.jsx";

// ⚛️ Code Splitting (Axe 3) : Chargement à la demande des modules secondaires
const Dashboard = lazy(() => import("./views/gestion/Dashboard.jsx"));
const Gestion = lazy(() => import("./views/gestion/Gestion.jsx"));
const ReservationModal = lazy(() => import("./components/ReservationModal.jsx"));
const TableActionModal = lazy(() => import("./components/TableActionModal.jsx"));

function ViewFallback() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-12 text-[#6B6355]">
      <div className="w-8 h-8 border-3 border-[#C1440E] border-t-transparent rounded-full animate-spin mb-3" />
      <p className="text-xs font-semibold">Chargement du module...</p>
    </div>
  );
}

import { uid } from "./data/seed.js";
import { menuToProduct } from "./utils/index.js";
import { useBeep, useContainerWidth, DEFAULT_MODULES_CONFIG } from "./hooks/index.js";
import { useRestoState } from "./hooks/useRestoState.js";
import { useRealtimeSync } from "./hooks/useRealtimeSync.js";
import { useManagementActions } from "./hooks/useManagementActions.js";
import { useOrderActions } from "./hooks/useOrderActions.js";
import { setSocketToken, clearSessionToken } from "./services/socket.js";
import { emitOrQueue } from "./services/emitOrQueue.js";
import { canAccessTab, getDefaultTabForStaff, hasPermission } from "./utils/permissions.js";
import PwaInstallPrompt from "./components/PwaInstallPrompt.jsx";
import { saveCachedAuth } from "./services/db.js";

/**
 * App — Composant racine de RestoFlow.
 *
 * Gère l'état global de l'application synchronisé en temps réel via Socket.IO :
 *  - tables, orders, history, products, menus, staff, roles, config, reservations
 *  - synchronisation multi-postes (Salle, Cuisine KDS, Dashboard, Gestion)
 *  - buffer offline avec reconnexion automatique
 *  - authentification obligatoire par profil + code PIN individuel dès l'ouverture
 *  - application stricte des permissions RBAC (contrôle d'accès par rôle)
 */
export default function App() {
  const [rootRef, containerWidth] = useContainerWidth();
  const isMobile = containerWidth < 640;

  // ── État principal (collections synchronisées) ─────────────
  const store = useRestoState();
  const {
    tables, orders, reservations, setReservations, history,
    products, menus, staff, roles, ingredients, recipes, stockMovements, closings, config, requestSync,
  } = store;

  // ── Modales Phase 4 (Réservations & Transfert / Fusion) ─────
  const [isReservationModalOpen, setIsReservationModalOpen] = useState(false);
  const [tableActionModal, setTableActionModal] = useState(null); // { mode: "transfer" | "merge", sourceTable } | null

  // ── Table active & Équipier authentifié ─────────────────────
  const [currentStaff, setCurrentStaff] = useState(() => {
    try {
      const saved = localStorage.getItem("rf_active_staff");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [isPinModalOpen, setIsPinModalOpen] = useState(() => {
    try {
      return !localStorage.getItem("rf_active_staff");
    } catch {
      return true;
    }
  });

  const [pendingTableToOpen, setPendingTableToOpen] = useState(null);

  // ── Navigation basée sur les droits ────────────────────────
  const [role, setRole] = useState(() => {
    try {
      const savedStaff = localStorage.getItem("rf_active_staff");
      if (savedStaff) {
        const parsed = JSON.parse(savedStaff);
        return getDefaultTabForStaff(parsed, null);
      }
    } catch {}
    return "serveur";
  });

  const [serverView,  setServerView]  = useState("plan");      // plan | commande
  const [cuisineView, setCuisineView] = useState("board");     // board | table
  const [gestionView, setGestionView] = useState("tables");    // tables | produits | menus | historique | equipe
  const [activeTableId, setActiveTableId] = useState(null);

  // ── Horloge + sons + toasts ───────────────────────────────
  const [toasts, setToasts]   = useState([]);
  const [soundOn, setSoundOn] = useState(true);
  const beep     = useBeep();

  // Produits + menus combinés (affiché dans la prise de commande)
  const combinedProducts = useMemo(
    () => [...products, ...menus.map((m) => menuToProduct(m, products))],
    [products, menus]
  );

  // ── Utilitaires toasts ─────────────────────────────────────
  const pushToast = useCallback((text, kind) => {
    const id = uid("toast");
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000);
  }, []);

  // Session absente/expirée côté serveur : retour à l'écran PIN
  const handleAuthRequired = useCallback(() => {
    clearSessionToken();
    setCurrentStaff((prev) => {
      if (prev) pushToast("Session expirée : veuillez saisir à nouveau votre code PIN", "warn");
      return null;
    });
    try {
      localStorage.removeItem("rf_active_staff");
    } catch {}
    saveCachedAuth(null);
    setIsPinModalOpen(true);
  }, [pushToast]);

  useRealtimeSync(store, { pushToast, beep, soundOn, onAuthRequired: handleAuthRequired });

  // Vérification et redirection stricte RBAC
  useEffect(() => {
    if (!currentStaff) {
      setIsPinModalOpen(true);
      return;
    }

    const currentRoleObj = roles.find((r) => r.id === currentStaff.roleId);
    if (!canAccessTab(currentStaff, currentRoleObj, role)) {
      const defaultTab = getDefaultTabForStaff(currentStaff, currentRoleObj);
      setRole(defaultTab);
    }
  }, [currentStaff, roles, role]);

  // Émission avec repli hors-ligne ; refus serveur => toast puis réconciliation avec la base
  const emit = (eventType, payload, onAck) =>
    emitOrQueue(eventType, payload, {
      onAck,
      onRejected: (response) => {
        pushToast(response.error || "Une erreur est survenue sur le serveur", "warn");
        requestSync();
      },
    });

  const management = useManagementActions(store, { emit, pushToast, currentStaff });

  const {
    getActiveOrder, ensureOrderForTable, addProductToOrder, addComposedMenuToOrder, changeQty, removeItem,
    setItemNote, sendToKitchen, serveAndMaybeFree, handleApplyDiscount, handleRemoveDiscount, checkoutOrder,
    toggleAlert, startPrep, markReady, handleCallCourse, handleChangeItemCourse, handleTransferTable,
    handleMergeTable, handleCreateReservation, handleUpdateReservationStatus, handleAssignReservationTable,
    handleDeleteReservation,
  } = useOrderActions(store, {
    emit, pushToast, beep, soundOn, currentStaff, activeTableId, setActiveTableId, setServerView,
  });

  // ── Actions Salle & Authentification ───────────────────────
  const openTable = (table) => {
    if (!currentStaff) {
      setPendingTableToOpen(table);
      setIsPinModalOpen(true);
      return;
    }

    const currentRoleObj = roles.find((r) => r.id === currentStaff.roleId);
    if (!hasPermission(currentStaff, currentRoleObj, "salle.order")) {
      pushToast("Accès refusé : vous n'avez pas l'autorisation de prendre des commandes", "warn");
      return;
    }

    setActiveTableId(table.id);
    ensureOrderForTable(table.id);
    setServerView("commande");
  };

  const handleStaffPinSuccess = (staffMember, token) => {
    setCurrentStaff(staffMember);
    setIsPinModalOpen(false);
    setPendingTableToOpen(null);
    if (token) {
      setSocketToken(token);
    }
    try {
      localStorage.setItem("rf_active_staff", JSON.stringify(staffMember));
    } catch {}
    saveCachedAuth(staffMember);

    const currentRoleObj = roles.find((r) => r.id === staffMember.roleId);
    const targetTab = getDefaultTabForStaff(staffMember, currentRoleObj);
    setRole(targetTab);
    setServerView("plan");
    setCuisineView("board");
    pushToast(`Connecté : ${staffMember.name}`, "server");

    if (pendingTableToOpen) {
      if (hasPermission(staffMember, currentRoleObj, "salle.order")) {
        setActiveTableId(pendingTableToOpen.id);
        ensureOrderForTable(pendingTableToOpen.id, staffMember);
        setServerView("commande");
      } else {
        pushToast("Vous n'avez pas accès à la prise de commande", "warn");
      }
      setPendingTableToOpen(null);
    }
  };

  const handleLogout = () => {
    setCurrentStaff(null);
    try {
      localStorage.removeItem("rf_active_staff");
    } catch {}
    saveCachedAuth(null);
    setIsPinModalOpen(true);
  };

  const handleSeatReservationGuests = ({ reservation, table }) => {
    setReservations((prev) =>
      prev.map((r) => (r.id === reservation.id ? { ...r, status: "seated", tableId: table.id } : r))
    );
    emit("reservation:assign_table", { id: reservation.id, tableId: table.id });
    emit("reservation:update_status", { id: reservation.id, status: "seated" });

    setActiveTableId(table.id);
    ensureOrderForTable(table.id);
    setRole("serveur");
    setServerView("commande");
    setIsReservationModalOpen(false);
    pushToast(`Table ${table.number} installée pour ${reservation.customerName} (${reservation.guests} pers.)`, "server");
  };

  // ── Rendu ──────────────────────────────────────────────────
  const activeTable = tables.find((t) => t.id === activeTableId);
  const activeOrder = activeTable ? getActiveOrder(activeTable.id) : null;

  const handleSetRole = (r) => {
    const currentRoleObj = roles.find((roleItem) => roleItem.id === currentStaff?.roleId);
    if (!canAccessTab(currentStaff, currentRoleObj, r)) {
      pushToast("Vous n'avez pas accès à ce poste de travail", "warn");
      return;
    }
    setRole(r);
    setServerView("plan");
    setCuisineView("board");
  };

  // Recréé à chaque rendu (les handlers le sont aussi) : un useMemo n'apporterait rien ici
  const contextValue = {
    tables,
    orders,
    products,
    menus,
    ingredients,
    recipes,
    stockMovements,
    history,
    closings,
    staff,
    roles,
    config,
    reservations,
    currentStaff,
    role,
    gestionView,
    pushToast,
    modulesConfig: config?.modulesConfig || DEFAULT_MODULES_CONFIG,
    ...management,
  };

  return (
    <RestoFlowProvider value={contextValue}>
      <div
      ref={rootRef}
      className="rf-root w-full min-h-[720px] rounded-2xl overflow-hidden border border-black/10 shadow-xl"
      style={{ background: role === "cuisine" ? "#14110D" : "#FAF6EE" }}
    >
      <GlobalStyle />
      <TopNav
        role={role}
        setRole={handleSetRole}
        soundOn={soundOn}
        setSoundOn={setSoundOn}
        isMobile={isMobile}
        currentStaff={currentStaff}
        roles={roles}
        onOpenPinModal={() => setIsPinModalOpen(true)}
        onLogout={handleLogout}
      />
      <ToastStack toasts={toasts} />

      {/* Clavier PIN tactile d'authentification */}
      <PinPadModal
        isOpen={isPinModalOpen}
        onClose={() => {
          setIsPinModalOpen(false);
          setPendingTableToOpen(null);
        }}
        onSuccess={handleStaffPinSuccess}
        staffList={staff}
        roles={roles}
        mandatory={!currentStaff}
        title={!currentStaff ? "Connexion à RestoFlow" : "Changer d'équipier"}
        subtitle={
          !currentStaff
            ? "Sélectionnez votre profil équipier pour commencer le service"
            : "Sélectionnez un autre profil équipier et tapez son code PIN"
        }
      />

      {/* ── Vue Salle ── */}
      {role === "serveur" && serverView === "plan" && (
        <ErrorBoundary label="Plan de salle">
          <FloorPlan
            tables={tables}
            orders={orders}
            reservations={reservations}
            onOpen={openTable}
            onToggleAlert={toggleAlert}
            onOpenReservations={() => setIsReservationModalOpen(true)}
            onOpenTableAction={(mode, table) => setTableActionModal({ mode, sourceTable: table })}
            isMobile={isMobile}
          />
        </ErrorBoundary>
      )}
      {role === "serveur" && serverView === "commande" && activeTable && (
        <ErrorBoundary label="Prise de commande">
          <OrderTaking
            table={activeTable}
            order={activeOrder}
            products={combinedProducts}
            recipes={recipes}
            ingredients={ingredients}
            config={config}
            tables={tables}
            orders={orders}
            isMobile={isMobile}
            currentStaff={currentStaff}
            roles={roles}
            onToggleProductAvailable={management.onToggleProductAvailable}
            onBack={() => setServerView("plan")}
            onAdd={(p) => addProductToOrder(activeTable.id, p)}
            onAddComposedMenu={(menuProduct, composition) => addComposedMenuToOrder(activeTable.id, menuProduct, composition)}
            onQty={(itemId, d) => changeQty(activeOrder.id, itemId, d)}
            onRemove={(itemId) => removeItem(activeOrder.id, itemId)}
            onNote={(itemId, n) => setItemNote(activeOrder.id, itemId, n)}
            onSend={() => sendToKitchen(activeOrder.id)}
            onServe={() => serveAndMaybeFree(activeOrder.id)}
            onApplyDiscount={(orderId, disc) => handleApplyDiscount(orderId, disc)}
            onRemoveDiscount={(orderId) => handleRemoveDiscount(orderId)}
            onCheckout={(method, payments, meta) => checkoutOrder(activeOrder.id, method, payments, meta)}
            onBackToPlan={() => setServerView("plan")}
            onCallCourse={(courseOrOrderId, maybeCourse) => {
              const course = maybeCourse || courseOrOrderId;
              handleCallCourse(activeOrder.id, course);
            }}
            onChangeItemCourse={(itemId, course) => handleChangeItemCourse(activeOrder.id, itemId, course)}
            onTransferTable={(fromId, toId) => handleTransferTable(fromId, toId)}
            onMergeTable={(fromId, toId) => handleMergeTable(fromId, toId)}
          />
        </ErrorBoundary>
      )}

      {/* ── Vue Cuisine ── */}
      {role === "cuisine" && (
        <ErrorBoundary label="Cuisine KDS">
          <CuisineShell
            view={cuisineView}
            setView={setCuisineView}
            tables={tables}
            orders={orders}
            products={combinedProducts}
            config={config}
            onStart={startPrep}
            onReady={markReady}
          />
        </ErrorBoundary>
      )}

      {/* ── Dashboard (Lazy Loaded) ── */}
      {role === "dashboard" && (
        <ErrorBoundary label="Dashboard">
          <Suspense fallback={<ViewFallback />}>
            <Dashboard history={history} orders={orders} tables={tables} />
          </Suspense>
        </ErrorBoundary>
      )}

      {/* ── Gestion (Lazy Loaded & Sans Prop Drilling) ── */}
      {role === "gestion" && (
        <ErrorBoundary label="Gestion">
          <Suspense fallback={<ViewFallback />}>
            <Gestion
              view={gestionView}
              setView={setGestionView}
              closings={closings}
              onProcessZ={management.onProcessZ}
            />
          </Suspense>
        </ErrorBoundary>
      )}

      {/* ── Modale Gestion des Réservations & Widget (Phase 4) ── */}
      {isReservationModalOpen && (
        <Suspense fallback={null}>
          <ReservationModal
            isOpen={isReservationModalOpen}
            onClose={() => setIsReservationModalOpen(false)}
            reservations={reservations}
            tables={tables}
            orders={orders}
            onCreateReservation={handleCreateReservation}
            onUpdateStatus={handleUpdateReservationStatus}
            onAssignTable={handleAssignReservationTable}
            onDeleteReservation={handleDeleteReservation}
            onSeatGuests={handleSeatReservationGuests}
          />
        </Suspense>
      )}

      {/* ── Modale Fusion & Transfert de tables (Phase 4) ── */}
      {tableActionModal && (
        <Suspense fallback={null}>
          <TableActionModal
            isOpen={Boolean(tableActionModal)}
            onClose={() => setTableActionModal(null)}
            initialMode={tableActionModal.mode || "transfer"}
            sourceTable={tableActionModal.sourceTable}
            tables={tables}
            orders={orders}
            onTransfer={handleTransferTable}
            onMerge={handleMergeTable}
          />
        </Suspense>
      )}

      {/* ── Notification PWA & Invitation à l'installation ── */}
      <PwaInstallPrompt />
      </div>
    </RestoFlowProvider>
  );
}
