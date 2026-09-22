import { useState, useEffect, useMemo, useCallback } from "react";
import GlobalStyle from "./components/GlobalStyle.jsx";
import TopNav from "./components/TopNav.jsx";
import ToastStack from "./components/ToastStack.jsx";
import PinPadModal from "./components/PinPadModal.jsx";

import FloorPlan from "./views/salle/FloorPlan.jsx";
import OrderTaking from "./views/salle/OrderTaking.jsx";
import CuisineShell from "./views/cuisine/CuisineShell.jsx";
import Dashboard from "./views/gestion/Dashboard.jsx";
import Gestion from "./views/gestion/Gestion.jsx";

import { seedTables, seedOrders, seedHistory, seedMenus, uid } from "./data/seed.js";
import { PRODUCTS_SEED } from "./data/products.js";
import { INITIAL_ROLES, INITIAL_STAFF } from "./data/staff.js";
import { menuToProduct } from "./utils/index.js";
import { useBeep, useContainerWidth, useNow } from "./hooks/index.js";
import { getSocket } from "./services/socket.js";
import { enqueueAction, flushQueue } from "./services/actionQueue.js";
import { canAccessTab, getDefaultTabForStaff, hasPermission } from "./utils/permissions.js";

const fallbackTables = seedTables();
const fallbackOrders = seedOrders(fallbackTables);

/**
 * App — Composant racine de RestoFlow.
 *
 * Gère l'état global de l'application synchronisé en temps réel via Socket.IO :
 *  - tables, orders, history, products, menus, staff, roles
 *  - synchronisation multi-postes (Salle, Cuisine KDS, Dashboard, Gestion)
 *  - buffer offline avec reconnexion automatique
 *  - authentification obligatoire par profil + code PIN individuel dès l'ouverture
 *  - application stricte des permissions RBAC (contrôle d'accès par rôle)
 */
export default function App() {
  const [rootRef, containerWidth] = useContainerWidth();
  const isMobile = containerWidth < 640;

  // ── État principal ─────────────────────────────────────────
  const [tables,   setTables]   = useState(fallbackTables);
  const [orders,   setOrders]   = useState(fallbackOrders);
  const [history,  setHistory]  = useState(seedHistory);
  const [products, setProducts] = useState(PRODUCTS_SEED);
  const [menus,    setMenus]    = useState(seedMenus);
  const [staff,    setStaff]    = useState(INITIAL_STAFF);
  const [roles,    setRoles]    = useState(INITIAL_ROLES);

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
      if (fullState.tables)   setTables(fullState.tables);
      if (fullState.orders)   setOrders(fullState.orders);
      if (fullState.history)  setHistory(fullState.history);
      if (fullState.products) setProducts(fullState.products);
      if (fullState.menus)    setMenus(fullState.menus);
      if (fullState.staff)    setStaff(fullState.staff);
      if (fullState.roles)    setRoles(fullState.roles);
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

  const addProductToOrder = (tableId, product) => {
    const order = ensureOrderForTable(tableId);
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== order.id) return o;
        const existing = o.items.find(
          (i) => i.productId === product.id && i.status === "draft" && !i.notes
        );
        if (existing) {
          return { ...o, items: o.items.map((i) => i.id === existing.id ? { ...i, qty: i.qty + 1 } : i) };
        }
        return {
          ...o,
          items: [
            ...o.items,
            { id: uid("it"), productId: product.id, name: product.name, price: product.price, qty: 1, notes: "", status: "draft" },
          ],
        };
      })
    );

    emitOrQueue("order:add_item", {
      orderId: order.id,
      product: { id: product.id, name: product.name, price: product.price, isMenu: false },
    });
  };

  const addComposedMenuToOrder = (tableId, menuProduct, composition) => {
    const order = ensureOrderForTable(tableId);
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== order.id) return o;
        return {
          ...o,
          items: [
            ...o.items,
            { id: uid("it"), productId: menuProduct.id, name: menuProduct.name, price: menuProduct.price, qty: 1, notes: "", status: "draft", isMenu: true, composition },
          ],
        };
      })
    );

    emitOrQueue("order:add_item", {
      orderId: order.id,
      product: { id: menuProduct.id, name: menuProduct.name, price: menuProduct.price, isMenu: true },
      composition,
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

  const serveAndMaybeFree = (orderId) => {
    updateOrder(orderId, (o) => ({
      ...o,
      items: o.items.map((i) => (i.status === "ready" ? { ...i, status: "served" } : i)),
    }));
    emitOrQueue("order:serve", { orderId });
  };

  /**
   * Encaissement : archive dans l'historique, libère la table et synchronise.
   */
  const checkoutOrder = (orderId, paymentMethod, payments = null) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return null;
    const table    = tables.find((t) => t.id === order.tableId);
    const paidItems = order.items.filter((i) => i.status !== "draft");
    const total    = paidItems.reduce((s, i) => s + i.price * i.qty, 0);
    const paidAt   = Date.now();
    const serverName = currentStaff ? currentStaff.name.split(" ")[0] : order.server;

    const paymentList = payments && payments.length > 0 ? payments : [
      { id: uid("pay"), label: "Paiement unique", amount: total, method: paymentMethod, paidAt },
    ];

    const finalMethod = paymentMethod || (paymentList.length > 1 ? "partage" : paymentList[0]?.method || "carte");

    const receipt = {
      id: uid("rcpt"),
      orderId:       order.id,
      tableNumber:   table?.number,
      server:        serverName,
      items:         paidItems,
      total,
      paymentMethod: finalMethod,
      payments:      paymentList,
      paidAt,
    };

    setHistory((prev) => [
      {
        id: uid("hist"),
        createdAt: paidAt,
        server: serverName,
        items: paidItems,
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
    });

    return receipt;
  };

  const toggleAlert = (tableId) => {
    setTables((prev) => prev.map((t) => (t.id === tableId ? { ...t, alert: !t.alert } : t)));
    emitOrQueue("tables:toggle_alert", { tableId });
  };

  // ── Actions Cuisine ────────────────────────────────────────
  const startPrep = (orderId) => {
    updateOrder(orderId, (o) => ({
      ...o,
      items: o.items.map((i) => (i.status === "new" ? { ...i, status: "preparing" } : i)),
    }));
    emitOrQueue("order:start_prep", { orderId });
  };

  const markReady = (orderId) => {
    let tableNum = null;
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== orderId) return o;
        const t = tables.find((tt) => tt.id === o.tableId);
        tableNum = t?.number;
        return { ...o, items: o.items.map((i) => (i.status === "preparing" ? { ...i, status: "ready" } : i)) };
      })
    );
    if (tableNum) {
      pushToast(`🔔 Commande de la Table ${tableNum} prête`, "server");
      if (soundOn) beep(980);
    }
    emitOrQueue("order:mark_ready", { orderId });
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

  return (
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
          now={now}
          onOpen={openTable}
          onToggleAlert={toggleAlert}
          isMobile={isMobile}
        />
      )}
      {role === "serveur" && serverView === "commande" && activeTable && (
        <OrderTaking
          table={activeTable}
          order={activeOrder}
          now={now}
          products={combinedProducts}
          isMobile={isMobile}
          onBack={() => setServerView("plan")}
          onAdd={(p) => addProductToOrder(activeTable.id, p)}
          onAddComposedMenu={(menuProduct, composition) => addComposedMenuToOrder(activeTable.id, menuProduct, composition)}
          onQty={(itemId, d) => changeQty(activeOrder.id, itemId, d)}
          onRemove={(itemId) => removeItem(activeOrder.id, itemId)}
          onNote={(itemId, n) => setItemNote(activeOrder.id, itemId, n)}
          onSend={() => sendToKitchen(activeOrder.id)}
          onServe={() => serveAndMaybeFree(activeOrder.id)}
          onCheckout={(method, payments) => checkoutOrder(activeOrder.id, method, payments)}
          onBackToPlan={() => setServerView("plan")}
          onToast={pushToast}
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
          onStart={startPrep}
          onReady={markReady}
        />
      )}

      {/* ── Dashboard ── */}
      {role === "dashboard" && (
        <Dashboard history={history} orders={orders} tables={tables} />
      )}

      {/* ── Gestion ── */}
      {role === "gestion" && (
        <Gestion
          view={gestionView}
          setView={setGestionView}
          currentStaff={currentStaff}
          tables={tables}
          orders={orders}
          products={products}
          menus={menus}
          history={history}
          staff={staff}
          roles={roles}
          onAddTable={addTable}
          onUpdateTable={updateTable}
          onDeleteTable={deleteTable}
          onAddProduct={addProduct}
          onUpdateProduct={updateProduct}
          onDeleteProduct={deleteProduct}
          onAddMenu={addMenu}
          onUpdateMenu={updateMenu}
          onDeleteMenu={deleteMenu}
          onAddStaff={addStaff}
          onUpdateStaff={updateStaff}
          onDeleteStaff={deleteStaff}
          onAddRole={addRole}
          onUpdateRole={updateRole}
          onDeleteRole={deleteRole}
        />
      )}
    </div>
  );
}
