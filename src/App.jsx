import { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from "react";
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
import { menuToProduct, getProductEffectivePrice, deduplicateHistory } from "./utils/index.js";
import { useBeep, useContainerWidth, useNow } from "./hooks/index.js";
import { getSocket, setSocketToken, hasValidSessionToken, clearSessionToken } from "./services/socket.js";
import { enqueueAction, flushQueue, hasPendingActions, newActionId } from "./services/actionQueue.js";
import { canAccessTab, getDefaultTabForStaff, hasPermission } from "./utils/permissions.js";
import PwaInstallPrompt from "./components/PwaInstallPrompt.jsx";
import {
  saveFullState,
  loadCachedState,
  saveCollection,
  saveCachedAuth,
} from "./services/db.js";

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
  grandTotal: 0,
  lastClosingDate: null,
  happyHourConfig: {
    enabled: true,
    startTime: "17:00",
    endTime: "20:00",
    days: [1, 2, 3, 4, 5],
    defaultDiscountPercent: 20,
    applicableCategories: ["boissons"],
  },
  fecExportConfig: {
    journalCode: "VT",
    journalLib: "Ventes Caisse",
    compteClient: "411000",
    compteVentesBoissons: "707100",
    compteVentesNourriture: "707200",
    compteVentesMenus: "707300",
    compteTva10: "445711",
    compteTva20: "445712",
    compteTva55: "445713",
    compteCaisse: "531000",
    compteBanqueCB: "512100",
    compteAutre: "580000",
  },
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
  const [closings,     setClosings]     = useState([]);
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

  // ── Restauration immédiate depuis IndexedDB (Mode 100% Autonome / Offline) ──
  useEffect(() => {
    let active = true;
    loadCachedState().then((cached) => {
      if (!active || !cached) return;
      if (cached.tables?.length)         setTables(cached.tables);
      if (cached.orders)                 setOrders(cached.orders);
      if (cached.reservations)           setReservations(cached.reservations);
      if (cached.history)                setHistory(deduplicateHistory(cached.history));
      if (cached.products?.length)       setProducts(cached.products);
      if (cached.menus?.length)          setMenus(cached.menus);
      if (cached.staff?.length)          setStaff(cached.staff);
      if (cached.roles?.length)          setRoles(cached.roles);
      if (cached.ingredients?.length)    setIngredients(cached.ingredients);
      if (cached.recipes?.length)        setRecipes(cached.recipes);
      if (cached.stockMovements?.length) setStockMovements(cached.stockMovements);
      if (cached.closings?.length)       setClosings(cached.closings);
      if (cached.config)                 setConfig(cached.config);
    });
    return () => {
      active = false;
    };
  }, []);

  // Sauvegarde des mutations locales régulières dans IndexedDB
  useEffect(() => { saveCollection("tables", tables); }, [tables]);
  useEffect(() => { saveCollection("orders", orders); }, [orders]);
  useEffect(() => { saveCollection("reservations", reservations); }, [reservations]);
  useEffect(() => { saveCollection("history", history); }, [history]);
  useEffect(() => { saveCollection("closings", closings); }, [closings]);
  useEffect(() => { saveCollection("products", products); }, [products]);
  useEffect(() => { saveCollection("ingredients", ingredients); }, [ingredients]);
  useEffect(() => { saveCollection("recipes", recipes); }, [recipes]);
  useEffect(() => { saveCollection("stockMovements", stockMovements); }, [stockMovements]);

  // ── Synchronisation Temps Réel Socket.IO ───────────────────
  const syncHandlerRef = useRef(null);
  useEffect(() => {
    const socket = getSocket();

    const handleSyncInit = (fullState) => {
      if (!fullState) return;
      if (fullState.tables)         setTables(fullState.tables);
      if (fullState.orders)         setOrders(fullState.orders);
      if (fullState.reservations)   setReservations(fullState.reservations);
      if (fullState.history)        setHistory(deduplicateHistory(fullState.history));
      if (fullState.products)       setProducts(fullState.products);
      if (fullState.menus)          setMenus(fullState.menus);
      if (fullState.staff)          setStaff(fullState.staff);
      if (fullState.roles)          setRoles(fullState.roles);
      if (fullState.ingredients)    setIngredients(fullState.ingredients);
      if (fullState.recipes)        setRecipes(fullState.recipes);
      if (fullState.stockMovements) setStockMovements(fullState.stockMovements);
      if (fullState.closings)       setClosings(fullState.closings);
      if (fullState.config)         setConfig(fullState.config);

      // Persistance complète dans IndexedDB
      saveFullState(fullState);
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
      if (!entry) return;
      setHistory((prev) => {
        const match = (h) =>
          h.id === entry.id ||
          (entry.orderId && h.orderId && h.orderId === entry.orderId) ||
          (entry.ticketNumber && h.ticketNumber && h.ticketNumber === entry.ticketNumber);

        const exists = prev.some(match);
        if (exists) {
          return prev.map((h) => (match(h) ? entry : h));
        }
        return [entry, ...prev];
      });
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

    const handleReservationDeleted = ({ id }) => {
      setReservations((prev) => prev.filter((r) => r.id !== id));
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

    const handleClosingNewZ = (newClosing) => {
      if (!newClosing) return;
      setClosings((prev) => [newClosing, ...prev.filter((c) => c.id !== newClosing.id)]);
      setHistory((prev) =>
        prev.map((h) => {
          if (!h.closedInZId && newClosing.periodStart && newClosing.periodEnd) {
            const t = new Date(h.createdAt).getTime();
            const start = new Date(newClosing.periodStart).getTime();
            const end = new Date(newClosing.periodEnd).getTime();
            if (t >= start && t <= end) {
              return { ...h, closedInZId: newClosing.id };
            }
          }
          return h;
        })
      );
      pushToast(`Clôture ${newClosing.reportNumber || "Z"} enregistrée`, "server");
    };

    // Le serveur confirme la session (auth:ok) avant tout rejeu : sinon les actions seraient rejetées puis perdues
    const handleConnect = async () => {
      try {
        const syncResult = await flushQueue(socket);
        if (syncResult && syncResult.flushed > 0) {
          pushToast(`Reconnexion réussie — ${syncResult.flushed} action(s) synchronisée(s)`, "server");
        }
      } catch (err) {
        console.warn("[App] Erreur vidage file au retour en ligne :", err);
      }
      socket.emit("sync:request", {}, (res) => {
        if (res && res.state) handleSyncInit(res.state);
      });
    };

    syncHandlerRef.current = handleSyncInit;
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
    socket.on("recipe:updated", handleRecipesUpdated);
    socket.on("stock:movements_updated", handleMovementsUpdated);
    socket.on("catalog:products_updated", handleCatalogProductsUpdated);
    socket.on("stock:alert", handleStockAlert);
    socket.on("config:updated", handleConfigUpdated);
    socket.on("closing:new_z", handleClosingNewZ);
    // Session absente/expirée côté serveur : retour à l'écran PIN (sans reconnexion, évite une boucle)
    const handleAuthRequired = () => {
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
    };

    // Erreurs levées par les guards serveur (droits insuffisants, session invalide)
    const handleServerException = (err) => {
      pushToast(err?.message || "Action refusée par le serveur", "warn");
    };

    socket.on("auth:ok", handleConnect);
    socket.on("auth:required", handleAuthRequired);
    socket.on("exception", handleServerException);

    if (socket.connected && hasValidSessionToken()) {
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
      socket.off("recipe:updated", handleRecipesUpdated);
      socket.off("stock:movements_updated", handleMovementsUpdated);
      socket.off("catalog:products_updated", handleCatalogProductsUpdated);
      socket.off("stock:alert", handleStockAlert);
      socket.off("config:updated", handleConfigUpdated);
      socket.off("closing:new_z", handleClosingNewZ);
      socket.off("auth:ok", handleConnect);
      socket.off("auth:required", handleAuthRequired);
      socket.off("exception", handleServerException);
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

  // Helper pour émettre avec fallback dans la file d'attente hors-ligne et réconciliation / rollback (Axe 3)
  // Ordre strict : tant que la file n'est pas vide, toute nouvelle action passe derrière.
  // Chaque action porte un clientActionId : un acquittement perdu => rejouée, et le serveur ignore le doublon.
  const emitOrQueue = (eventType, payload, onAck) => {
    const socket = getSocket();
    if (!socket?.connected || hasPendingActions()) {
      enqueueAction(eventType, payload);
      if (socket?.connected && hasValidSessionToken()) flushQueue(socket);
      return;
    }

    const clientActionId = newActionId();
    let settled = false;
    const ackTimer = setTimeout(() => {
      if (settled) return;
      settled = true;
      enqueueAction(eventType, payload, clientActionId);
    }, 5000);

    socket.emit(eventType, { ...payload, clientActionId }, (response) => {
      clearTimeout(ackTimer);
      if (settled) return;
      settled = true;
      if (response && response.ok === false) {
        pushToast(response.error || "Une erreur est survenue sur le serveur", "warn");
        if (onAck) onAck(response);
        // Réconciliation automatique avec l'état réel de la base de données
        socket.emit("sync:request", {}, (res) => {
          if (res && res.state) syncHandlerRef.current?.(res.state);
        });
      } else if (onAck) {
        onAck(response);
      }
    });
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

    emitOrQueue("order:add_item", {
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

    emitOrQueue("order:add_item", {
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

    // Montants, remise, TVA et numéro de ticket sont recalculés par le serveur
    emitOrQueue("order:checkout", {
      orderId,
      paymentMethod: finalMethod,
      payments: paymentList,
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

    emitOrQueue(
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

    emitOrQueue(
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
    emitOrQueue("reservation:create", newRes);
    pushToast(`Réservation enregistrée pour ${data.customerName}`, "server");
  };

  const handleUpdateReservationStatus = (reservationId, status) => {
    setReservations((prev) =>
      prev.map((r) => (r.id === reservationId ? { ...r, status } : r))
    );
    emitOrQueue("reservation:update_status", { id: reservationId, status });
  };

  const handleAssignReservationTable = (reservationId, tableId) => {
    setReservations((prev) =>
      prev.map((r) => (r.id === reservationId ? { ...r, tableId } : r))
    );
    emitOrQueue("reservation:assign_table", { id: reservationId, tableId });
  };

  const handleDeleteReservation = (reservationId) => {
    setReservations((prev) => prev.filter((r) => r.id !== reservationId));
    emitOrQueue("reservation:delete", { id: reservationId });
    pushToast("Réservation supprimée", "server");
  };

  const handleSeatReservationGuests = ({ reservation, table }) => {
    setReservations((prev) =>
      prev.map((r) => (r.id === reservation.id ? { ...r, status: "seated", tableId: table.id } : r))
    );
    emitOrQueue("reservation:assign_table", { id: reservation.id, tableId: table.id });
    emitOrQueue("reservation:update_status", { id: reservation.id, status: "seated" });

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

      emitOrQueue("catalog:create_product_with_stock", { ...data, id: prodId });
      pushToast(`Produit "${data.name}" créé avec ${initialStock} en stock`, "server");
    } else {
      const newProduct = { id: data.id || uid("prod"), allergens: [], ...data };
      setProducts((prev) => [...prev, newProduct]);
      emitOrQueue("catalog:create_product", newProduct);
      pushToast(`Produit "${data.name}" créé`, "server");
    }
  };

  const updateProduct = (id, data) => {
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...data } : p)));
    emitOrQueue("catalog:update_product", { id, ...data });
    pushToast("Produit mis à jour", "server");
  };

  const deleteProduct = (id) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
    setRecipes((prev) => prev.filter((r) => r.productId !== id));
    emitOrQueue("catalog:delete_product", { id });
    pushToast("Produit supprimé", "server");
  };

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
    pushToast("Ingrédient archivé", "server");
  };

  const handleRestoreIngredient = (id) => {
    emitOrQueue("stock:restore_ingredient", { id });
    pushToast("Ingrédient restauré", "server");
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
          <Gestion
            view={gestionView}
            setView={setGestionView}
            closings={closings}
            onProcessZ={handleProcessZ}
          />
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

      {/* ── Notification PWA & Invitation à l'installation ── */}
      <PwaInstallPrompt />
      </div>
    </RestoFlowProvider>
  );
}
