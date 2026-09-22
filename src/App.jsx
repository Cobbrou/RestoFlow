import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import GlobalStyle from "./components/GlobalStyle.jsx";
import TopNav from "./components/TopNav.jsx";
import ToastStack from "./components/ToastStack.jsx";

import FloorPlan from "./views/salle/FloorPlan.jsx";
import OrderTaking from "./views/salle/OrderTaking.jsx";
import CuisineShell from "./views/cuisine/CuisineShell.jsx";
import Dashboard from "./views/gestion/Dashboard.jsx";
import Gestion from "./views/gestion/Gestion.jsx";

import { seedTables, seedOrders, seedHistory, seedMenus, uid } from "./data/seed.js";
import { PRODUCTS_SEED } from "./data/products.js";
import { menuToProduct } from "./utils/index.js";
import { useBeep, useContainerWidth, useNow } from "./hooks/index.js";

const initialTables = seedTables();
const initialOrders = seedOrders(initialTables);

/**
 * App — Composant racine de RestoFlow.
 *
 * Gère l'état global de l'application :
 *  - tables, orders, history, products, menus
 *  - role actif (serveur | cuisine | dashboard | gestion)
 *  - toasts et notifications audio
 *
 * Toutes les mutations passent par des fonctions dédiées définies ici
 * et transmises aux vues via props (pas de contexte pour l'instant —
 * à migrer vers Zustand ou React Context si l'app grossit).
 */
export default function App() {
  const [rootRef, containerWidth] = useContainerWidth();
  const isMobile = containerWidth < 640;

  // ── État principal ─────────────────────────────────────────
  const [tables,   setTables]   = useState(initialTables);
  const [orders,   setOrders]   = useState(initialOrders);
  const [history,  setHistory]  = useState(seedHistory);
  const [products, setProducts] = useState(PRODUCTS_SEED);
  const [menus,    setMenus]    = useState(seedMenus);

  // ── Navigation ─────────────────────────────────────────────
  const [role,        setRole]        = useState("serveur");   // serveur | cuisine | dashboard | gestion
  const [serverView,  setServerView]  = useState("plan");      // plan | commande
  const [cuisineView, setCuisineView] = useState("board");     // board | table
  const [gestionView, setGestionView] = useState("tables");    // tables | produits | menus | historique

  // ── Table active (vue commande) ────────────────────────────
  const [activeTableId, setActiveTableId] = useState(null);
  const [currentServer]                   = useState("Léa");

  // ── Horloge + sons + toasts ───────────────────────────────
  const now      = useNow();
  const [toasts, setToasts]   = useState([]);
  const [soundOn, setSoundOn] = useState(true);
  const beep     = useBeep();
  const prevKitchenNew = useRef(new Set());

  // Produits + menus combinés (affiché dans la prise de commande)
  const combinedProducts = useMemo(
    () => [...products, ...menus.map((m) => menuToProduct(m, products))],
    [products, menus]
  );

  // ── Notifications cuisine ──────────────────────────────────
  // Détecte automatiquement les nouvelles commandes envoyées → toast + bip
  useEffect(() => {
    const newSet = new Set(
      orders.filter((o) => o.items.some((i) => i.status === "new")).map((o) => o.id)
    );
    for (const id of newSet) {
      if (!prevKitchenNew.current.has(id)) {
        const o = orders.find((x) => x.id === id);
        const table = tables.find((t) => t.id === o?.tableId);
        if (table) {
          pushToast(`🔔 Nouvelle commande — Table ${table.number}`, "kitchen");
          if (soundOn) beep(760);
        }
      }
    }
    prevKitchenNew.current = newSet;
  }, [orders]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Utilitaires ────────────────────────────────────────────
  const pushToast = useCallback((text, kind) => {
    const id = uid("toast");
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000);
  }, []);

  const getActiveOrder = useCallback(
    (tableId) => orders.find((o) => o.tableId === tableId),
    [orders]
  );

  const updateOrder = (orderId, fn) => {
    setOrders((prev) => prev.map((o) => (o.id === orderId ? fn(o) : o)));
  };

  const ensureOrderForTable = useCallback(
    (tableId) => {
      let order = getActiveOrder(tableId);
      if (!order) {
        order = {
          id: uid("ord"),
          tableId,
          server: currentServer,
          createdAt: Date.now(),
          items: [],
        };
        setOrders((prev) => [...prev, order]);
      }
      return order;
    },
    [getActiveOrder, currentServer]
  );

  // ── Actions Salle ──────────────────────────────────────────
  const openTable = (table) => {
    setActiveTableId(table.id);
    ensureOrderForTable(table.id);
    setServerView("commande");
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
  };

  const removeItem = (orderId, itemId) => {
    updateOrder(orderId, (o) => ({ ...o, items: o.items.filter((i) => i.id !== itemId) }));
  };

  const setItemNote = (orderId, itemId, note) => {
    updateOrder(orderId, (o) => ({
      ...o,
      items: o.items.map((i) => (i.id === itemId ? { ...i, notes: note } : i)),
    }));
  };

  const sendToKitchen = (orderId) => {
    updateOrder(orderId, (o) => ({
      ...o,
      sentAt: Date.now(),
      items: o.items.map((i) => (i.status === "draft" ? { ...i, status: "new" } : i)),
    }));
    setServerView("plan");
  };

  const serveAndMaybeFree = (orderId) => {
    updateOrder(orderId, (o) => ({
      ...o,
      items: o.items.map((i) => (i.status === "ready" ? { ...i, status: "served" } : i)),
    }));
  };

  /**
   * Encaissement : archive dans l'historique, libère la table.
   * Prend en charge les paiements uniques ou partagés (multi-règlements).
   * @returns {object|null} ticket de caisse
   */
  const checkoutOrder = (orderId, paymentMethod, payments = null) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return null;
    const table    = tables.find((t) => t.id === order.tableId);
    const paidItems = order.items.filter((i) => i.status !== "draft");
    const total    = paidItems.reduce((s, i) => s + i.price * i.qty, 0);
    const paidAt   = Date.now();

    const paymentList = payments && payments.length > 0 ? payments : [
      { id: uid("pay"), label: "Paiement unique", amount: total, method: paymentMethod, paidAt },
    ];

    const finalMethod = paymentMethod || (paymentList.length > 1 ? "partage" : paymentList[0]?.method || "carte");

    const receipt = {
      id: uid("rcpt"),
      orderId:       order.id,
      tableNumber:   table?.number,
      server:        order.server,
      items:         paidItems,
      total,
      paymentMethod: finalMethod,
      payments:      paymentList,
      paidAt,
    };

    setHistory((prev) => [
      ...prev,
      {
        id: uid("hist"),
        createdAt: paidAt,
        server: order.server,
        items: paidItems,
        total,
        tableNumber: table?.number,
        paymentMethod: finalMethod,
        payments: paymentList,
        orderId: order.id,
      },
    ]);
    setOrders((prev) => prev.filter((o) => o.id !== orderId));
    setTables((prev) => prev.map((t) => (t.id === order.tableId ? { ...t, alert: false } : t)));
    return receipt;
  };

  const toggleAlert = (tableId) => {
    setTables((prev) => prev.map((t) => (t.id === tableId ? { ...t, alert: !t.alert } : t)));
  };

  // ── Actions Cuisine ────────────────────────────────────────
  const startPrep = (orderId) => {
    updateOrder(orderId, (o) => ({
      ...o,
      items: o.items.map((i) => (i.status === "new" ? { ...i, status: "preparing" } : i)),
    }));
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

  // ── Rendu ──────────────────────────────────────────────────
  const activeTable = tables.find((t) => t.id === activeTableId);
  const activeOrder = activeTable ? getActiveOrder(activeTable.id) : null;

  const handleSetRole = (r) => {
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
      <TopNav role={role} setRole={handleSetRole} soundOn={soundOn} setSoundOn={setSoundOn} isMobile={isMobile} />
      <ToastStack toasts={toasts} />

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
          tables={tables}
          orders={orders}
          products={products}
          menus={menus}
          history={history}
          onAddTable={addTable}
          onUpdateTable={updateTable}
          onDeleteTable={deleteTable}
          onAddProduct={addProduct}
          onUpdateProduct={updateProduct}
          onDeleteProduct={deleteProduct}
          onAddMenu={addMenu}
          onUpdateMenu={updateMenu}
          onDeleteMenu={deleteMenu}
        />
      )}
    </div>
  );
}
