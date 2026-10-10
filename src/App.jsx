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
import { menuToProduct, getProductEffectivePrice } from "./utils/index.js";
import { useBeep, useContainerWidth, DEFAULT_MODULES_CONFIG } from "./hooks/index.js";
import { useRestoState } from "./hooks/useRestoState.js";
import { useRealtimeSync } from "./hooks/useRealtimeSync.js";
import { getSocket, setSocketToken, clearSessionToken } from "./services/socket.js";
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
    tables, setTables, orders, setOrders, reservations, setReservations, history, setHistory,
    products, setProducts, menus, setMenus, staff, setStaff, roles, setRoles,
    ingredients, setIngredients, recipes, setRecipes, stockMovements, setStockMovements,
    closings, config, setConfig, requestSync,
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

  const getActiveOrder = useCallback(
    (tableId) => orders.find((o) => o.tableId === tableId),
    [orders]
  );

  const updateOrder = (orderId, fn) => {
    setOrders((prev) => prev.map((o) => (o.id === orderId ? fn(o) : o)));
  };

  const ensureOrderForTable = useCallback(
    (tableId, overrideStaff = null) => {
      let order = getActiveOrder(tableId);
      if (!order) {
        const staffObj = overrideStaff || currentStaff;
        const serverName = staffObj ? staffObj.name.split(" ")[0] : "Service";
        order = {
          id: uid("ord"),
          tableId,
          server: serverName,
          createdAt: Date.now(),
          items: [],
        };
        setOrders((prev) => [...prev, order]);
        emit("order:create_or_ensure", { orderId: order.id, tableId, server: serverName });
      }
      return order;
    },
    [getActiveOrder, currentStaff]
  );

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

  const getItemCourseAndStation = (product) => {
    const cat = product?.cat || "";
    const isBar =
      cat === "boissons" ||
      product?.station === "bar";
    const station = isBar ? "bar" : (product?.station || "kitchen");
    let course = "plat";
    if (isBar) {
      course = "boisson";
    } else if (cat === "entrees") {
      course = "entree";
    } else if (cat === "desserts") {
      course = "dessert";
    } else {
      course = "plat";
    }
    const courseStatus = (course === "entree" || course === "boisson" || course === "direct") ? "direct" : "held";
    return { course, courseStatus, station, cat };
  };

  const addProductToOrder = (tableId, product) => {
    const order = ensureOrderForTable(tableId);
    const { course, courseStatus, station, cat } = getItemCourseAndStation(product);
    const effectivePrice = getProductEffectivePrice(product, config);
    // Nouvelle ligne : son id est partagé avec le serveur (les actions hors-ligne suivantes le référencent)
    const lineId = uid("it");
    const mergesIntoExisting = order.items.some(
      (i) => i.productId === product.id && i.status === "draft" && !i.notes && (i.course || course) === course && i.price === effectivePrice
    );

    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== order.id) return o;
        const existing = o.items.find(
          (i) => i.productId === product.id && i.status === "draft" && !i.notes && (i.course || course) === course && i.price === effectivePrice
        );
        if (existing) {
          return { ...o, items: o.items.map((i) => i.id === existing.id ? { ...i, qty: i.qty + 1 } : i) };
        }
        return {
          ...o,
          items: [
            ...o.items,
            {
              id: lineId,
              productId: product.id,
              name: product.name,
              price: effectivePrice,
              vatRate: product.vatRate ?? 10,
              qty: 1,
              notes: "",
              status: "draft",
              course,
              courseStatus,
              station,
            },
          ],
        };
      })
    );

    emit("order:add_item", {
      orderId: order.id,
      tableId,
      itemId: mergesIntoExisting ? undefined : lineId,
      product: { id: product.id, name: product.name, price: effectivePrice, cat, station, isMenu: false },
      course,
      courseStatus,
      station,
      addedAt: Date.now(), // le serveur fixe le prix (Happy Hour) à l'heure de l'ajout, même rejoué hors-ligne
    });
  };

  const addComposedMenuToOrder = (tableId, menuProduct, composition) => {
    const order = ensureOrderForTable(tableId);
    const course = "plat";
    const courseStatus = "held";
    const station = "kitchen";
    const lineId = uid("it");

    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== order.id) return o;
        return {
          ...o,
          items: [
            ...o.items,
            {
              id: lineId,
              productId: menuProduct.id,
              name: menuProduct.name,
              price: menuProduct.price,
              vatRate: 10,
              qty: 1,
              notes: "",
              status: "draft",
              isMenu: true,
              composition,
              course,
              courseStatus,
              station,
            },
          ],
        };
      })
    );

    emit("order:add_item", {
      orderId: order.id,
      tableId,
      itemId: lineId,
      product: { id: menuProduct.id, name: menuProduct.name, price: menuProduct.price, cat: "menus", station: "kitchen", isMenu: true },
      composition,
      course,
      courseStatus,
      station,
      addedAt: Date.now(),
    });
  };

  const changeQty = (orderId, itemId, delta) => {
    updateOrder(orderId, (o) => ({
      ...o,
      items: o.items.flatMap((i) => {
        if (i.id !== itemId) return [i];
        const q = i.qty + delta;
        return q <= 0 ? [] : [{ ...i, qty: q }];
      }),
    }));

    emit("order:change_qty", { orderId, itemId, delta });
  };

  const removeItem = (orderId, itemId) => {
    updateOrder(orderId, (o) => ({ ...o, items: o.items.filter((i) => i.id !== itemId) }));
    emit("order:remove_item", { orderId, itemId });
  };

  const setItemNote = (orderId, itemId, note) => {
    updateOrder(orderId, (o) => ({
      ...o,
      items: o.items.map((i) => (i.id === itemId ? { ...i, notes: note } : i)),
    }));
    emit("order:set_note", { orderId, itemId, note });
  };

  const sendToKitchen = (orderId) => {
    const serverName = currentStaff ? currentStaff.name.split(" ")[0] : "Service";
    updateOrder(orderId, (o) => ({
      ...o,
      sentAt: Date.now(),
      server: serverName,
      items: o.items.map((i) => (i.status === "draft" ? { ...i, status: "new" } : i)),
    }));
    setServerView("plan");
    emit("order:send_kitchen", { orderId, serverName });
  };

  const serveAndMaybeFree = (orderId, targetCourse = null) => {
    updateOrder(orderId, (o) => ({
      ...o,
      items: o.items.map((i) => {
        if (i.status !== "ready") return i;
        if (targetCourse && i.course !== targetCourse) return i;
        return { ...i, status: "served" };
      }),
    }));
    emit("order:serve", { orderId, course: targetCourse });
  };

  const handleApplyDiscount = (orderId, discount) => {
    updateOrder(orderId, (o) => ({ ...o, discount }));
    emit("order:discount:apply", { orderId, discount });
  };

  const handleRemoveDiscount = (orderId) => {
    updateOrder(orderId, (o) => ({ ...o, discount: null }));
    emit("order:discount:remove", { orderId });
  };

  const handleUpdateConfig = (newConfig) => {
    setConfig(newConfig);
    emit("config:update", newConfig);
    pushToast("Configuration de la caisse mise à jour", "server");
  };

  const handleUpdateModules = (newModules) => {
    setConfig((prev) => ({
      ...prev,
      modulesConfig: newModules,
    }));
    emit("config:update_modules", { modules: newModules });
    pushToast("Configuration des modules mise à jour", "server");
  };

  const handleProcessZ = (payload) => {
    return new Promise((resolve, reject) => {
      const socket = getSocket();
      if (socket && socket.connected) {
        socket.emit("closing:process_z", payload, (res) => {
          if (res && res.ok) {
            pushToast(`✅ Clôture ${res.closing?.reportNumber || "Z"} validée avec succès`, "server");
            resolve(res);
          } else {
            pushToast(`❌ Erreur lors du Z : ${res?.error || "Inconnue"}`, "warn");
            reject(new Error(res?.error || "Erreur Z"));
          }
        });
      } else {
        pushToast("Clôture Z impossible hors-ligne : reconnectez la caisse au serveur", "warn");
        reject(new Error("offline"));
      }
    });
  };

  /**
   * Encaissement : archive dans l'historique, libère la table et synchronise.
   */
  const checkoutOrder = (orderId, paymentMethod, payments = null, meta = {}) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return null;
    const table    = tables.find((t) => t.id === order.tableId);
    const paidItems = order.items.filter((i) => i.status !== "draft");
    const subtotal = meta?.subtotal ?? paidItems.reduce((s, i) => s + (i.price || 0) * (i.qty || 1), 0);
    const discount = meta?.discount ?? order.discount ?? null;
    const total = meta?.total ?? paidItems.reduce((s, i) => s + (i.price || 0) * (i.qty || 1), 0);
    const vatDetails = meta?.vatDetails ?? null;
    const tpeData = meta?.tpeData ?? null;
    const paidAt   = Date.now();
    const serverName = currentStaff ? currentStaff.name.split(" ")[0] : order.server;

    const paymentList = payments && payments.length > 0 ? payments : [
      { id: uid("pay"), label: "Paiement unique", amount: total, method: paymentMethod, paidAt, tpeData },
    ];

    const finalMethod = paymentMethod || (paymentList.length > 1 ? "partage" : paymentList[0]?.method || "carte");

    // Numéro provisoire : le numéro de facture définitif est attribué par le serveur (history:new_entry)
    const ticketNumber = `PROV-${order.id}`;

    const receipt = {
      id: uid("rcpt"),
      ticketNumber,
      orderId:       order.id,
      tableNumber:   table?.number,
      server:        serverName,
      items:         paidItems,
      subtotal,
      discount,
      vatDetails,
      tpeData,
      total,
      tip: Number(meta?.tip || 0),
      paymentMethod: finalMethod,
      payments:      paymentList,
      paidAt,
    };

    setHistory((prev) => [
      {
        id: uid("hist"),
        ticketNumber,
        createdAt: paidAt,
        server: serverName,
        items: paidItems,
        subtotal,
        discount,
        vatDetails,
        total,
        tip: Number(meta?.tip || 0),
        tableNumber: table?.number,
        paymentMethod: finalMethod,
        payments: paymentList,
        orderId: order.id,
      },
      ...prev,
    ]);

    setOrders((prev) => prev.filter((o) => o.id !== orderId));
    setTables((prev) =>
      prev.map((t) =>
        t.id === order.tableId
          ? {
              ...t,
              alert: false,
              reserved: false,
              reservationName: "",
              reservationPeople: "",
              reservationTime: "",
              reservationNote: "",
            }
          : t
      )
    );

    // Montants, remise, TVA et numéro de ticket sont recalculés par le serveur
    emit("order:checkout", {
      orderId,
      paymentMethod: finalMethod,
      payments: paymentList,
      tip: Number(meta?.tip || 0),
    });

    return receipt;
  };

  const toggleAlert = (tableId) => {
    setTables((prev) => prev.map((t) => (t.id === tableId ? { ...t, alert: !t.alert } : t)));
    emit("tables:toggle_alert", { tableId });
  };

  // ── Actions Cuisine (Phase 4 multi-postes) ──────────────────
  const startPrep = (orderId, station = "all") => {
    updateOrder(orderId, (o) => ({
      ...o,
      items: o.items.map((i) => {
        if (i.status !== "new") return i;
        if (i.courseStatus === "held") return i; // Ne pas démarrer les articles en attente de réclame
        if (station !== "all") {
          const isBar = i.station === "bar";
          if (station === "bar" && !isBar) return i;
          if (station === "kitchen" && isBar) return i;
        }
        return { ...i, status: "preparing" };
      }),
    }));
    emit("order:start_prep", { orderId, station });
  };

  const markReady = (orderId, station = "all") => {
    let tableNum = null;
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== orderId) return o;
        const t = tables.find((tt) => tt.id === o.tableId);
        tableNum = t?.number;
        return {
          ...o,
          items: o.items.map((i) => {
            if (i.status !== "preparing") return i;
            if (i.courseStatus === "held") return i; // Les articles en attente ne peuvent pas être prêts
            if (station !== "all") {
              const isBar = i.station === "bar";
              if (station === "bar" && !isBar) return i;
              if (station === "kitchen" && isBar) return i;
            }
            return { ...i, status: "ready" };
          }),
        };
      })
    );
    if (tableNum) {
      const stationSuffix = station === "bar" ? " (Bar)" : station === "kitchen" ? " (Cuisine)" : "";
      pushToast(`🔔 Commande de la Table ${tableNum} prête${stationSuffix}`, "server");
      if (soundOn) beep(980);
    }
    emit("order:mark_ready", { orderId, station });
  };

  // ── Actions Phase 4 : Suites & Réclame ──────────────────────
  const handleCallCourse = (orderId, course) => {
    const order = orders.find((o) => o.id === orderId);
    const table = tables.find((t) => t.id === order?.tableId);
    const serverName = currentStaff ? currentStaff.name.split(" ")[0] : order?.server || "Service";

    updateOrder(orderId, (o) => ({
      ...o,
      items: o.items.map((i) => {
        if ((course === "suite" || i.course === course) && i.courseStatus === "held") {
          return { ...i, courseStatus: "called", status: "new" };
        }
        return i;
      }),
    }));

    emit("order:call_course", { orderId, course, serverName, server: serverName });
    const courseLabels = { entree: "Entrées", plat: "Plats", dessert: "Desserts", boisson: "Boissons", direct: "Direct", suite: "Suite" };
    pushToast(`🔔 Réclame transmise en cuisine pour Table ${table?.number || ""} : ${courseLabels[course] || course}`, "server");
    if (soundOn) beep(840);
  };

  const handleChangeItemCourse = (orderId, itemId, course) => {
    const defaultHeld = course === "plat" || course === "dessert";
    updateOrder(orderId, (o) => ({
      ...o,
      items: o.items.map((i) => (i.id === itemId ? { ...i, course, courseStatus: defaultHeld ? "held" : "direct" } : i)),
    }));
    emit("order:change_item_course", { orderId, itemId, course });
  };

  // ── Actions Phase 4 : Transfert & Fusion de tables ─────────
  const handleTransferTable = (sourceTableId, targetTableId) => {
    const sourceT = tables.find((t) => t.id === sourceTableId);
    const targetT = tables.find((t) => t.id === targetTableId);

    // Snapshot pour rollback en cas de rejet serveur (Axe 3)
    const prevOrders = orders;
    const prevReservations = reservations;
    const prevActiveTableId = activeTableId;

    setOrders((prev) =>
      prev.map((o) => (o.tableId === sourceTableId ? { ...o, tableId: targetTableId } : o))
    );
    setReservations((prev) =>
      prev.map((r) => (r.tableId === sourceTableId ? { ...r, tableId: targetTableId } : r))
    );

    const socket = getSocket();
    if (!socket || !socket.connected) {
      pushToast(`↔️ Table ${sourceT?.number} transférée vers Table ${targetT?.number}`, "server");
    }

    emit(
      "tables:transfer",
      { sourceTableId, targetTableId, staffName: currentStaff?.name },
      (res) => {
        if (res && res.ok === false) {
          // Annulation optimiste immédiate
          setOrders(prevOrders);
          setReservations(prevReservations);
          setActiveTableId(prevActiveTableId);
        }
      }
    );
    if (activeTableId === sourceTableId) {
      setActiveTableId(targetTableId);
    }
  };

  const handleMergeTable = (sourceTableId, targetTableId) => {
    const sourceT = tables.find((t) => t.id === sourceTableId);
    const targetT = tables.find((t) => t.id === targetTableId);
    const sourceOrder = orders.find((o) => o.tableId === sourceTableId);
    const targetOrder = orders.find((o) => o.tableId === targetTableId);

    if (!sourceOrder || !targetOrder) return;

    // Snapshot pour rollback en cas de rejet serveur (Axe 3)
    const prevOrders = orders;
    const prevActiveTableId = activeTableId;

    setOrders((prev) => {
      const remaining = prev.filter((o) => o.id !== sourceOrder.id);
      return remaining.map((o) => {
        if (o.id !== targetOrder.id) return o;
        return {
          ...o,
          items: [...o.items, ...sourceOrder.items],
        };
      });
    });

    const socket = getSocket();
    if (!socket || !socket.connected) {
      pushToast(`🔗 Table ${sourceT?.number} fusionnée dans Table ${targetT?.number}`, "server");
    }

    emit(
      "tables:merge",
      { sourceTableId, targetTableId, staffName: currentStaff?.name },
      (res) => {
        if (res && res.ok === false) {
          // Annulation optimiste immédiate
          setOrders(prevOrders);
          setActiveTableId(prevActiveTableId);
        }
      }
    );
    if (activeTableId === sourceTableId) {
      setActiveTableId(targetTableId);
    }
  };

  // ── Actions Phase 4 : Réservations & Seating ────────────────
  const handleCreateReservation = (data) => {
    const newRes = {
      id: uid("res"),
      status: "confirmed",
      ...data,
    };
    setReservations((prev) => [newRes, ...prev]);
    emit("reservation:create", newRes);
    pushToast(`Réservation enregistrée pour ${data.customerName}`, "server");
  };

  const handleUpdateReservationStatus = (reservationId, status) => {
    setReservations((prev) =>
      prev.map((r) => (r.id === reservationId ? { ...r, status } : r))
    );
    emit("reservation:update_status", { id: reservationId, status });
  };

  const handleAssignReservationTable = (reservationId, tableId) => {
    setReservations((prev) =>
      prev.map((r) => (r.id === reservationId ? { ...r, tableId } : r))
    );
    emit("reservation:assign_table", { id: reservationId, tableId });
  };

  const handleDeleteReservation = (reservationId) => {
    setReservations((prev) => prev.filter((r) => r.id !== reservationId));
    emit("reservation:delete", { id: reservationId });
    pushToast("Réservation supprimée", "server");
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

  // ── Actions Gestion : tables ───────────────────────────────
  const tableHasActiveOrder = (tableId) => orders.some((o) => o.tableId === tableId);
  // Back-office persisté côté serveur (ManagementGateway) : mise à jour optimiste, puis liste diffusée par le serveur
  const addTable = (data) => {
    const id = uid("tbl");
    setTables((prev) => [...prev, { id, reserved: false, alert: false, x: 50, y: 50, ...data }]);
    emit("table:create", { id, ...data });
  };
  const updateTable = (id, data) => {
    setTables((prev) => prev.map((t) => (t.id === id ? { ...t, ...data } : t)));
    emit("table:update", { id, data });
  };
  const deleteTable = (id) => {
    if (tableHasActiveOrder(id)) { pushToast("Impossible de supprimer : commande en cours", "warn"); return false; }
    setTables((prev) => prev.filter((t) => t.id !== id));
    emit("table:delete", { id });
    return true;
  };

  // ── Actions Gestion : produits ─────────────────────────────
  const addProduct = (data) => {
    if (data.directStock) {
      const prodId = data.id || uid("prod");
      const ingId = uid("ing");
      const rcId = uid("rc");
      const initialStock = Number(data.initialStock) || 0;
      const minThreshold = Number(data.minThreshold) || 5;
      const costPerUnit = Number(data.costPerUnit) || 0;
      const ingCategory = ["boissons", "bieres", "vins", "cafes"].includes(data.cat) ? "Boissons" : "Épicerie";

      const newProduct = {
        id: prodId,
        allergens: [],
        ...data,
        available: initialStock > 0 ? (data.available !== undefined ? data.available : true) : false,
      };

      const newIngredient = {
        id: ingId,
        name: data.name,
        category: ingCategory,
        unit: "piece",
        currentStock: initialStock,
        minThreshold,
        idealStock: Math.max(20, initialStock * 1.5),
        costPerUnit,
        supplier: null,
      };

      const newRecipe = {
        id: rcId,
        productId: prodId,
        ingredientId: ingId,
        ingredientName: data.name,
        quantity: 1,
        unit: "piece",
        costPerUnit,
        currentStock: initialStock,
        isCritical: true,
        notes: "Suivi de stock direct unitaire",
      };

      setProducts((prev) => [...prev, newProduct]);
      setIngredients((prev) => [...prev, newIngredient]);
      setRecipes((prev) => [...prev, newRecipe]);

      if (initialStock > 0) {
        setStockMovements((prev) => [
          {
            id: uid("mov"),
            ingredientId: ingId,
            ingredientName: data.name,
            category: ingCategory,
            unit: "piece",
            type: "DELIVERY",
            quantity: initialStock,
            unitCost: costPerUnit,
            reason: `Stock initial lors de la création du produit "${data.name}"`,
            createdAt: Date.now(),
          },
          ...prev,
        ]);
      }

      emit("catalog:create_product_with_stock", { ...data, id: prodId });
      pushToast(`Produit "${data.name}" créé avec ${initialStock} en stock`, "server");
    } else {
      const newProduct = { id: data.id || uid("prod"), allergens: [], ...data };
      setProducts((prev) => [...prev, newProduct]);
      emit("catalog:create_product", newProduct);
      pushToast(`Produit "${data.name}" créé`, "server");
    }
  };

  const updateProduct = (id, data) => {
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...data } : p)));
    emit("catalog:update_product", { id, ...data });
    pushToast("Produit mis à jour", "server");
  };

  const deleteProduct = (id) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
    setRecipes((prev) => prev.filter((r) => r.productId !== id));
    emit("catalog:delete_product", { id });
    pushToast("Produit supprimé", "server");
  };

  // ── Actions Gestion : menus ────────────────────────────────
  const addMenu = (data) => {
    const id = uid("menu");
    setMenus((prev) => [...prev, { id, groups: [], ...data }]);
    emit("menu:create", { id, ...data });
  };
  const updateMenu = (id, data) => {
    setMenus((prev) => prev.map((m) => (m.id === id ? { ...m, ...data } : m)));
    emit("menu:update", { id, data });
  };
  const deleteMenu = (id) => {
    setMenus((prev) => prev.filter((m) => m.id !== id));
    emit("menu:delete", { id });
  };

  // ── Actions Gestion : équipe & rôles ────────────────────────
  // Le PIN part au serveur (haché en bcrypt) mais n'est jamais conservé dans l'état local
  const addStaff = (data) => {
    const id = uid("stf");
    const { pin: _pin, ...publicData } = data;
    setStaff((prev) => [...prev, { id, ...publicData }]);
    emit("staff:create", { id, ...data });
  };
  const updateStaff = (id, data) => {
    const { pin: _pin, ...publicData } = data;
    setStaff((prev) => prev.map((s) => (s.id === id ? { ...s, ...publicData } : s)));
    emit("staff:update", { id, data });
  };
  const deleteStaff = (id) => {
    setStaff((prev) => prev.filter((s) => s.id !== id));
    emit("staff:delete", { id });
  };

  const addRole = (data) => {
    const id = uid("role");
    setRoles((prev) => [...prev, { id, isSystem: false, ...data }]);
    emit("role:create", { id, ...data });
  };
  const updateRole = (id, data) => {
    setRoles((prev) => prev.map((r) => (r.id === id ? { ...r, ...data } : r)));
    emit("role:update", { id, data });
  };
  const deleteRole = (id) => {
    setRoles((prev) => prev.filter((r) => r.id !== id));
    emit("role:delete", { id });
  };

  // ── Actions Gestion : stocks & fiches techniques (Phase 2) ──
  const handleAddStockMovement = (data) => {
    emit("stock:add_movement", { ...data, staffId: currentStaff?.id });
    pushToast("Mouvement de stock enregistré", "server");
  };

  const handleAddIngredient = (data) => {
    emit("stock:create_ingredient", data);
    pushToast(`Ingrédient créé : ${data.name}`, "server");
  };

  const handleUpdateIngredient = (id, data) => {
    emit("stock:update_ingredient", { id, ...data });
    pushToast("Ingrédient mis à jour", "server");
  };

  const handleDeleteIngredient = (id) => {
    emit("stock:delete_ingredient", { id });
    pushToast("Ingrédient archivé", "server");
  };

  const handleRestoreIngredient = (id) => {
    emit("stock:restore_ingredient", { id });
    pushToast("Ingrédient restauré", "server");
  };

  const handleSaveRecipe = (productId, items) => {
    emit("recipe:save", { productId, items });
    pushToast("Fiche technique enregistrée avec succès", "server");
  };

  const handleToggleProductAvailable = (productId) => {
    emit("catalog:toggle_product_available", { productId });
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

  const contextValue = useMemo(
    () => ({
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
      onUpdateConfig: handleUpdateConfig,
      onUpdateModules: handleUpdateModules,
      modulesConfig: config?.modulesConfig || DEFAULT_MODULES_CONFIG,
      onProcessZ: handleProcessZ,
      onAddTable: addTable,
      onUpdateTable: updateTable,
      onDeleteTable: deleteTable,
      onAddProduct: addProduct,
      onUpdateProduct: updateProduct,
      onDeleteProduct: deleteProduct,
      onAddMenu: addMenu,
      onUpdateMenu: updateMenu,
      onDeleteMenu: deleteMenu,
      onAddStaff: addStaff,
      onUpdateStaff: updateStaff,
      onDeleteStaff: deleteStaff,
      onAddRole: addRole,
      onUpdateRole: updateRole,
      onDeleteRole: deleteRole,
      onAddMovement: handleAddStockMovement,
      onAddIngredient: handleAddIngredient,
      onUpdateIngredient: handleUpdateIngredient,
      onDeleteIngredient: handleDeleteIngredient,
      onRestoreIngredient: handleRestoreIngredient,
      onSaveRecipe: handleSaveRecipe,
      onToggleProductAvailable: handleToggleProductAvailable,
    }),
    [
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
      handleUpdateConfig,
      handleUpdateModules,
      handleProcessZ,
      addTable,
      updateTable,
      deleteTable,
      addProduct,
      updateProduct,
      deleteProduct,
      addMenu,
      updateMenu,
      deleteMenu,
      addStaff,
      updateStaff,
      deleteStaff,
      addRole,
      updateRole,
      deleteRole,
      handleAddStockMovement,
      handleAddIngredient,
      handleUpdateIngredient,
      handleDeleteIngredient,
      handleSaveRecipe,
      handleToggleProductAvailable,
    ]
  );

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
            onToggleProductAvailable={handleToggleProductAvailable}
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
              onProcessZ={handleProcessZ}
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
