import { useState, useEffect, useMemo, useCallback, lazy, Suspense } from "react";
import GlobalStyle from "./components/GlobalStyle.jsx";
import TopNav from "./components/TopNav.jsx";
import ToastStack from "./components/ToastStack.jsx";
import PinPadModal from "./components/PinPadModal.jsx";

import FloorPlan from "./views/salle/FloorPlan.jsx";
import OrderTaking from "./views/salle/OrderTaking.jsx";
import CuisineShell from "./views/cuisine/CuisineShell.jsx";

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

import { seedTables, seedOrders, seedHistory, seedMenus, seedReservations, uid } from "./data/seed.js";
import { PRODUCTS_SEED } from "./data/products.js";
import { INITIAL_ROLES, INITIAL_STAFF } from "./data/staff.js";
import { menuToProduct } from "./utils/index.js";
import { useBeep, useContainerWidth, useNow } from "./hooks/index.js";
import { getSocket } from "./services/socket.js";
import { enqueueAction, flushQueue } from "./services/actionQueue.js";
import { canAccessTab, getDefaultTabForStaff, hasPermission } from "./utils/permissions.js";

const DEFAULT_CONFIG = {
  name: "Bistrot Parisien",
  legalName: "Bistrot Parisien SAS",
  siret: "123 456 789 00012",
  vatNumber: "FR 32 123456789",
  address: "12 Rue de Rivoli",
  city: "75001 Paris",
  phone: "01 42 68 00 00",
  email: "contact@bistrotparisien.fr",
  website: "www.bistrotparisien.fr",
  footerNote: "Merci de votre visite et à très bientôt !",
  currency: "EUR",
  tpeAutoPrint: true,
  printers: [
    { id: "p-caisse", name: "Imprimante Caisse", type: "caisse", interface: "network", ip: "192.168.1.200", port: 9100, width: 80, enabled: true },
    { id: "p-cuisine", name: "Imprimante Cuisine", type: "cuisine", interface: "network", ip: "192.168.1.201", port: 9100, width: 80, enabled: true },
    { id: "p-bar", name: "Imprimante Bar", type: "bar", interface: "usb", ip: "", port: 9100, width: 58, enabled: true },
  ],
  promoCodes: [
    { code: "HAPPYHOUR", type: "percent", value: 20, description: "Happy Hour -20% sur les boissons", active: true },
    { code: "STAFF", type: "percent", value: 30, description: "Remise Personnel -30%", active: true },
    { code: "BIENVENUE5", type: "amount", value: 5, description: "Offre de bienvenue 5€", active: true },
    { code: "FIDELITE10", type: "percent", value: 10, description: "Remise Fidélité 10%", active: true },
    { code: "VIP25", type: "percent", value: 25, description: "Remise VIP 25%", active: true },
  ],
};

const fallbackTables = seedTables();
const fallbackOrders = seedOrders(fallbackTables);
const fallbackReservations = seedReservations();

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

  // ── État principal ─────────────────────────────────────────
  const [tables,       setTables]       = useState(fallbackTables);
  const [orders,       setOrders]       = useState(fallbackOrders);
  const [reservations, setReservations] = useState(fallbackReservations);
  const [history,      setHistory]      = useState(seedHistory);
  const [products,     setProducts]     = useState(PRODUCTS_SEED);
  const [menus,        setMenus]        = useState(seedMenus);
  const [staff,        setStaff]        = useState(INITIAL_STAFF);
  const [roles,        setRoles]        = useState(INITIAL_ROLES);
  const [ingredients,  setIngredients]  = useState([]);
  const [recipes,      setRecipes]      = useState([]);
  const [stockMovements, setStockMovements] = useState([]);
  const [config,       setConfig]       = useState(DEFAULT_CONFIG);

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
  const now      = useNow();
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

  // ── Synchronisation Temps Réel Socket.IO ───────────────────
  useEffect(() => {
    const socket = getSocket();

    const handleSyncInit = (fullState) => {
      if (!fullState) return;
      if (fullState.tables)         setTables(fullState.tables);
      if (fullState.orders)         setOrders(fullState.orders);
      if (fullState.reservations)   setReservations(fullState.reservations);
      if (fullState.history)        setHistory(fullState.history);
      if (fullState.products)       setProducts(fullState.products);
      if (fullState.menus)          setMenus(fullState.menus);
      if (fullState.staff)          setStaff(fullState.staff);
      if (fullState.roles)          setRoles(fullState.roles);
      if (fullState.ingredients)    setIngredients(fullState.ingredients);
      if (fullState.recipes)        setRecipes(fullState.recipes);
      if (fullState.stockMovements) setStockMovements(fullState.stockMovements);
      if (fullState.config)         setConfig(fullState.config);
    };

    const handleTableUpdated = (updatedTable) => {
      setTables((prev) => prev.map((t) => (t.id === updatedTable.id ? updatedTable : t)));
    };

    const handleOrderUpdated = (updatedOrder) => {
      setOrders((prev) => {
        const exists = prev.some((o) => o.id === updatedOrder.id);
        if (exists) {
          return prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o));
        }
        return [...prev, updatedOrder];
      });
    };

    const handleOrderClosed = ({ orderId }) => {
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
    };

    const handleHistoryNew = (entry) => {
      setHistory((prev) => [entry, ...prev]);
    };

    const handleKitchenTicket = ({ tableNumber, server }) => {
      pushToast(`🔔 Nouvelle commande — Table ${tableNumber} (${server})`, "kitchen");
      if (soundOn) beep(760);
    };

    const handleOrderReady = ({ tableNumber }) => {
      pushToast(`🔔 Commande de la Table ${tableNumber} prête !`, "server");
      if (soundOn) beep(980);
    };

    const handleKitchenCallCourse = ({ tableNumber, courseLabel, course, server }) => {
      pushToast(`🔔 Table ${tableNumber} — Réclame : ${courseLabel ? courseLabel.toUpperCase() : course} (${server})`, "kitchen");
      if (soundOn) beep(840);
    };

    const handleReservationCreated = (reservation) => {
      setReservations((prev) => [reservation, ...prev.filter((r) => r.id !== reservation.id)]);
      pushToast(`📅 Réservation créée : ${reservation.customerName} (${reservation.guests}p à ${reservation.time})`, "server");
    };

    const handleReservationUpdated = (reservation) => {
      setReservations((prev) => prev.map((r) => (r.id === reservation.id ? reservation : r)));
    };

    const handleReservationDeleted = ({ reservationId }) => {
      setReservations((prev) => prev.filter((r) => r.id !== reservationId));
    };

    const handleTablesTransferred = (payload) => {
      const from = payload?.sourceTableNumber ?? payload?.fromTableNumber;
      const to = payload?.targetTableNumber ?? payload?.toTableNumber;
      if (from && to) {
        pushToast(`↔️ Table ${from} transférée vers Table ${to}`, "server");
      }
    };

    const handleTablesMerged = (payload) => {
      const from = payload?.sourceTableNumber ?? payload?.fromTableNumber;
      const to = payload?.targetTableNumber ?? payload?.toTableNumber;
      if (from && to) {
        pushToast(`🔗 Table ${from} fusionnée dans Table ${to}`, "server");
      }
    };

    const handleStockUpdated = (updatedIngredients) => {
      setIngredients(updatedIngredients);
    };

    const handleRecipesUpdated = (updatedRecipes) => {
      setRecipes(updatedRecipes);
    };

    const handleMovementsUpdated = (updatedMovements) => {
      setStockMovements(updatedMovements);
    };

    const handleCatalogProductsUpdated = (updatedProducts) => {
      setProducts(updatedProducts);
    };

    const handleStockAlert = ({ message }) => {
      pushToast(message, "warn");
      if (soundOn) beep(620);
    };

    const handleConfigUpdated = (updatedConfig) => {
      if (updatedConfig) setConfig(updatedConfig);
    };

    const handleConnect = () => {
      flushQueue(socket);
      socket.emit("sync:request", {}, (res) => {
        if (res && res.state) handleSyncInit(res.state);
      });
    };

    socket.on("sync:init", handleSyncInit);
    socket.on("table:updated", handleTableUpdated);
    socket.on("order:updated", handleOrderUpdated);
    socket.on("order:closed", handleOrderClosed);
    socket.on("history:new_entry", handleHistoryNew);
    socket.on("kitchen:new_ticket", handleKitchenTicket);
    socket.on("server:order_ready", handleOrderReady);
    socket.on("kitchen:call_course", handleKitchenCallCourse);
    socket.on("reservation:created", handleReservationCreated);
    socket.on("reservation:updated", handleReservationUpdated);
    socket.on("reservation:deleted", handleReservationDeleted);
    socket.on("tables:transferred", handleTablesTransferred);
    socket.on("tables:merged", handleTablesMerged);
    socket.on("stock:updated", handleStockUpdated);
    socket.on("recipes:updated", handleRecipesUpdated);
    socket.on("stock:movements_updated", handleMovementsUpdated);
    socket.on("catalog:products_updated", handleCatalogProductsUpdated);
    socket.on("stock:alert", handleStockAlert);
    socket.on("config:updated", handleConfigUpdated);
    socket.on("connect", handleConnect);

    if (socket.connected) {
      flushQueue(socket);
    }

    return () => {
      socket.off("sync:init", handleSyncInit);
      socket.off("table:updated", handleTableUpdated);
      socket.off("order:updated", handleOrderUpdated);
      socket.off("order:closed", handleOrderClosed);
      socket.off("history:new_entry", handleHistoryNew);
      socket.off("kitchen:new_ticket", handleKitchenTicket);
      socket.off("server:order_ready", handleOrderReady);
      socket.off("kitchen:call_course", handleKitchenCallCourse);
      socket.off("reservation:created", handleReservationCreated);
      socket.off("reservation:updated", handleReservationUpdated);
      socket.off("reservation:deleted", handleReservationDeleted);
      socket.off("tables:transferred", handleTablesTransferred);
      socket.off("tables:merged", handleTablesMerged);
      socket.off("stock:updated", handleStockUpdated);
      socket.off("recipes:updated", handleRecipesUpdated);
      socket.off("stock:movements_updated", handleMovementsUpdated);
      socket.off("catalog:products_updated", handleCatalogProductsUpdated);
      socket.off("stock:alert", handleStockAlert);
      socket.off("config:updated", handleConfigUpdated);
      socket.off("connect", handleConnect);
    };
  }, [soundOn, beep, pushToast]);

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

  // Helper pour émettre avec fallback dans la file d'attente hors-ligne
  const emitOrQueue = (eventType, payload) => {
    const socket = getSocket();
    if (socket && socket.connected) {
      socket.emit(eventType, payload);
    } else {
      enqueueAction(eventType, payload);
    }
  };

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
        emitOrQueue("order:create_or_ensure", { orderId: order.id, tableId, server: serverName });
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

  const handleStaffPinSuccess = (staffMember) => {
    setCurrentStaff(staffMember);
    setIsPinModalOpen(false);
    setPendingTableToOpen(null);
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
    setIsPinModalOpen(true);
  };

  const getItemCourseAndStation = (product) => {
    const cat = product?.cat || "";
    const isBar =
      cat === "boissons" ||
      product?.station === "bar" ||
      product?.id?.startsWith("p18") ||
      product?.id?.startsWith("p19") ||
      product?.id?.startsWith("p20") ||
      product?.id?.startsWith("p21");
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

    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== order.id) return o;
        const existing = o.items.find(
          (i) => i.productId === product.id && i.status === "draft" && !i.notes && (i.course || course) === course
        );
        if (existing) {
          return { ...o, items: o.items.map((i) => i.id === existing.id ? { ...i, qty: i.qty + 1 } : i) };
        }
        return {
          ...o,
          items: [
            ...o.items,
            {
              id: uid("it"),
              productId: product.id,
              name: product.name,
              price: product.price,
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

    emitOrQueue("order:add_item", {
      orderId: order.id,
      product: { id: product.id, name: product.name, price: product.price, cat, station, isMenu: false },
      course,
      courseStatus,
      station,
    });
  };

  const addComposedMenuToOrder = (tableId, menuProduct, composition) => {
    const order = ensureOrderForTable(tableId);
    const course = "plat";
    const courseStatus = "held";
    const station = "kitchen";

    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== order.id) return o;
        return {
          ...o,
          items: [
            ...o.items,
            {
              id: uid("it"),
              productId: menuProduct.id,
              name: menuProduct.name,
              price: menuProduct.price,
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

    emitOrQueue("order:add_item", {
      orderId: order.id,
      product: { id: menuProduct.id, name: menuProduct.name, price: menuProduct.price, cat: "menus", station: "kitchen", isMenu: true },
      composition,
      course,
      courseStatus,
      station,
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

    emitOrQueue("order:change_qty", { orderId, itemId, delta });
  };

  const removeItem = (orderId, itemId) => {
    updateOrder(orderId, (o) => ({ ...o, items: o.items.filter((i) => i.id !== itemId) }));
    emitOrQueue("order:remove_item", { orderId, itemId });
  };

  const setItemNote = (orderId, itemId, note) => {
    updateOrder(orderId, (o) => ({
      ...o,
      items: o.items.map((i) => (i.id === itemId ? { ...i, notes: note } : i)),
    }));
    emitOrQueue("order:set_note", { orderId, itemId, note });
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
    emitOrQueue("order:send_kitchen", { orderId, serverName });
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
    emitOrQueue("order:serve", { orderId, course: targetCourse });
  };

  const handleApplyDiscount = (orderId, discount) => {
    updateOrder(orderId, (o) => ({ ...o, discount }));
    emitOrQueue("order:discount:apply", { orderId, discount });
  };

  const handleRemoveDiscount = (orderId) => {
    updateOrder(orderId, (o) => ({ ...o, discount: null }));
    emitOrQueue("order:discount:remove", { orderId });
  };

  const handleUpdateConfig = (newConfig) => {
    setConfig(newConfig);
    emitOrQueue("config:update", newConfig);
    pushToast("Configuration de la caisse mise à jour", "server");
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

    // Numéro de facture séquentiel lisible
    const nowYear = new Date().getFullYear();
    const seqNum = String((history.length + 1)).padStart(4, "0");
    const ticketNumber = meta?.ticketNumber || `FAC-${nowYear}-${seqNum}`;

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

    emitOrQueue("order:checkout", {
      orderId,
      paymentMethod: finalMethod,
      payments: paymentList,
      serverName,
      subtotal,
      total,
      discount,
      vatDetails,
      ticketNumber,
    });

    return receipt;
  };

  const toggleAlert = (tableId) => {
    setTables((prev) => prev.map((t) => (t.id === tableId ? { ...t, alert: !t.alert } : t)));
    emitOrQueue("tables:toggle_alert", { tableId });
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
    emitOrQueue("order:start_prep", { orderId, station });
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
    emitOrQueue("order:mark_ready", { orderId, station });
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

    emitOrQueue("order:call_course", { orderId, course, serverName, server: serverName });
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
    emitOrQueue("order:change_item_course", { orderId, itemId, course });
  };

  // ── Actions Phase 4 : Transfert & Fusion de tables ─────────
  const handleTransferTable = (sourceTableId, targetTableId) => {
    const sourceT = tables.find((t) => t.id === sourceTableId);
    const targetT = tables.find((t) => t.id === targetTableId);

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

    emitOrQueue("tables:transfer", { sourceTableId, targetTableId });
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

    emitOrQueue("tables:merge", { sourceTableId, targetTableId });
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
    emitOrQueue("reservation:create", newRes);
    pushToast(`Réservation enregistrée pour ${data.customerName}`, "server");
  };

  const handleUpdateReservationStatus = (reservationId, status) => {
    setReservations((prev) =>
      prev.map((r) => (r.id === reservationId ? { ...r, status } : r))
    );
    emitOrQueue("reservation:update_status", { reservationId, status });
  };

  const handleAssignReservationTable = (reservationId, tableId) => {
    setReservations((prev) =>
      prev.map((r) => (r.id === reservationId ? { ...r, tableId } : r))
    );
    emitOrQueue("reservation:assign_table", { reservationId, tableId });
  };

  const handleDeleteReservation = (reservationId) => {
    setReservations((prev) => prev.filter((r) => r.id !== reservationId));
    emitOrQueue("reservation:delete", { reservationId });
    pushToast("Réservation supprimée", "server");
  };

  const handleSeatReservationGuests = ({ reservation, table }) => {
    setReservations((prev) =>
      prev.map((r) => (r.id === reservation.id ? { ...r, status: "seated", tableId: table.id } : r))
    );
    emitOrQueue("reservation:assign_table", { reservationId: reservation.id, tableId: table.id });
    emitOrQueue("reservation:update_status", { reservationId: reservation.id, status: "seated" });

    setActiveTableId(table.id);
    ensureOrderForTable(table.id);
    setRole("serveur");
    setServerView("commande");
    setIsReservationModalOpen(false);
    pushToast(`Table ${table.number} installée pour ${reservation.customerName} (${reservation.guests} pers.)`, "server");
  };

  // ── Actions Gestion : tables ───────────────────────────────
  const tableHasActiveOrder = (tableId) => orders.some((o) => o.tableId === tableId);
  const addTable    = (data) => setTables((prev) => [...prev, { id: uid("tbl"), reserved: false, alert: false, x: 50, y: 50, ...data }]);
  const updateTable = (id, data) => setTables((prev) => prev.map((t) => (t.id === id ? { ...t, ...data } : t)));
  const deleteTable = (id) => {
    if (tableHasActiveOrder(id)) { pushToast("Impossible de supprimer : commande en cours", "warn"); return false; }
    setTables((prev) => prev.filter((t) => t.id !== id));
    return true;
  };

  // ── Actions Gestion : produits ─────────────────────────────
  const addProduct    = (data) => setProducts((prev) => [...prev, { id: uid("prod"), allergens: [], ...data }]);
  const updateProduct = (id, data) => setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...data } : p)));
  const deleteProduct = (id) => setProducts((prev) => prev.filter((p) => p.id !== id));

  // ── Actions Gestion : menus ────────────────────────────────
  const addMenu    = (data) => setMenus((prev) => [...prev, { id: uid("menu"), groups: [], ...data }]);
  const updateMenu = (id, data) => setMenus((prev) => prev.map((m) => (m.id === id ? { ...m, ...data } : m)));
  const deleteMenu = (id) => setMenus((prev) => prev.filter((m) => m.id !== id));

  // ── Actions Gestion : équipe & rôles ────────────────────────
  const addStaff    = (data) => setStaff((prev) => [...prev, { id: uid("stf"), ...data }]);
  const updateStaff = (id, data) => setStaff((prev) => prev.map((s) => (s.id === id ? { ...s, ...data } : s)));
  const deleteStaff = (id) => setStaff((prev) => prev.filter((s) => s.id !== id));

  const addRole    = (data) => setRoles((prev) => [...prev, { id: uid("role"), isSystem: false, ...data }]);
  const updateRole = (id, data) => setRoles((prev) => prev.map((r) => (r.id === id ? { ...r, ...data } : r)));
  const deleteRole = (id) => setRoles((prev) => prev.filter((r) => r.id !== id));

  // ── Actions Gestion : stocks & fiches techniques (Phase 2) ──
  const handleAddStockMovement = (data) => {
    emitOrQueue("stock:add_movement", { ...data, staffId: currentStaff?.id });
    pushToast("Mouvement de stock enregistré", "server");
  };

  const handleAddIngredient = (data) => {
    emitOrQueue("stock:create_ingredient", data);
    pushToast(`Ingrédient créé : ${data.name}`, "server");
  };

  const handleUpdateIngredient = (id, data) => {
    emitOrQueue("stock:update_ingredient", { id, ...data });
    pushToast("Ingrédient mis à jour", "server");
  };

  const handleDeleteIngredient = (id) => {
    emitOrQueue("stock:delete_ingredient", { id });
    pushToast("Ingrédient supprimé", "server");
  };

  const handleSaveRecipe = (productId, items) => {
    emitOrQueue("recipe:save", { productId, items });
    pushToast("Fiche technique enregistrée avec succès", "server");
  };

  const handleToggleProductAvailable = (productId) => {
    emitOrQueue("catalog:toggle_product_available", { productId });
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
      staff,
      roles,
      config,
      reservations,
      currentStaff,
      role,
      gestionView,
      pushToast,
      onUpdateConfig: handleUpdateConfig,
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
      staff,
      roles,
      config,
      reservations,
      currentStaff,
      role,
      gestionView,
      pushToast,
      handleUpdateConfig,
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
        <FloorPlan
          tables={tables}
          orders={orders}
          reservations={reservations}
          now={now}
          onOpen={openTable}
          onToggleAlert={toggleAlert}
          onOpenReservations={() => setIsReservationModalOpen(true)}
          onOpenTableAction={(mode, table) => setTableActionModal({ mode, sourceTable: table })}
          isMobile={isMobile}
        />
      )}
      {role === "serveur" && serverView === "commande" && activeTable && (
        <OrderTaking
          table={activeTable}
          order={activeOrder}
          now={now}
          products={combinedProducts}
          recipes={recipes}
          ingredients={ingredients}
          config={config}
          tables={tables}
          orders={orders}
          isMobile={isMobile}
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
      )}

      {/* ── Vue Cuisine ── */}
      {role === "cuisine" && (
        <CuisineShell
          view={cuisineView}
          setView={setCuisineView}
          tables={tables}
          orders={orders}
          now={now}
          products={combinedProducts}
          config={config}
          onStart={startPrep}
          onReady={markReady}
        />
      )}

      {/* ── Dashboard (Lazy Loaded) ── */}
      {role === "dashboard" && (
        <Suspense fallback={<ViewFallback />}>
          <Dashboard history={history} orders={orders} tables={tables} />
        </Suspense>
      )}

      {/* ── Gestion (Lazy Loaded & Sans Prop Drilling) ── */}
      {role === "gestion" && (
        <Suspense fallback={<ViewFallback />}>
          <Gestion view={gestionView} setView={setGestionView} />
        </Suspense>
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
      </div>
    </RestoFlowProvider>
  );
}
