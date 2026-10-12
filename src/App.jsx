import { useState, useEffect, useMemo, useCallback, lazy, Suspense } from "react";
import GlobalStyle from "./components/GlobalStyle.jsx";
import TopNav from "./components/TopNav.jsx";
import ToastStack from "./components/ToastStack.jsx";
import PinPadModal from "./components/PinPadModal.jsx";
import CoversPicker from "./components/CoversPicker.jsx";

import FloorPlan from "./views/salle/FloorPlan.jsx";
import OrderTaking from "./views/salle/OrderTaking.jsx";
import CuisineShell from "./views/cuisine/CuisineShell.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";

import { RestoFlowContext } from "./context/RestoFlowContext.jsx";

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
  const [coversPrompt, setCoversPrompt] = useState(null); // { table, staff } : table libre en cours d'ouverture

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
  const [activeOrderId, setActiveOrderId] = useState(null); // Commande hors salle ouverte (emporter)

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
    setIsPinModalOpen(true);
  }, [pushToast]);

  useRealtimeSync(store, { pushToast, beep, soundOn, onAuthRequired: handleAuthRequired });

  const currentRole = roles.find((r) => r.id === currentStaff?.roleId);

  // Vérification et redirection stricte RBAC
  useEffect(() => {
    if (!currentStaff) {
      setIsPinModalOpen(true);
      return;
    }

    if (!canAccessTab(currentStaff, currentRole, role)) {
      setRole(getDefaultTabForStaff(currentStaff, currentRole));
    }
  }, [currentStaff, currentRole, role]);

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
    getActiveOrder, ensureOrderForTable, createOffPremiseOrder, addProductToOrder, addComposedMenuToOrder, changeQty, removeItem, voidItem,
    setItemNote, sendToKitchen, serveAndMaybeFree, handleApplyDiscount, handleRemoveDiscount, checkoutOrder, partialCheckout, cancelOffPremiseOrder, setOrderCovers, setBillRequested,
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

    if (!hasPermission(currentStaff, currentRole, "salle.order")) {
      pushToast("Accès refusé : vous n'avez pas l'autorisation de prendre des commandes", "warn");
      return;
    }

    // Table libre : on demande d'abord les couverts (ticket moyen par couvert au Z)
    if (!getActiveOrder(table.id)) {
      setCoversPrompt({ table, staff: currentStaff });
      return;
    }
    setActiveTableId(table.id);
    setServerView("commande");
  };

  const openTableWithCovers = (covers) => {
    const { table, staff } = coversPrompt;
    setCoversPrompt(null);
    setActiveTableId(table.id);
    ensureOrderForTable(table.id, staff, covers);
    setServerView("commande");
  };

  // Commande hors salle : existante (bandeau du plan) ou nouvelle (formulaire Emporter)
  const openOffPremise = (orderOrData) => {
    if (!currentStaff || !hasPermission(currentStaff, currentRole, "salle.order")) {
      pushToast("Accès refusé : vous n'avez pas l'autorisation de prendre des commandes", "warn");
      return;
    }
    const order = orderOrData.id ? orderOrData : createOffPremiseOrder(orderOrData);
    setActiveTableId(null);
    setActiveOrderId(order.id);
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

    const currentRoleObj = roles.find((r) => r.id === staffMember.roleId);
    const targetTab = getDefaultTabForStaff(staffMember, currentRoleObj);
    setRole(targetTab);
    setServerView("plan");
    setCuisineView("board");
    pushToast(`Connecté : ${staffMember.name}`, "server");

    if (pendingTableToOpen) {
      if (hasPermission(staffMember, currentRoleObj, "salle.order")) {
        if (getActiveOrder(pendingTableToOpen.id)) {
          setActiveTableId(pendingTableToOpen.id);
          setServerView("commande");
        } else {
          setCoversPrompt({ table: pendingTableToOpen, staff: staffMember });
        }
      } else {
        pushToast("Vous n'avez pas accès à la prise de commande", "warn");
      }
      setPendingTableToOpen(null);
    }
  };

  // La session serveur est liée au socket : oublier le jeton et reconnecter sans lui la révoque
  const handleLogout = () => {
    setSocketToken(null);
    setCurrentStaff(null);
    try {
      localStorage.removeItem("rf_active_staff");
    } catch {}
    setIsPinModalOpen(true);
  };

  const handleSeatReservationGuests = ({ reservation, table }) => {
    setReservations((prev) =>
      prev.map((r) => (r.id === reservation.id ? { ...r, status: "seated", tableId: table.id } : r))
    );
    emit("reservation:assign_table", { id: reservation.id, tableId: table.id });
    emit("reservation:update_status", { id: reservation.id, status: "seated" });

    setActiveTableId(table.id);
    ensureOrderForTable(table.id, null, reservation.guests || null);
    setRole("serveur");
    setServerView("commande");
    setIsReservationModalOpen(false);
    pushToast(`Table ${table.number} installée pour ${reservation.customerName} (${reservation.guests} pers.)`, "server");
  };

  // Rappel du Z : un ticket sans Z depuis plus de 20 h (le Z de la veille a été oublié)
  const canCloseZ = hasPermission(currentStaff, currentRole, "caisse.close");
  const zOverdueSince = useMemo(() => {
    if (!canCloseZ) return null;
    const oldest = Math.min(...history.filter((h) => !h.closedInZId).map((h) => new Date(h.createdAt).getTime()));
    // ponytail: évalué au rendu (pas de minuterie), suffisant car l'écran se rafraîchit à chaque action
    return Number.isFinite(oldest) && Date.now() - oldest > 20 * 3600 * 1000 ? oldest : null;
  }, [history, canCloseZ]);

  // ── Rendu ──────────────────────────────────────────────────
  const activeTable = tables.find((t) => t.id === activeTableId);
  const activeOrder = activeTable
    ? getActiveOrder(activeTable.id)
    : orders.find((o) => o.id === activeOrderId) || null;
  // Cible des ajouts : la table (commande créée à la volée) ou la commande hors salle
  const orderTarget = activeTable ? activeTable.id : activeOrder;

  const handleSetRole = (r) => {
    if (!canAccessTab(currentStaff, currentRole, r)) {
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

  // Ni cache local ni réponse du serveur : rien à afficher (aucune donnée de démo côté client)
  if (!store.ready) {
    return (
      <div ref={rootRef} className="rf-root w-full min-h-[720px] flex flex-col items-center justify-center gap-3 p-8 text-center bg-[#FAF6EE] text-[#6B6355]">
        <GlobalStyle />
        <div className="w-8 h-8 border-3 border-[#C1440E] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-semibold">Connexion au serveur…</p>
        <p className="text-xs max-w-sm">Lors de sa première utilisation, ce terminal doit joindre le serveur du restaurant une fois avant de pouvoir fonctionner hors-ligne.</p>
      </div>
    );
  }

  return (
    <RestoFlowContext value={contextValue}>
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

      {zOverdueSince && role !== "cuisine" && (
        <div className="px-4 py-2 bg-amber-100 border-b border-amber-300 text-amber-900 text-sm font-semibold flex items-center justify-between gap-3">
          <span>⚠️ Rapport Z non effectué : ventes en attente depuis le {new Date(zOverdueSince).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}.</span>
          <button type="button" onClick={() => handleSetRole("gestion")} className="rf-tap px-3 py-1 rounded-lg bg-amber-900 text-amber-50 text-xs">
            Faire le Z
          </button>
        </div>
      )}

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

      <CoversPicker table={coversPrompt?.table} onPick={openTableWithCovers} onClose={() => setCoversPrompt(null)} />

      {/* ── Vue Salle ── */}
      {role === "serveur" && serverView === "plan" && (
        <ErrorBoundary label="Plan de salle">
          <FloorPlan
            tables={tables}
            orders={orders}
            reservations={reservations}
            onOpen={openTable}
            onOpenOffPremise={openOffPremise}
            onToggleAlert={toggleAlert}
            onOpenReservations={() => setIsReservationModalOpen(true)}
            onOpenTableAction={(mode, table) => setTableActionModal({ mode, sourceTable: table })}
            isMobile={isMobile}
          />
        </ErrorBoundary>
      )}
      {/* Hors salle : l'écran reste monté une fois la commande encaissée, le temps d'afficher le ticket */}
      {role === "serveur" && serverView === "commande" && (activeTable || activeOrderId) && (
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
            onAdd={(p, optionPicks) => addProductToOrder(orderTarget, p, optionPicks)}
            onAddComposedMenu={(menuProduct, composition) => addComposedMenuToOrder(orderTarget, menuProduct, composition)}
            onQty={(itemId, d) => changeQty(activeOrder.id, itemId, d)}
            onRemove={(itemId) => removeItem(activeOrder.id, itemId)}
            onVoid={(itemId, qty, reason, done) => voidItem(activeOrder.id, itemId, qty, reason, done)}
            onNote={(itemId, n) => setItemNote(activeOrder.id, itemId, n)}
            onSetCovers={(n) => setOrderCovers(activeOrder.id, n)}
            onRequestBill={(requested) => setBillRequested(activeOrder.id, requested)}
            onSend={() => sendToKitchen(activeOrder.id)}
            onServe={() => serveAndMaybeFree(activeOrder.id)}
            onApplyDiscount={(orderId, disc) => handleApplyDiscount(orderId, disc)}
            onRemoveDiscount={(orderId) => handleRemoveDiscount(orderId)}
            onCheckout={(method, payments, meta) => checkoutOrder(activeOrder.id, method, payments, meta)}
            onPartialCheckout={(lines, payments, amount, print) => partialCheckout(activeOrder.id, lines, payments, amount, print)}
            onCancelOrder={() => {
              cancelOffPremiseOrder(activeOrder.id);
              setServerView("plan");
            }}
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
            onToggleProductAvailable={
              ["cuisine.status", "gestion.tables", "gestion.products"].some((p) =>
                hasPermission(currentStaff, currentRole, p)
              )
                ? management.onToggleProductAvailable
                : null
            }
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
    </RestoFlowContext>
  );
}
