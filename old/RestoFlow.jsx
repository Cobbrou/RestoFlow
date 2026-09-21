import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Search, Plus, Minus, X, ChefHat, ClipboardList, LayoutGrid, Table2,
  BarChart3, Bell, BellOff, Users, Clock, CheckCircle2, AlertTriangle,
  ArrowLeft, StickyNote, Flame, Sparkles, Volume2, VolumeX, Utensils,
  Settings, Trash2, Pencil, Menu as MenuIcon, Package, LayoutList, Check,
  Printer, Lock, Ban, CreditCard, Banknote, Wallet, CalendarClock, Receipt
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  AreaChart, Area, PieChart, Pie, Cell
} from "recharts";

/* ============================================================
   DONNÉES
   ============================================================ */

const CATEGORIES = [
  { id: "entrees", name: "Entrées", accent: "#B5451B" },
  { id: "plats", name: "Plats", accent: "#8B5E34" },
  { id: "burgers", name: "Burgers", accent: "#A6431A" },
  { id: "pizzas", name: "Pizzas", accent: "#C1440E" },
  { id: "salades", name: "Salades", accent: "#4A7856" },
  { id: "desserts", name: "Desserts", accent: "#B5793A" },
  { id: "boissons", name: "Boissons", accent: "#3E7CB1" },
  { id: "menus", name: "Menus", accent: "#6B4226" },
];

const PRODUCTS_SEED = [
  { id: "p1", cat: "entrees", name: "Burrata crémeuse", desc: "Tomates anciennes, basilic, huile d'olive", price: 9, emoji: "🍅", allergens: ["Lait"] },
  { id: "p2", cat: "entrees", name: "Velouté du jour", desc: "Potiron rôti, crème, noisettes", price: 7.5, emoji: "🥣", allergens: ["Lait", "Fruits à coque"] },
  { id: "p3", cat: "entrees", name: "Planche à partager", desc: "Charcuterie, fromages, pain grillé", price: 14, emoji: "🧀", allergens: ["Lait", "Gluten"] },
  { id: "p4", cat: "plats", name: "Entrecôte grillée", desc: "Frites maison, sauce au poivre", price: 22, emoji: "🥩", allergens: [] },
  { id: "p5", cat: "plats", name: "Saumon rôti", desc: "Purée de panais, beurre citronné", price: 19, emoji: "🐟", allergens: ["Poisson", "Lait"] },
  { id: "p6", cat: "plats", name: "Risotto champignons", desc: "Parmesan, huile de truffe", price: 16, emoji: "🍚", allergens: ["Lait"] },
  { id: "p7", cat: "burgers", name: "Burger Classic", desc: "Bœuf, cheddar, oignons confits", price: 12, emoji: "🍔", allergens: ["Gluten", "Lait"] },
  { id: "p8", cat: "burgers", name: "Burger Veggie", desc: "Galette de légumes, avocat, roquette", price: 12.5, emoji: "🥑", allergens: ["Gluten"] },
  { id: "p9", cat: "burgers", name: "Burger Bacon BBQ", desc: "Double bœuf, bacon, sauce barbecue", price: 14.5, emoji: "🥓", allergens: ["Gluten", "Lait"] },
  { id: "p10", cat: "pizzas", name: "Pizza 4 Fromages", desc: "Mozzarella, gorgonzola, chèvre, parmesan", price: 14, emoji: "🍕", allergens: ["Gluten", "Lait"] },
  { id: "p11", cat: "pizzas", name: "Pizza Regina", desc: "Jambon, champignons, mozzarella", price: 13, emoji: "🍕", allergens: ["Gluten", "Lait"] },
  { id: "p12", cat: "pizzas", name: "Pizza Diavola", desc: "Salami piquant, piment, mozzarella", price: 13.5, emoji: "🌶️", allergens: ["Gluten", "Lait"] },
  { id: "p13", cat: "salades", name: "César Poulet", desc: "Poulet grillé, parmesan, croûtons", price: 13, emoji: "🥗", allergens: ["Gluten", "Lait", "Œuf"] },
  { id: "p14", cat: "salades", name: "Salade Chèvre Chaud", desc: "Chèvre, miel, noix, mesclun", price: 12, emoji: "🐐", allergens: ["Lait", "Fruits à coque"] },
  { id: "p15", cat: "desserts", name: "Tiramisu maison", desc: "Mascarpone, café, cacao", price: 7, emoji: "🍰", allergens: ["Lait", "Œuf", "Gluten"] },
  { id: "p16", cat: "desserts", name: "Fondant au chocolat", desc: "Cœur coulant, glace vanille", price: 8, emoji: "🍫", allergens: ["Lait", "Œuf", "Gluten"] },
  { id: "p17", cat: "desserts", name: "Crème brûlée", desc: "Vanille de Madagascar", price: 6.5, emoji: "🍮", allergens: ["Lait", "Œuf"] },
  { id: "p18", cat: "boissons", name: "Coca-Cola", desc: "33cl", price: 4, emoji: "🥤", allergens: [] },
  { id: "p19", cat: "boissons", name: "Eau pétillante", desc: "50cl", price: 3.5, emoji: "💧", allergens: [] },
  { id: "p20", cat: "boissons", name: "Verre de Côtes du Rhône", desc: "12cl", price: 6, emoji: "🍷", allergens: ["Sulfites"] },
  { id: "p21", cat: "boissons", name: "Café", desc: "Expresso", price: 2.5, emoji: "☕", allergens: [] },
];

function seedMenus() {
  return [
    {
      id: "menu1", name: "Menu Burger", price: 17, emoji: "🍔", desc: "",
      groups: [
        { id: "g1", title: "Entrée", count: 1, productIds: ["p1", "p2", "p3"] },
        { id: "g2", title: "Plat", count: 1, productIds: ["p7", "p8", "p9"] },
        { id: "g3", title: "Dessert", count: 1, productIds: ["p15", "p16", "p17"] },
      ],
    },
    {
      id: "menu2", name: "Menu Midi", price: 19, emoji: "🍽️", desc: "",
      groups: [
        { id: "g1", title: "Plat", count: 1, productIds: ["p4", "p5", "p6", "p10", "p11"] },
        { id: "g2", title: "Dessert", count: 1, productIds: ["p15", "p16", "p17"] },
        { id: "g3", title: "Boisson", count: 1, productIds: ["p18", "p19", "p21"] },
      ],
    },
  ];
}

// transforme un menu (avec ses groupes de choix) en article commandable, affiché dans la catégorie "Menus"
function menuToProduct(menu, allProducts) {
  const groups = menu.groups || [];
  const allergens = Array.from(new Set(
    groups.flatMap((g) => g.productIds).map((id) => allProducts.find((p) => p.id === id)).filter(Boolean).flatMap((p) => p.allergens || [])
  ));
  return {
    id: `menu_${menu.id}`, cat: "menus", isMenu: true, menuId: menu.id, groups,
    name: menu.name, price: menu.price, emoji: menu.emoji || "📋", allergens,
    desc: menu.desc || (groups.length ? `${groups.map((g) => g.title).join(" + ")}, au choix` : "Menu à composer"),
  };
}

// positions libres pour le plan de salle (en %)
const TABLE_LAYOUT = [
  { number: 1, seats: 2, x: 8, y: 12 }, { number: 2, seats: 2, x: 24, y: 12 },
  { number: 3, seats: 4, x: 44, y: 10 }, { number: 4, seats: 4, x: 68, y: 10 },
  { number: 5, seats: 6, x: 88, y: 14 }, { number: 6, seats: 2, x: 8, y: 42 },
  { number: 7, seats: 4, x: 30, y: 44 }, { number: 8, seats: 4, x: 54, y: 42 },
  { number: 9, seats: 2, x: 76, y: 44 }, { number: 10, seats: 6, x: 14, y: 74 },
  { number: 11, seats: 4, x: 42, y: 76 }, { number: 12, seats: 8, x: 72, y: 74 },
];

const SERVERS = ["Léa", "Marco", "Inès"];
const uid = (p) => `${p}_${Math.random().toString(36).slice(2, 9)}`;

function randomProduct() { return PRODUCTS_SEED[Math.floor(Math.random() * PRODUCTS_SEED.length)]; }
function makeItem(status, notes) {
  const pr = randomProduct();
  return { id: uid("it"), productId: pr.id, name: pr.name, price: pr.price, qty: 1 + Math.floor(Math.random() * 2), notes: notes || "", status };
}

function seedTables() {
  return TABLE_LAYOUT.map((t) => ({
    id: uid("tbl"), number: t.number, seats: t.seats, x: t.x, y: t.y,
    reserved: false, alert: false,
    reservationName: "", reservationPeople: "", reservationTime: "", reservationNote: "",
  }));
}

function seedOrders(tables) {
  const now = Date.now();
  const orders = [];
  // table 3 : commande envoyée, en préparation
  orders.push({
    id: uid("ord"), tableId: tables[2].id, server: "Léa", createdAt: now - 8 * 60000,
    items: [makeItem("preparing", "sans oignons"), makeItem("preparing"), makeItem("preparing")],
  });
  // table 5 : nouvelle commande
  orders.push({
    id: uid("ord"), tableId: tables[4].id, server: "Marco", createdAt: now - 2 * 60000,
    items: [makeItem("new"), makeItem("new", "cuisson saignante"), makeItem("new")],
  });
  // table 8 : prête
  orders.push({
    id: uid("ord"), tableId: tables[7].id, server: "Inès", createdAt: now - 14 * 60000,
    items: [makeItem("ready"), makeItem("ready")],
  });
  // table 10 : mixte (une partie déjà servie, une en préparation) + alerte
  tables[9].alert = true;
  orders.push({
    id: uid("ord"), tableId: tables[9].id, server: "Léa", createdAt: now - 20 * 60000,
    items: [makeItem("served"), makeItem("served"), makeItem("preparing", "allergie fruits à coque")],
  });
  tables[1].reserved = true;
  tables[1].reservationName = "Famille Dubois";
  tables[1].reservationPeople = 2;
  tables[1].reservationTime = "20:30";
  tables[10].reserved = true;
  tables[10].reservationName = "M. Bertrand";
  tables[10].reservationPeople = 4;
  tables[10].reservationTime = "21:00";
  return orders;
}

function seedHistory() {
  // commandes terminées sur les 6 derniers jours pour le dashboard
  const days = 6;
  const out = [];
  for (let d = days; d >= 0; d--) {
    const dayStart = Date.now() - d * 86400000;
    const nOrders = 14 + Math.floor(Math.random() * 10);
    for (let i = 0; i < nOrders; i++) {
      const items = Array.from({ length: 1 + Math.floor(Math.random() * 4) }, () => makeItem("served"));
      out.push({
        id: uid("hist"), createdAt: dayStart - Math.random() * 8 * 3600000,
        server: SERVERS[Math.floor(Math.random() * SERVERS.length)], items,
        total: items.reduce((s, it) => s + it.price * it.qty, 0),
      });
    }
  }
  return out;
}

/* ============================================================
   UTILITAIRES
   ============================================================ */

const money = (n) => n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";

function elapsed(ts, now) {
  const m = Math.max(0, Math.floor((now - ts) / 60000));
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  return `il y a ${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`;
}

function orderTotal(order) {
  return order.items.reduce((s, it) => s + it.price * it.qty, 0);
}

// horodatage de référence pour le timer cuisine d'une commande : l'envoi en cuisine
function kitchenStartTs(order) {
  return order.sentAt || order.createdAt;
}

// formate une durée en millisecondes en "MM:SS" (basé sur un timestamp réel, pas un compteur qui se réinitialise)
function formatTimer(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// niveaux visuels du timer cuisine selon le temps écoulé
const TIMER_LEVELS = {
  normal: { color: "#4A7856", bg: "#4A785618", label: "normal" },
  warning: { color: "#D9A441", bg: "#D9A44120", label: "attente" },
  critical: { color: "#C1361B", bg: "#C1361B22", label: "retard" },
};
function timerLevel(elapsedMs) {
  const min = elapsedMs / 60000;
  if (min >= 15) return "critical";
  if (min >= 8) return "warning";
  return "normal";
}

// disponibilité d'un produit : absence du champ = disponible par défaut
function isAvailable(product) {
  return !product || product.available !== false;
}

// détecte si une note de commande signale une allergie (mots-clés explicites, sans en inventer le contenu)
function noteIndicatesAllergy(notes) {
  if (!notes) return false;
  return /allerg/i.test(notes);
}

function orderKitchenStatus(order) {
  const statuses = order.items.map((i) => i.status).filter((s) => s !== "draft" && s !== "served");
  if (statuses.length === 0) return "done";
  if (statuses.includes("new")) return "new";
  if (statuses.includes("preparing")) return "preparing";
  if (statuses.every((s) => s === "ready")) return "ready";
  return "done";
}

function tableStatus(table, order) {
  if (order) {
    const hasDraft = order.items.some((i) => i.status === "draft");
    const hasSent = order.items.some((i) => i.status !== "draft" && i.status !== "served");
    const hasReady = order.items.some((i) => i.status === "ready");
    const allServed = order.items.length > 0 && order.items.every((i) => i.status === "served");
    if (table.alert) return "alert";
    if (allServed) return "occupied";
    if (hasReady) return "ready";
    if (hasSent) return "sent";
    if (hasDraft) return "occupied";
  }
  if (table.alert) return "alert";
  if (table.reserved) return "reserved";
  return "free";
}

const STATUS_META = {
  free: { label: "Disponible", color: "#4A7856", dot: "🟢" },
  occupied: { label: "Commande en cours", color: "#D9A441", dot: "🟠" },
  sent: { label: "Envoyée en cuisine", color: "#3E7CB1", dot: "🔵" },
  ready: { label: "Prête à servir", color: "#2E9E5B", dot: "🟢" },
  alert: { label: "Attention", color: "#C1361B", dot: "🔴" },
  reserved: { label: "Réservée", color: "#8A8378", dot: "⚪" },
};

/* ============================================================
   STYLE GLOBAL
   ============================================================ */

function GlobalStyle() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Archivo+Black&family=Libre+Franklin:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap');

      .rf-root { font-family: 'Libre Franklin', system-ui, sans-serif; }
      .rf-display { font-family: 'Fraunces', serif; }
      .rf-mono { font-family: 'IBM Plex Mono', monospace; }
      .rf-black { font-family: 'Archivo Black', sans-serif; }

      .rf-light { background: #FAF6EE; color: #2B2622; }
      .rf-dark { background: #14110D; color: #F2ECDD; }

      @keyframes rf-pop { 0% { transform: scale(.92); opacity: 0 } 100% { transform: scale(1); opacity: 1 } }
      @keyframes rf-slideticket { 0% { transform: translateY(-14px) rotate(-1deg); opacity: 0 } 100% { transform: translateY(0) rotate(0); opacity: 1 } }
      @keyframes rf-pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(46,158,91,.5) } 50% { box-shadow: 0 0 0 8px rgba(46,158,91,0) } }
      @keyframes rf-toastin { 0% { transform: translateX(24px); opacity: 0 } 100% { transform: translateX(0); opacity: 1 } }
      @keyframes rf-flash { 0%, 100% { outline-color: rgba(193,54,27,.9) } 50% { outline-color: rgba(193,54,27,.2) } }

      .rf-anim-pop { animation: rf-pop .25s ease-out; }
      .rf-anim-ticket { animation: rf-slideticket .35s cubic-bezier(.2,.8,.3,1); }
      .rf-anim-toast { animation: rf-toastin .3s ease-out; }
      .rf-pulse-ready { animation: rf-pulse 1.8s infinite; }
      .rf-flash-alert { animation: rf-flash 1.4s infinite; outline: 2px solid; outline-offset: 2px; }

      .rf-ticket {
        background: #F5EFDF;
        color: #23201A;
        clip-path: polygon(0% 0%,4% 3%,8% 0%,12% 3%,16% 0%,20% 3%,24% 0%,28% 3%,32% 0%,36% 3%,40% 0%,44% 3%,48% 0%,52% 3%,56% 0%,60% 3%,64% 0%,68% 3%,72% 0%,76% 3%,80% 0%,84% 3%,88% 0%,92% 3%,96% 0%,100% 0%,100% 100%,0% 100%);
        padding-top: 18px;
      }

      .rf-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
      .rf-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,.15); border-radius: 8px; }
      .rf-dark .rf-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,.15); }

      .rf-tap { transition: transform .12s ease, box-shadow .12s ease; }
      .rf-tap:active { transform: scale(.97); }

      @keyframes rf-timerblink { 0%, 100% { opacity: 1 } 50% { opacity: .55 } }
      .rf-timer-critical { animation: rf-timerblink 1s infinite; }

      @media print {
        body * { visibility: hidden; }
        #rf-print-receipt, #rf-print-receipt * { visibility: visible; }
        #rf-print-receipt { position: fixed; inset: 0; margin: 0; padding: 22px; background: #fff; }
      }
    `}</style>
  );
}

/* ============================================================
   SONS
   ============================================================ */

function useBeep() {
  const ctxRef = useRef(null);
  return useCallback((freq = 720) => {
    try {
      if (!ctxRef.current) ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const ctx = ctxRef.current;
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = "sine"; o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
      o.connect(g); g.connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime + 0.36);
    } catch (e) { /* audio indisponible */ }
  }, []);
}

// Mesure la largeur réelle du conteneur (et pas de la fenêtre) pour s'adapter
// même intégré dans un iframe/chat étroit — sert de base au mode "téléphone".
function useContainerWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(1024);
  useEffect(() => {
    if (!ref.current || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) setWidth(entry.contentRect.width);
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

/* ============================================================
   APP
   ============================================================ */

export default function App() {
  const [rootRef, containerWidth] = useContainerWidth();
  const isMobile = containerWidth < 640;
  const [tables, setTables] = useState(seedTables);
  const [orders, setOrders] = useState(() => seedOrders(tables));
  const [history, setHistory] = useState(seedHistory);
  const [products, setProducts] = useState(PRODUCTS_SEED);
  const [menus, setMenus] = useState(seedMenus);
  const [role, setRole] = useState("serveur"); // serveur | cuisine | dashboard | gestion
  const [serverView, setServerView] = useState("plan"); // plan | commande
  const [cuisineView, setCuisineView] = useState("board"); // board | table
  const [gestionView, setGestionView] = useState("tables"); // tables | produits | menus

  const combinedProducts = useMemo(
    () => [...products, ...menus.map((m) => menuToProduct(m, products))],
    [products, menus]
  );
  const [activeTableId, setActiveTableId] = useState(null);
  const [currentServer] = useState("Léa");
  const [now, setNow] = useState(Date.now());
  const [toasts, setToasts] = useState([]);
  const [soundOn, setSoundOn] = useState(true);
  const beep = useBeep();
  const prevKitchenNew = useRef(new Set());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const pushToast = useCallback((text, kind) => {
    const id = uid("toast");
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000);
  }, []);

  // détecte automatiquement les nouvelles commandes envoyées -> notifie + bip cuisine
  useEffect(() => {
    const newSet = new Set(orders.filter((o) => o.items.some((i) => i.status === "new")).map((o) => o.id));
    for (const id of newSet) {
      if (!prevKitchenNew.current.has(id)) {
        const o = orders.find((x) => x.id === id);
        const table = tables.find((t) => t.id === o.tableId);
        if (table) {
          pushToast(`🔔 Nouvelle commande — Table ${table.number}`, "kitchen");
          if (soundOn) beep(760);
        }
      }
    }
    prevKitchenNew.current = newSet;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders]);

  const getActiveOrder = useCallback((tableId) => orders.find((o) => o.tableId === tableId), [orders]);

  const updateOrder = (orderId, fn) => {
    setOrders((prev) => prev.map((o) => (o.id === orderId ? fn(o) : o)));
  };

  const ensureOrderForTable = useCallback((tableId) => {
    let order = getActiveOrder(tableId);
    if (!order) {
      order = { id: uid("ord"), tableId, server: currentServer, createdAt: Date.now(), items: [] };
      setOrders((prev) => [...prev, order]);
    }
    return order;
  }, [getActiveOrder, currentServer]);

  const openTable = (table) => {
    setActiveTableId(table.id);
    ensureOrderForTable(table.id);
    setServerView("commande");
  };

  const addProductToOrder = (tableId, product) => {
    const order = ensureOrderForTable(tableId);
    setOrders((prev) => prev.map((o) => {
      if (o.id !== order.id) return o;
      const existing = o.items.find((i) => i.productId === product.id && i.status === "draft" && !i.notes);
      if (existing) {
        return { ...o, items: o.items.map((i) => i.id === existing.id ? { ...i, qty: i.qty + 1 } : i) };
      }
      return { ...o, items: [...o.items, { id: uid("it"), productId: product.id, name: product.name, price: product.price, qty: 1, notes: "", status: "draft" }] };
    }));
  };

  // ajoute un menu à choix multiples déjà composé (une entrée choisie, un plat choisi, etc.)
  const addComposedMenuToOrder = (tableId, menuProduct, composition) => {
    const order = ensureOrderForTable(tableId);
    setOrders((prev) => prev.map((o) => {
      if (o.id !== order.id) return o;
      return {
        ...o, items: [...o.items, {
          id: uid("it"), productId: menuProduct.id, name: menuProduct.name, price: menuProduct.price,
          qty: 1, notes: "", status: "draft", isMenu: true, composition,
        }],
      };
    }));
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
    updateOrder(orderId, (o) => ({ ...o, items: o.items.map((i) => i.id === itemId ? { ...i, notes: note } : i) }));
  };

  const sendToKitchen = (orderId) => {
    updateOrder(orderId, (o) => ({ ...o, sentAt: Date.now(), items: o.items.map((i) => i.status === "draft" ? { ...i, status: "new" } : i) }));
    setServerView("plan");
  };

  const startPrep = (orderId) => {
    updateOrder(orderId, (o) => ({ ...o, items: o.items.map((i) => i.status === "new" ? { ...i, status: "preparing" } : i) }));
  };

  const markReady = (orderId) => {
    let tableNum = null;
    setOrders((prev) => prev.map((o) => {
      if (o.id !== orderId) return o;
      const t = tables.find((tt) => tt.id === o.tableId);
      tableNum = t?.number;
      return { ...o, items: o.items.map((i) => i.status === "preparing" ? { ...i, status: "ready" } : i) };
    }));
    if (tableNum) { pushToast(`🔔 Commande de la Table ${tableNum} prête`, "server"); if (soundOn) beep(980); }
  };

  const serveAndMaybeFree = (orderId) => {
    updateOrder(orderId, (o) => ({ ...o, items: o.items.map((i) => i.status === "ready" ? { ...i, status: "served" } : i) }));
  };

  const clearTable = (tableId) => {
    setOrders((prev) => prev.filter((o) => o.tableId !== tableId));
    setTables((prev) => prev.map((t) => t.id === tableId ? { ...t, alert: false } : t));
  };

  // encaissement réel : archive la commande payée dans l'historique, génère un ticket de caisse
  // et libère la table — la commande n'est jamais supprimée définitivement.
  const checkoutOrder = (orderId, paymentMethod) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return null;
    const table = tables.find((t) => t.id === order.tableId);
    const paidItems = order.items.filter((i) => i.status !== "draft");
    const total = paidItems.reduce((s, i) => s + i.price * i.qty, 0);
    const paidAt = Date.now();
    const receipt = {
      id: uid("rcpt"), orderId: order.id, tableNumber: table?.number,
      server: order.server, items: paidItems, total, paymentMethod, paidAt,
    };
    setHistory((prev) => [...prev, {
      id: uid("hist"), createdAt: paidAt, server: order.server, items: paidItems, total,
      tableNumber: table?.number, paymentMethod, orderId: order.id,
    }]);
    setOrders((prev) => prev.filter((o) => o.id !== orderId));
    setTables((prev) => prev.map((t) => t.id === order.tableId ? { ...t, alert: false } : t));
    return receipt;
  };

  const toggleAlert = (tableId) => {
    setTables((prev) => prev.map((t) => t.id === tableId ? { ...t, alert: !t.alert } : t));
  };

  // ---- Gestion : tables ----
  const tableHasActiveOrder = (tableId) => orders.some((o) => o.tableId === tableId);
  const addTable = (data) => {
    setTables((prev) => [...prev, { id: uid("tbl"), reserved: false, alert: false, x: 50, y: 50, ...data }]);
  };
  const updateTable = (id, data) => setTables((prev) => prev.map((t) => t.id === id ? { ...t, ...data } : t));
  const deleteTable = (id) => {
    if (tableHasActiveOrder(id)) { pushToast("Impossible de supprimer : commande en cours sur cette table", "kitchen"); return false; }
    setTables((prev) => prev.filter((t) => t.id !== id));
    return true;
  };

  // ---- Gestion : produits ----
  const addProduct = (data) => setProducts((prev) => [...prev, { id: uid("prod"), allergens: [], ...data }]);
  const updateProduct = (id, data) => setProducts((prev) => prev.map((p) => p.id === id ? { ...p, ...data } : p));
  const deleteProduct = (id) => setProducts((prev) => prev.filter((p) => p.id !== id));

  // ---- Gestion : menus ----
  const addMenu = (data) => setMenus((prev) => [...prev, { id: uid("menu"), groups: [], ...data }]);
  const updateMenu = (id, data) => setMenus((prev) => prev.map((m) => m.id === id ? { ...m, ...data } : m));
  const deleteMenu = (id) => setMenus((prev) => prev.filter((m) => m.id !== id));

  const activeTable = tables.find((t) => t.id === activeTableId);
  const activeOrder = activeTable ? getActiveOrder(activeTable.id) : null;

  return (
    <div ref={rootRef} className="rf-root w-full min-h-[720px] rounded-2xl overflow-hidden border border-black/10 shadow-xl" style={{ background: role === "cuisine" ? "#14110D" : "#FAF6EE" }}>
      <GlobalStyle />
      <TopNav role={role} setRole={(r) => { setRole(r); setServerView("plan"); setCuisineView("board"); }} soundOn={soundOn} setSoundOn={setSoundOn} isMobile={isMobile} />
      <ToastStack toasts={toasts} />

      {role === "serveur" && serverView === "plan" && (
        <FloorPlan tables={tables} orders={orders} now={now} onOpen={openTable} onToggleAlert={toggleAlert} isMobile={isMobile} />
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
          onCheckout={(method) => checkoutOrder(activeOrder.id, method)}
          onBackToPlan={() => setServerView("plan")}
          onToast={pushToast}
        />
      )}

      {role === "cuisine" && (
        <CuisineShell
          view={cuisineView} setView={setCuisineView}
          tables={tables} orders={orders} now={now} products={combinedProducts}
          onStart={startPrep} onReady={markReady}
        />
      )}

      {role === "dashboard" && <Dashboard history={history} orders={orders} tables={tables} />}

      {role === "gestion" && (
        <Gestion
          view={gestionView} setView={setGestionView}
          tables={tables} orders={orders}
          products={products} menus={menus}
          onAddTable={addTable} onUpdateTable={updateTable} onDeleteTable={deleteTable}
          onAddProduct={addProduct} onUpdateProduct={updateProduct} onDeleteProduct={deleteProduct}
          onAddMenu={addMenu} onUpdateMenu={updateMenu} onDeleteMenu={deleteMenu}
        />
      )}
    </div>
  );
}

/* ============================================================
   NAVIGATION
   ============================================================ */

function TopNav({ role, setRole, soundOn, setSoundOn, isMobile }) {
  const dark = role === "cuisine";
  const tabs = [
    { id: "serveur", label: "Serveur", icon: ClipboardList },
    { id: "cuisine", label: "Cuisine", icon: ChefHat },
    { id: "dashboard", label: "Dashboard", icon: BarChart3 },
    { id: "gestion", label: "Gestion", icon: Settings },
  ];

  if (isMobile) {
    return (
      <div className={`border-b ${dark ? "border-white/10" : "border-black/10"}`}>
        <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: "#C1440E" }}>
              <Utensils size={14} color="#FAF6EE" />
            </div>
            <span className={`rf-display text-base font-semibold tracking-tight ${dark ? "text-[#F2ECDD]" : "text-[#2B2622]"}`}>RestoFlow</span>
          </div>
          <button onClick={() => setSoundOn((s) => !s)} className={`rf-tap p-2 rounded-full ${dark ? "bg-white/5 text-[#F2ECDD]" : "bg-black/5 text-[#2B2622]"}`} title="Son des notifications">
            {soundOn ? <Volume2 size={15} /> : <VolumeX size={15} />}
          </button>
        </div>
        <div className={`grid grid-cols-4 gap-1 px-2 pb-2`}>
          {tabs.map((t) => {
            const Icon = t.icon; const active = role === t.id;
            return (
              <button key={t.id} onClick={() => setRole(t.id)}
                className="rf-tap flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-xl text-[10px] font-semibold"
                style={{
                  background: active ? (dark ? "#F2ECDD" : "#2B2622") : (dark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.05)"),
                  color: active ? (dark ? "#14110D" : "#FAF6EE") : (dark ? "#C9C2B0" : "#5B5346"),
                }}>
                <Icon size={16} /> {t.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-between px-5 py-3 border-b ${dark ? "border-white/10" : "border-black/10"}`}>
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#C1440E" }}>
          <Utensils size={16} color="#FAF6EE" />
        </div>
        <span className={`rf-display text-lg font-semibold tracking-tight ${dark ? "text-[#F2ECDD]" : "text-[#2B2622]"}`}>RestoFlow</span>
      </div>
      <div className={`flex gap-1 p-1 rounded-full ${dark ? "bg-white/5" : "bg-black/5"}`}>
        {tabs.map((t) => {
          const Icon = t.icon; const active = role === t.id;
          return (
            <button key={t.id} onClick={() => setRole(t.id)}
              className={`rf-tap flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium ${active ? "shadow-sm" : ""}`}
              style={{
                background: active ? (dark ? "#F2ECDD" : "#2B2622") : "transparent",
                color: active ? (dark ? "#14110D" : "#FAF6EE") : (dark ? "#C9C2B0" : "#5B5346"),
              }}>
              <Icon size={14} /> {t.label}
            </button>
          );
        })}
      </div>
      <button onClick={() => setSoundOn((s) => !s)} className={`rf-tap p-2 rounded-full ${dark ? "bg-white/5 text-[#F2ECDD]" : "bg-black/5 text-[#2B2622]"}`} title="Son des notifications">
        {soundOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
      </button>
    </div>
  );
}

function ToastStack({ toasts }) {
  return (
    <div className="fixed top-16 inset-x-2 sm:inset-x-auto sm:right-4 z-50 flex flex-col gap-2 items-stretch sm:items-end pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className="rf-anim-toast rf-mono text-xs font-semibold px-3.5 py-2.5 rounded-lg shadow-lg border text-center sm:text-left"
          style={{
            background: t.kind === "server" ? "#2E9E5B" : t.kind === "warn" ? "#C1361B" : "#2B2622",
            color: "#FAF6EE", borderColor: "rgba(255,255,255,.15)",
          }}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

/* ============================================================
   VUE SERVEUR — PLAN DE SALLE
   ============================================================ */

function FloorPlan({ tables, orders, now, onOpen, onToggleAlert, isMobile }) {
  if (isMobile) {
    return (
      <div className="p-3">
        <div className="mb-3">
          <h1 className="rf-display text-xl font-semibold text-[#2B2622]">Plan de salle</h1>
          <p className="text-xs text-[#6B6355]">Touchez une table pour ouvrir sa commande</p>
        </div>
        <div className="flex gap-1.5 overflow-x-auto rf-scrollbar pb-3 -mx-3 px-3">
          {Object.entries(STATUS_META).map(([k, v]) => (
            <span key={k} className="text-[10px] whitespace-nowrap px-2 py-1 rounded-full bg-black/5 text-[#5B5346]">{v.dot} {v.label}</span>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {tables.map((t) => {
            const order = orders.find((o) => o.tableId === t.id);
            const status = tableStatus(t, order);
            const meta = STATUS_META[status];
            const readyCount = order ? order.items.filter((i) => i.status === "ready").length : 0;
            return (
              <button key={t.id} onClick={() => onOpen(t)}
                onContextMenu={(e) => { e.preventDefault(); onToggleAlert(t.id); }}
                className={`rf-tap relative text-left rounded-2xl border-2 bg-white p-3 min-h-[104px] flex flex-col ${status === "alert" ? "rf-flash-alert" : ""} ${status === "ready" ? "rf-pulse-ready" : ""}`}
                style={{ borderColor: meta.color }}>
                {t.reserved && (
                  <span className="absolute -top-2 -right-2 flex items-center gap-0.5 text-[8px] font-extrabold px-1.5 py-0.5 rounded-full shadow" style={{ background: "#5B5346", color: "#FAF6EE" }}>
                    <Lock size={8} /> RÉSERVÉE
                  </span>
                )}
                <div className="flex items-center justify-between">
                  <span className="rf-black text-xl leading-none text-[#2B2622]">{t.number}</span>
                  <span className="text-base">{meta.dot}</span>
                </div>
                <span className="text-[11px] text-[#8A8378] flex items-center gap-1 mt-1"><Users size={11} />{t.seats} pers.</span>
                {t.reserved && t.reservationTime && (
                  <span className="text-[10px] text-[#5B5346] flex items-center gap-1"><CalendarClock size={10} />{t.reservationName || "Réservation"} · {t.reservationTime}</span>
                )}
                <span className="text-[11px] font-semibold mt-auto pt-1.5" style={{ color: meta.color }}>
                  {readyCount > 0 ? `${readyCount} prêt(s)` : meta.label}
                </span>
                {order && orderTotal(order) > 0 && (
                  <span className="text-[11px] font-bold text-[#2B2622]">{money(orderTotal(order))} · {elapsed(order.createdAt, now)}</span>
                )}
              </button>
            );
          })}
        </div>
        <p className="text-[10px] text-[#9A917E] text-center mt-3">Appui long sur une table pour signaler un problème</p>
      </div>
    );
  }

  return (
    <div className="p-5">
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <h1 className="rf-display text-2xl font-semibold text-[#2B2622]">Plan de salle</h1>
          <p className="text-sm text-[#6B6355]">Sélectionnez une table pour prendre ou consulter une commande</p>
        </div>
        <Legend />
      </div>
      <div className="relative rounded-2xl border border-[#E4DAC6]" style={{ height: 560, background: "repeating-linear-gradient(45deg, #F3EDDD, #F3EDDD 22px, #EFE7D2 22px, #EFE7D2 44px)" }}>
        {tables.map((t) => {
          const order = orders.find((o) => o.tableId === t.id);
          const status = tableStatus(t, order);
          const meta = STATUS_META[status];
          const size = t.seats <= 2 ? 78 : t.seats <= 4 ? 96 : 118;
          const shape = t.seats <= 4 ? "9999px" : "20px";
          return (
            <button key={t.id} onClick={() => onOpen(t)}
              className={`rf-tap absolute flex flex-col items-center justify-center border-2 shadow-md ${status === "alert" ? "rf-flash-alert" : ""} ${status === "ready" ? "rf-pulse-ready" : ""}`}
              style={{
                left: `${t.x}%`, top: `${t.y}%`, width: size, height: size, borderRadius: shape,
                background: "#FFFDF7", borderColor: meta.color,
              }}
              onContextMenu={(e) => { e.preventDefault(); onToggleAlert(t.id); }}
              title={t.reserved ? `Réservée${t.reservationName ? " — " + t.reservationName : ""}${t.reservationTime ? " à " + t.reservationTime : ""}` : "Clic droit : signaler / lever une alerte"}>
              <span className="rf-black text-lg leading-none text-[#2B2622]">{t.number}</span>
              <span className="text-[10px] text-[#8A8378] flex items-center gap-0.5 mt-0.5"><Users size={10} />{t.seats}</span>
              <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center text-[10px]" style={{ background: meta.color }}>
                <span style={{ filter: "grayscale(1) brightness(3)" }}>●</span>
              </span>
              {t.reserved && (
                <span className="absolute -top-2 -left-2 flex items-center gap-0.5 text-[8px] font-extrabold px-1.5 py-0.5 rounded-full shadow whitespace-nowrap" style={{ background: "#5B5346", color: "#FAF6EE" }}>
                  <Lock size={8} /> RÉSERVÉE
                </span>
              )}
              {order && orderTotal(order) > 0 && (
                <span className="absolute -bottom-6 text-[11px] font-semibold text-[#5B5346] whitespace-nowrap">{money(orderTotal(order))}</span>
              )}
              {order && order.createdAt && (
                <span className="absolute -bottom-[38px] text-[9px] text-[#9A917E] whitespace-nowrap flex items-center gap-0.5"><Clock size={8} />{elapsed(order.createdAt, now)}</span>
              )}
              {!order && t.reserved && (t.reservationName || t.reservationTime) && (
                <span className="absolute -bottom-[38px] text-[9px] text-[#5B5346] whitespace-nowrap flex items-center gap-0.5 font-semibold">
                  <CalendarClock size={8} />{t.reservationName || "Réservée"}{t.reservationTime ? ` · ${t.reservationTime}` : ""}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex gap-3 flex-wrap text-xs text-[#5B5346]">
      {Object.entries(STATUS_META).map(([k, v]) => (
        <span key={k} className="flex items-center gap-1"><span>{v.dot}</span>{v.label}</span>
      ))}
    </div>
  );
}

/* ============================================================
   VUE SERVEUR — PRISE DE COMMANDE
   ============================================================ */

function OrderTaking({ table, order, now, products, isMobile, onBack, onAdd, onAddComposedMenu, onQty, onRemove, onNote, onSend, onServe, onCheckout, onBackToPlan, onToast }) {
  const [activeCat, setActiveCat] = useState(CATEGORIES[0].id);
  const [query, setQuery] = useState("");
  const [noteFor, setNoteFor] = useState(null);
  const [confirmSend, setConfirmSend] = useState(false);
  const [mobileTab, setMobileTab] = useState("menu"); // menu | commande
  const [composerMenu, setComposerMenu] = useState(null);
  const [paying, setPaying] = useState(false);
  const [receipt, setReceipt] = useState(null);

  const items = order?.items || [];
  const draftItems = items.filter((i) => i.status === "draft");
  const sentItems = items.filter((i) => i.status !== "draft");
  const total = items.reduce((s, i) => s + i.price * i.qty, 0);
  const draftTotal = draftItems.reduce((s, i) => s + i.price * i.qty, 0);
  const hasReady = items.some((i) => i.status === "ready");
  const allServedNoDraft = items.length > 0 && items.every((i) => i.status === "served");

  const filtered = products.filter((p) =>
    (activeCat ? p.cat === activeCat : true) &&
    (query ? (p.name + p.desc).toLowerCase().includes(query.toLowerCase()) : true)
  );

  // un menu à choix multiples s'ouvre dans un composeur ; un produit simple s'ajoute directement
  const handleProductTap = (p) => {
    if (!isAvailable(p)) { onToast?.(`⛔ ${p.name} est en rupture de stock`, "warn"); return; }
    if (p.isMenu) setComposerMenu(p); else onAdd(p);
  };

  const menuPanel = (
    <div className="flex flex-col min-h-0 h-full">
      <div className="p-3 border-b border-black/10 flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2 bg-black/5 rounded-lg px-3 py-2">
          <Search size={15} className="text-[#8A8378]" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un produit…"
            className="bg-transparent outline-none text-sm flex-1 placeholder:text-[#9A917E]" />
        </div>
      </div>
      <div className="flex gap-1.5 px-3 py-2 overflow-x-auto rf-scrollbar border-b border-black/10">
        {CATEGORIES.map((c) => (
          <button key={c.id} onClick={() => setActiveCat(c.id)}
            className="rf-tap px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap"
            style={{ background: activeCat === c.id ? c.accent : "rgba(0,0,0,.05)", color: activeCat === c.id ? "#FAF6EE" : "#5B5346" }}>
            {c.name}
          </button>
        ))}
      </div>
      <div className={`flex-1 overflow-y-auto rf-scrollbar p-3 grid gap-3 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}>
        {filtered.map((p) => <ProductCard key={p.id} p={p} isMobile={isMobile} onTap={() => handleProductTap(p)} />)}
        {filtered.length === 0 && <p className={`text-sm text-[#9A917E] text-center py-8 ${isMobile ? "" : "col-span-2"}`}>Aucun produit trouvé.</p>}
      </div>
    </div>
  );

  const cartPanel = (
    <div className="flex flex-col min-h-0 h-full bg-[#FFFDF7]">
      <div className="flex-1 overflow-y-auto rf-scrollbar p-3 space-y-4">
        {sentItems.length > 0 && (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#8A8378] mb-1.5">Déjà envoyé</p>
            <div className="space-y-1.5">
              {sentItems.map((it) => <SentLine key={it.id} item={it} products={products} />)}
            </div>
          </div>
        )}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#8A8378] mb-1.5">{sentItems.length > 0 ? "Nouveaux articles" : "Commande"}</p>
          {draftItems.length === 0 && <p className="text-sm text-[#9A917E] py-4 text-center">Ajoutez des produits depuis le menu.</p>}
          <div className="space-y-2">
            {draftItems.map((it) => (
              <DraftItemRow key={it.id} item={it} isMobile={isMobile} products={products}
                noteOpen={noteFor === it.id}
                onToggleNote={() => setNoteFor(noteFor === it.id ? null : it.id)}
                onQty={(d) => onQty(it.id, d)}
                onRemove={() => onRemove(it.id)}
                onNote={(n) => { onNote(it.id, n); setNoteFor(null); }} />
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-black/10 p-3.5 space-y-2 bg-white">
        <div className="flex justify-between text-sm text-[#5B5346]"><span>Sous-total</span><span>{money(total)}</span></div>
        <div className="flex justify-between text-base font-bold text-[#2B2622]"><span>Total</span><span>{money(total)}</span></div>

        {hasReady && (
          <button onClick={onServe} className="rf-tap w-full py-2.5 rounded-xl font-semibold text-sm text-white" style={{ background: "#2E9E5B" }}>
            ✅ Marquer comme servi
          </button>
        )}

        {draftItems.length > 0 && !confirmSend && (
          <button onClick={() => setConfirmSend(true)} className="rf-tap w-full py-3.5 rounded-xl font-bold text-sm text-white shadow-md" style={{ background: "#C1440E" }}>
            ENVOYER EN CUISINE
          </button>
        )}
        {confirmSend && (
          <div className="rounded-xl border border-[#C1440E]/30 bg-[#C1440E]/5 p-3 space-y-2">
            <p className="text-xs font-semibold text-[#2B2622]">Confirmer l'envoi de {draftItems.length} article(s) en cuisine ?</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmSend(false)} className="rf-tap flex-1 py-2 rounded-lg text-xs font-semibold bg-black/5">Annuler</button>
              <button onClick={() => { onSend(); setConfirmSend(false); }} className="rf-tap flex-1 py-2 rounded-lg text-xs font-bold text-white" style={{ background: "#C1440E" }}>Confirmer</button>
            </div>
          </div>
        )}
        {allServedNoDraft && (
          <button onClick={() => setPaying(true)} className="rf-tap w-full py-2.5 rounded-xl font-semibold text-xs text-white flex items-center justify-center gap-1.5" style={{ background: "#2B2622" }}>
            <Receipt size={14} /> Encaisser &amp; libérer la table
          </button>
        )}
      </div>
    </div>
  );

  const composer = composerMenu && (
    <MenuComposer menu={composerMenu} products={products}
      onCancel={() => setComposerMenu(null)}
      onConfirm={(composition) => { onAddComposedMenu(composerMenu, composition); setComposerMenu(null); }} />
  );

  const paymentFlow = (
    <>
      {paying && order && (
        <PaymentModal
          order={order} table={table}
          onCancel={() => setPaying(false)}
          onConfirm={(method) => { const r = onCheckout(method); setPaying(false); setReceipt(r); }}
        />
      )}
      {receipt && (
        <ReceiptModal receipt={receipt} onClose={() => { setReceipt(null); onBackToPlan?.(); }} />
      )}
    </>
  );

  if (isMobile) {
    return (
      <div className="flex flex-col h-[640px]">
        <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-black/10">
          <button onClick={onBack} className="rf-tap p-2 rounded-full bg-black/5 shrink-0"><ArrowLeft size={16} /></button>
          <div className="min-w-0">
            <h2 className="rf-display text-base font-semibold text-[#2B2622] truncate">Table {table.number} · {table.seats} pers.</h2>
            <p className="text-[11px] text-[#6B6355]">{order ? `Ouverte ${elapsed(order.createdAt, now)}` : "Nouvelle commande"}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-1.5 px-3 py-2 border-b border-black/10">
          <button onClick={() => setMobileTab("menu")} className="rf-tap py-2 rounded-xl text-xs font-bold"
            style={{ background: mobileTab === "menu" ? "#2B2622" : "rgba(0,0,0,.05)", color: mobileTab === "menu" ? "#FAF6EE" : "#5B5346" }}>Menu</button>
          <button onClick={() => setMobileTab("commande")} className="rf-tap py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
            style={{ background: mobileTab === "commande" ? "#2B2622" : "rgba(0,0,0,.05)", color: mobileTab === "commande" ? "#FAF6EE" : "#5B5346" }}>
            Commande
            {items.length > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "#C1440E", color: "#FAF6EE" }}>{items.length}</span>}
          </button>
        </div>
        <div className="flex-1 min-h-0 relative">
          {mobileTab === "menu" ? menuPanel : cartPanel}
          {mobileTab === "menu" && draftItems.length > 0 && (
            <button onClick={() => setMobileTab("commande")}
              className="rf-tap absolute bottom-3 left-3 right-3 py-3 rounded-xl font-bold text-sm text-white shadow-lg flex items-center justify-between px-4"
              style={{ background: "#C1440E" }}>
              <span>{draftItems.length} article(s)</span>
              <span>Voir la commande · {money(draftTotal)}</span>
            </button>
          )}
        </div>
        {composer}
        {paymentFlow}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[640px]">
      <div className="flex items-center gap-3 px-5 py-3 border-b border-black/10">
        <button onClick={onBack} className="rf-tap p-2 rounded-full bg-black/5"><ArrowLeft size={16} /></button>
        <div>
          <h2 className="rf-display text-lg font-semibold text-[#2B2622]">Table {table.number} — {table.seats} personnes</h2>
          <p className="text-xs text-[#6B6355]">{order ? `Ouverte ${elapsed(order.createdAt, now)}` : "Nouvelle commande"}</p>
        </div>
      </div>
      <div className="flex flex-1 min-h-0">
        <div className="w-[62%] flex flex-col border-r border-black/10 min-h-0">{menuPanel}</div>
        <div className="w-[38%] flex flex-col min-h-0">{cartPanel}</div>
      </div>
      {composer}
      {paymentFlow}
    </div>
  );
}

function ProductCard({ p, isMobile, onTap }) {
  const cat = CATEGORIES.find((c) => c.id === p.cat);
  const available = isAvailable(p);
  return (
    <button onClick={onTap} className={`rf-tap rf-anim-pop relative text-left rounded-xl border bg-white ${isMobile ? "p-3.5" : "p-3"} flex gap-3 items-start ${available ? "border-black/10 hover:border-black/25" : "border-[#C1361B]/30"}`}
      style={{ opacity: available ? 1 : 0.6 }}>
      {!available && (
        <span className="absolute top-1.5 right-1.5 text-[8px] font-extrabold px-1.5 py-0.5 rounded-full flex items-center gap-0.5" style={{ background: "#C1361B", color: "#FFF7ED" }}>
          <Ban size={9} /> RUPTURE DE STOCK
        </span>
      )}
      <div className={`rounded-lg flex items-center justify-center shrink-0 ${isMobile ? "w-14 h-14 text-3xl" : "w-12 h-12 text-2xl"}`} style={{ background: (cat?.accent || "#999") + "22", filter: available ? "none" : "grayscale(1)" }}>{p.emoji}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-1">
          <span className={`font-semibold text-[#2B2622] leading-tight ${isMobile ? "text-[15px]" : "text-sm"}`}>
            {p.name}
            {p.isMenu && <span className="ml-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full align-middle" style={{ background: "#6B422622", color: "#6B4226" }}>MENU</span>}
          </span>
          {available && (
            <span className={`rounded-full bg-[#2B2622] text-[#FAF6EE] flex items-center justify-center shrink-0 ${isMobile ? "w-8 h-8" : "w-6 h-6"}`}>
              {p.isMenu ? <LayoutList size={isMobile ? 14 : 12} /> : <Plus size={isMobile ? 14 : 12} />}
            </span>
          )}
        </div>
        <p className={`text-[#8A8378] mt-0.5 leading-snug ${isMobile ? "text-xs" : "text-[11px]"}`}>{p.desc}</p>
        <div className="flex items-center justify-between mt-1.5">
          <span className={`font-bold text-[#2B2622] ${isMobile ? "text-sm" : "text-xs"}`}>{money(p.price)}</span>
          {p.allergens.length > 0 && <span className="text-[9px] text-[#B5451B]">{p.allergens.join(", ")}</span>}
        </div>
      </div>
    </button>
  );
}

function DraftItemRow({ item, isMobile, products, noteOpen, onToggleNote, onQty, onRemove, onNote }) {
  const isAllergy = noteIndicatesAllergy(item.notes);
  const product = products?.find((p) => p.id === item.productId);
  return (
    <div className="rf-anim-pop rounded-lg border border-black/10 bg-white p-2.5">
      {isAllergy && <AllergyBadge item={item} product={product} />}
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold text-[#2B2622] flex-1">{item.qty} × {item.name}</span>
        <button onClick={onRemove} className="text-[#B5451B] shrink-0 p-0.5"><X size={isMobile ? 16 : 14} /></button>
      </div>
      {item.isMenu && item.composition?.length > 0 && (
        <div className="mt-1 space-y-0.5">
          {item.composition.map((g, i) => (
            <p key={i} className="text-[11px] text-[#6B4226]">• {g.title} : {g.names.join(", ")}</p>
          ))}
        </div>
      )}
      {item.notes && !isAllergy && <p className="text-[11px] text-[#B5451B] mt-0.5 flex items-center gap-1"><StickyNote size={10} />{item.notes}</p>}
      <div className="flex items-center justify-between mt-1.5">
        <div className="flex items-center gap-1.5">
          <button onClick={() => onQty(-1)} className={`rf-tap rounded-full bg-black/5 flex items-center justify-center ${isMobile ? "w-8 h-8" : "w-6 h-6"}`}><Minus size={isMobile ? 14 : 11} /></button>
          <span className="text-xs font-semibold w-4 text-center">{item.qty}</span>
          <button onClick={() => onQty(1)} className={`rf-tap rounded-full bg-black/5 flex items-center justify-center ${isMobile ? "w-8 h-8" : "w-6 h-6"}`}><Plus size={isMobile ? 14 : 11} /></button>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onToggleNote} className="text-[10px] font-semibold text-[#3E7CB1]">Note</button>
          <span className="text-xs font-bold">{money(item.price * item.qty)}</span>
        </div>
      </div>
      {noteOpen && (
        <div className="mt-2 flex flex-wrap gap-1">
          {["Sans oignons", "Cuisson saignante", "Sauce à part", "Sans fromage", "Allergie"].map((s) => (
            <button key={s} onClick={() => onNote(s)} className="rf-tap text-[10px] px-2 py-1 rounded-full bg-black/5">{s}</button>
          ))}
          <input placeholder="Note libre…" defaultValue={item.notes}
            onKeyDown={(e) => { if (e.key === "Enter") onNote(e.currentTarget.value); }}
            className="text-[11px] px-2 py-1 rounded-full bg-black/5 outline-none flex-1 min-w-[100px]" />
        </div>
      )}
    </div>
  );
}

// composeur affiché quand un serveur ajoute un menu à choix multiples (une entrée au choix, un plat au choix, etc.)
function MenuComposer({ menu, products, onCancel, onConfirm }) {
  const groups = menu.groups || [];
  const [selections, setSelections] = useState(() => Object.fromEntries(groups.map((g) => [g.id, []])));

  const toggle = (group, productId) => {
    const product = products.find((p) => p.id === productId);
    if (!isAvailable(product)) return;
    setSelections((prev) => {
      const cur = prev[group.id] || [];
      if (cur.includes(productId)) return { ...prev, [group.id]: cur.filter((id) => id !== productId) };
      if (group.count === 1) return { ...prev, [group.id]: [productId] };
      if (cur.length >= group.count) return prev;
      return { ...prev, [group.id]: [...cur, productId] };
    });
  };

  const complete = groups.length > 0 && groups.every((g) => (selections[g.id]?.length || 0) === g.count);

  const confirm = () => {
    const composition = groups.map((g) => ({
      title: g.title,
      names: (selections[g.id] || []).map((id) => products.find((p) => p.id === id)?.name).filter(Boolean),
    }));
    onConfirm(composition);
  };

  return (
    <Modal title={`Composer : ${menu.name}`} onClose={onCancel} wide>
      <p className="text-xs text-[#8A8378] mb-3">{money(menu.price)} — sélectionnez un choix pour chaque étape du menu.</p>
      <div className="space-y-4 max-h-[380px] overflow-y-auto rf-scrollbar pr-1">
        {groups.map((g) => {
          const candidates = g.productIds.map((id) => products.find((p) => p.id === id)).filter(Boolean);
          const chosen = selections[g.id] || [];
          return (
            <div key={g.id}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold uppercase tracking-wide text-[#6B4226]">{g.title}</span>
                <span className="text-[10px] text-[#9A917E]">{chosen.length}/{g.count} sélectionné(s)</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {candidates.map((p) => {
                  const checked = chosen.includes(p.id);
                  const available = isAvailable(p);
                  return (
                    <button type="button" key={p.id} onClick={() => toggle(g, p.id)} disabled={!available}
                      className="rf-tap flex items-center gap-2 text-left px-2.5 py-2.5 rounded-lg border text-xs disabled:cursor-not-allowed"
                      style={{ borderColor: checked ? "#C1440E" : "rgba(0,0,0,.1)", background: checked ? "#C1440E12" : available ? "white" : "#00000006", opacity: available ? 1 : 0.55 }}>
                      <span className="w-4 h-4 rounded flex items-center justify-center shrink-0" style={{ background: checked ? "#C1440E" : "rgba(0,0,0,.08)" }}>
                        {checked && <Check size={11} color="white" />}
                      </span>
                      <span className="flex-1 truncate">{p.emoji} {p.name}</span>
                      {!available && <span className="text-[8px] font-extrabold shrink-0" style={{ color: "#C1361B" }}>RUPTURE</span>}
                    </button>
                  );
                })}
                {candidates.length === 0 && <p className="text-[11px] text-[#9A917E] col-span-2">Aucune option configurée pour cette étape (à définir dans Gestion → Menus).</p>}
                {candidates.length > 0 && candidates.every((p) => !isAvailable(p)) && (
                  <p className="text-[11px] font-semibold col-span-2" style={{ color: "#C1361B" }}>Aucune option disponible pour cette étape actuellement.</p>
                )}
              </div>
            </div>
          );
        })}
        {groups.length === 0 && <p className="text-sm text-[#9A917E] text-center py-6">Ce menu n'a pas encore d'étapes configurées.</p>}
      </div>
      <div className="flex gap-2 mt-4">
        <button onClick={onCancel} className="rf-tap flex-1 py-2.5 rounded-xl text-sm font-semibold bg-black/5">Annuler</button>
        <button disabled={!complete} onClick={confirm} className="rf-tap flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40" style={{ background: "#C1440E" }}>Ajouter à la commande</button>
      </div>
    </Modal>
  );
}

// badge d'alerte allergie — très visible, jamais une simple note grise
function AllergyBadge({ item, product, compact }) {
  const allergens = product?.allergens || [];
  return (
    <div className={`rounded-md font-extrabold uppercase tracking-wide flex flex-col gap-0.5 mb-1.5 ${compact ? "px-2 py-1 text-[10px]" : "px-2.5 py-1.5 text-[11px]"}`}
      style={{ background: "#C1361B", color: "#FFF7ED" }}>
      <span className="flex items-center gap-1"><AlertTriangle size={compact ? 11 : 13} /> ⚠ ALLERGIE{allergens.length ? ` — ${allergens.join(", ")}` : ""}</span>
      {item?.notes && <span className="font-semibold normal-case tracking-normal opacity-90">{item.notes}</span>}
    </div>
  );
}

function SentLine({ item, products }) {
  const meta = { new: { l: "à envoyer ✓ envoyé", c: "#D9A441" }, preparing: { l: "en préparation", c: "#3E7CB1" }, ready: { l: "prêt", c: "#2E9E5B" }, served: { l: "servi", c: "#8A8378" } }[item.status];
  const icon = item.status === "served" ? "✅" : item.status === "ready" ? "🟢" : item.status === "preparing" ? "🟠" : "⚪";
  const isAllergy = noteIndicatesAllergy(item.notes);
  const product = products?.find((p) => p.id === item.productId);
  return (
    <div className="bg-black/[.03] rounded-lg px-2.5 py-1.5">
      {isAllergy && <AllergyBadge item={item} product={product} compact />}
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-[#5B5346]">{icon} {item.qty} × {item.name}{item.notes && !isAllergy ? ` (${item.notes})` : ""}</span>
        <span className="font-semibold shrink-0 ml-2" style={{ color: meta.c }}>{meta.l}</span>
      </div>
      {item.isMenu && item.composition?.length > 0 && (
        <div className="mt-1 pl-5 space-y-0.5">
          {item.composition.map((g, i) => <p key={i} className="text-[10px] text-[#8A8378]">• {g.title} : {g.names.join(", ")}</p>)}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   ENCAISSEMENT — Paiement & ticket de caisse
   ============================================================ */

const PAYMENT_METHODS = [
  { id: "carte", label: "Carte", icon: CreditCard },
  { id: "especes", label: "Espèces", icon: Banknote },
  { id: "autre", label: "Autre", icon: Wallet },
];

function PaymentModal({ order, table, onCancel, onConfirm }) {
  const [method, setMethod] = useState(null);
  const items = order.items.filter((i) => i.status !== "draft");
  const total = items.reduce((s, i) => s + i.price * i.qty, 0);

  return (
    <Modal title={`Encaissement — Table ${table.number}`} onClose={onCancel} wide>
      <div className="space-y-1 max-h-[280px] overflow-y-auto rf-scrollbar mb-3 pr-1">
        <div className="grid grid-cols-[1fr_60px_70px_70px] gap-2 text-[10px] font-bold uppercase tracking-wide text-[#8A8378] px-1 pb-1">
          <span>Article</span><span className="text-center">Qté</span><span className="text-right">P.U.</span><span className="text-right">Total</span>
        </div>
        {items.map((it) => (
          <div key={it.id} className="rounded-lg border border-black/5 bg-black/[.02] px-2.5 py-2">
            <div className="grid grid-cols-[1fr_60px_70px_70px] gap-2 items-center text-sm">
              <span className="font-semibold text-[#2B2622] truncate">{it.name}</span>
              <span className="text-center text-[#5B5346]">{it.qty}</span>
              <span className="text-right text-[#5B5346]">{money(it.price)}</span>
              <span className="text-right font-bold text-[#2B2622]">{money(it.price * it.qty)}</span>
            </div>
            {it.notes && (
              <p className={`text-[11px] mt-1 ${noteIndicatesAllergy(it.notes) ? "font-extrabold" : "text-[#8A8378]"}`} style={noteIndicatesAllergy(it.notes) ? { color: "#C1361B" } : undefined}>
                {noteIndicatesAllergy(it.notes) ? "⚠ ALLERGIE — " : "↳ "}{it.notes}
              </p>
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-between text-base font-bold text-[#2B2622] py-2 border-t border-black/10 mb-4">
        <span>Total à payer</span><span>{money(total)}</span>
      </div>
      <p className="text-xs font-semibold text-[#6B6355] mb-2">Moyen de paiement</p>
      <div className="grid grid-cols-3 gap-2 mb-4">
        {PAYMENT_METHODS.map((m) => {
          const Icon = m.icon; const selected = method === m.id;
          return (
            <button key={m.id} onClick={() => setMethod(m.id)}
              className="rf-tap flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl border-2 text-xs font-semibold"
              style={{ borderColor: selected ? "#C1440E" : "rgba(0,0,0,.1)", background: selected ? "#C1440E12" : "white", color: selected ? "#C1440E" : "#5B5346" }}>
              <Icon size={18} /> {m.label}
            </button>
          );
        })}
      </div>
      <div className="flex gap-2">
        <button onClick={onCancel} className="rf-tap flex-1 py-2.5 rounded-xl text-sm font-semibold bg-black/5">Annuler</button>
        <button disabled={!method} onClick={() => onConfirm(method)} className="rf-tap flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40" style={{ background: "#2B2622" }}>
          Confirmer le paiement
        </button>
      </div>
    </Modal>
  );
}

function ReceiptModal({ receipt, onClose }) {
  const date = new Date(receipt.paidAt);
  const methodLabel = { carte: "Carte bancaire", especes: "Espèces", autre: "Autre" }[receipt.paymentMethod] || receipt.paymentMethod;
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-6" onClick={onClose}>
      <div className="rf-anim-pop bg-white rounded-2xl w-full max-w-sm max-h-[85vh] overflow-y-auto rf-scrollbar shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div id="rf-print-receipt" className="rf-ticket p-5">
          <div className="text-center mb-3">
            <p className="rf-black text-lg tracking-wide">RESTOFLOW</p>
            <p className="text-[10px] opacity-70">Ticket de caisse</p>
          </div>
          <div className="rf-mono text-[11px] space-y-0.5 mb-2">
            <div className="flex justify-between"><span>Table</span><span>{receipt.tableNumber ?? "—"}</span></div>
            <div className="flex justify-between"><span>Commande</span><span>#{receipt.orderId.slice(-4).toUpperCase()}</span></div>
            <div className="flex justify-between"><span>Date</span><span>{date.toLocaleDateString("fr-FR")}</span></div>
            <div className="flex justify-between"><span>Heure</span><span>{date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span></div>
            <div className="flex justify-between"><span>Serveur</span><span>{receipt.server}</span></div>
          </div>
          <div className="border-t border-dashed border-black/30 my-2" />
          <div className="space-y-1">
            {receipt.items.map((it) => (
              <div key={it.id} className="rf-mono text-[12px]">
                <div className="flex justify-between gap-2">
                  <span className="flex-1">{it.qty} × {it.name}</span>
                  <span>{money(it.price * it.qty)}</span>
                </div>
                <div className="flex justify-between text-[10px] opacity-60">
                  <span>{money(it.price)} / unité</span>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-dashed border-black/30 my-2" />
          <div className="rf-mono text-[11px] flex justify-between opacity-80"><span>Sous-total</span><span>{money(receipt.total)}</span></div>
          <div className="rf-mono text-[14px] flex justify-between font-bold mt-1"><span>TOTAL TTC</span><span>{money(receipt.total)}</span></div>
          <div className="rf-mono text-[11px] flex justify-between opacity-80 mt-1.5"><span>Paiement</span><span>{methodLabel}</span></div>
          <p className="text-center text-xs mt-4 opacity-80">Merci et à bientôt !</p>
        </div>
        <div className="p-4 border-t border-black/10 flex gap-2">
          <button onClick={onClose} className="rf-tap flex-1 py-2.5 rounded-xl text-sm font-semibold bg-black/5">Fermer</button>
          <button onClick={() => window.print()} className="rf-tap flex-1 py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-1.5" style={{ background: "#C1440E" }}>
            <Printer size={15} /> Imprimer le ticket
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   VUE CUISINE
   ============================================================ */

function CuisineShell({ view, setView, tables, orders, now, products, onStart, onReady }) {
  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="rf-display text-2xl font-semibold text-[#F2ECDD]">Écran cuisine</h1>
          <p className="text-sm text-[#9A917E]">Suivi des commandes en temps réel</p>
        </div>
        <div className="flex gap-1 p-1 rounded-full bg-white/5">
          {[{ id: "board", label: "Commandes", icon: LayoutGrid }, { id: "table", label: "Par table", icon: Table2 }].map((t) => {
            const Icon = t.icon; const active = view === t.id;
            return (
              <button key={t.id} onClick={() => setView(t.id)} className="rf-tap flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium"
                style={{ background: active ? "#F2ECDD" : "transparent", color: active ? "#14110D" : "#C9C2B0" }}>
                <Icon size={14} /> {t.label}
              </button>
            );
          })}
        </div>
      </div>
      {view === "board" ? <KitchenBoard tables={tables} orders={orders} now={now} products={products} onStart={onStart} onReady={onReady} /> : <KitchenByTable tables={tables} orders={orders} now={now} products={products} />}
    </div>
  );
}

const KDS_COLS = [
  { key: "new", title: "Nouvelles", color: "#D9A441", icon: "🟡" },
  { key: "preparing", title: "En préparation", color: "#3E7CB1", icon: "🔵" },
  { key: "ready", title: "Prêtes", color: "#2E9E5B", icon: "🟢" },
];

function KitchenBoard({ tables, orders, now, products, onStart, onReady }) {
  const grouped = { new: [], preparing: [], ready: [] };
  orders.forEach((o) => {
    const st = orderKitchenStatus(o);
    if (grouped[st]) grouped[st].push(o);
  });

  return (
    <div className="grid grid-cols-3 gap-4" style={{ minHeight: 520 }}>
      {KDS_COLS.map((col) => (
        <div key={col.key} className="rounded-2xl bg-white/[.03] border border-white/10 p-3 flex flex-col">
          <div className="flex items-center gap-2 mb-3 px-1">
            <span>{col.icon}</span>
            <span className="rf-black text-sm tracking-wide" style={{ color: col.color }}>{col.title}</span>
            <span className="ml-auto rf-mono text-xs text-[#9A917E]">{grouped[col.key].length}</span>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto rf-scrollbar pr-1">
            {grouped[col.key].length === 0 && <p className="text-xs text-[#5B5346] text-center py-6">Aucune commande</p>}
            {grouped[col.key].map((o) => {
              const table = tables.find((t) => t.id === o.tableId);
              return (
                <KitchenTicket key={o.id} order={o} table={table} now={now} column={col.key} products={products}
                  onStart={() => onStart(o.id)} onReady={() => onReady(o.id)} />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// timer de ticket basé sur le vrai timestamp d'envoi en cuisine (pas un compteur qui se réinitialise au re-render)
function TicketTimer({ startTs, now, ready }) {
  const elapsedMs = now - startTs;
  const level = timerLevel(elapsedMs);
  const meta = TIMER_LEVELS[level];
  return (
    <span
      className={`rf-mono inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold text-[12px] ${level === "critical" && !ready ? "rf-timer-critical" : ""}`}
      style={{ background: ready ? "#2E9E5B22" : meta.bg, color: ready ? "#2E9E5B" : meta.color }}>
      <Clock size={11} /> {formatTimer(elapsedMs)}
    </span>
  );
}

function KitchenTicket({ order, table, now, column, products, onStart, onReady }) {
  const visibleItems = order.items.filter((i) => i.status !== "draft" && i.status !== "served");
  const startTs = kitchenStartTs(order);
  const elapsedMs = now - startTs;
  const level = timerLevel(elapsedMs);
  const ready = column === "ready";
  return (
    <div className={`rf-ticket rf-anim-ticket rounded-sm shadow-lg p-3.5 ${level === "critical" && !ready ? "ring-2 ring-[#C1361B]" : ""}`}>
      <div className="rf-mono flex items-center justify-between mb-1">
        <span className="font-bold text-sm">TABLE {table?.number ?? "?"}</span>
        <span className="text-[10px] opacity-60">#{order.id.slice(-4).toUpperCase()}</span>
      </div>
      <div className="flex items-center gap-2 mb-2">
        <TicketTimer startTs={startTs} now={now} ready={ready} />
        <span className="rf-mono text-[11px] opacity-70">{order.server}</span>
        {level === "critical" && !ready && <span className="ml-auto text-[#C1361B] font-bold flex items-center gap-0.5 text-[11px]"><Flame size={12} />RETARD</span>}
        {ready && <span className="ml-auto text-[#2E9E5B] font-bold flex items-center gap-1 text-[11px]"><CheckCircle2 size={13} />PRÊT</span>}
      </div>
      <div className="border-t border-dashed border-black/20 my-2" />
      <div className="space-y-1.5">
        {visibleItems.map((it) => {
          const isAllergy = noteIndicatesAllergy(it.notes);
          const product = products?.find((p) => p.id === it.productId);
          return (
            <div key={it.id} className="rf-mono text-[12.5px]">
              {isAllergy && <AllergyBadge item={it} product={product} compact />}
              <div className="font-semibold">{it.qty} × {it.name}</div>
              {it.notes && !isAllergy && <div className="text-[11px] opacity-70 pl-3">↳ {it.notes}</div>}
            </div>
          );
        })}
      </div>
      <div className="border-t border-dashed border-black/20 my-2.5" />
      {column === "new" && (
        <button onClick={onStart} className="rf-tap w-full py-2 rounded font-bold text-xs text-white" style={{ background: "#3E7CB1" }}>COMMENCER</button>
      )}
      {column === "preparing" && (
        <button onClick={onReady} className="rf-tap w-full py-2 rounded font-bold text-xs text-white" style={{ background: "#2E9E5B" }}>PRÊT</button>
      )}
      {column === "ready" && (
        <div className="text-center text-[11px] font-semibold text-[#2E9E5B] flex items-center justify-center gap-1"><CheckCircle2 size={13} /> En attente du serveur</div>
      )}
    </div>
  );
}

function KitchenByTable({ tables, orders, now, products }) {
  const [openId, setOpenId] = useState(null);
  const open = tables.find((t) => t.id === openId);
  const openOrder = orders.find((o) => o.tableId === openId);

  return (
    <div>
      <div className="grid grid-cols-4 gap-3">
        {tables.map((t) => {
          const order = orders.find((o) => o.tableId === t.id);
          const status = tableStatus(t, order);
          const meta = STATUS_META[status];
          const readyCount = order ? order.items.filter((i) => i.status === "ready").length : 0;
          const total = order ? order.items.filter(i=>i.status!=="draft").length : 0;
          return (
            <button key={t.id} onClick={() => setOpenId(t.id)} className="rf-tap text-left rounded-xl bg-white/[.04] border border-white/10 p-3.5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="rf-black text-base">TABLE {t.number}</span>
                <span>{meta.dot}</span>
              </div>
              <div className="text-[11px] text-[#9A917E] flex items-center gap-1 mb-1"><Users size={10} />{t.seats} pers.</div>
              {order ? (
                <>
                  <div className="text-xs text-[#C9C2B0]">#{order.id.slice(-4).toUpperCase()} · {total} produit(s)</div>
                  <div className="text-xs font-semibold mt-1" style={{ color: meta.color }}>
                    {readyCount > 0 ? `${readyCount} produit(s) prêt(s)` : meta.label}
                  </div>
                </>
              ) : <div className="text-xs text-[#5B5346] mt-1">{meta.label}</div>}
            </button>
          );
        })}
      </div>

      {open && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-6" onClick={() => setOpenId(null)}>
          <div className="rf-ticket rf-anim-pop rounded-sm p-5 w-full max-w-md max-h-[80vh] overflow-y-auto rf-scrollbar" onClick={(e) => e.stopPropagation()}>
            <div className="rf-mono flex items-center justify-between mb-2">
              <span className="font-bold text-lg">TABLE {open.number}</span>
              <button onClick={() => setOpenId(null)}><X size={18} /></button>
            </div>
            {openOrder ? (
              <>
                <div className="rf-mono text-xs opacity-70 mb-1">Commande #{openOrder.id.slice(-4).toUpperCase()} · serveur {openOrder.server}</div>
                <div className="mb-2"><TicketTimer startTs={kitchenStartTs(openOrder)} now={now} ready={orderKitchenStatus(openOrder) === "ready"} /></div>
                <div className="border-t border-dashed border-black/20 my-2" />
                <div className="space-y-2">
                  {openOrder.items.filter(i => i.status !== "draft").map((it) => {
                    const icon = it.status === "served" ? "✅" : it.status === "ready" ? "🟢" : it.status === "preparing" ? "🔵" : "🟡";
                    const isAllergy = noteIndicatesAllergy(it.notes);
                    const product = products?.find((p) => p.id === it.productId);
                    return (
                      <div key={it.id} className="rf-mono text-[13px]">
                        {isAllergy && <AllergyBadge item={it} product={product} compact />}
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div>{icon} {it.qty} × {it.name}</div>
                            {it.notes && !isAllergy && <div className="text-[11px] opacity-70 pl-4">↳ {it.notes}</div>}
                          </div>
                          <span className="text-[10px] opacity-60 uppercase shrink-0">{it.status}</span>
                        </div>
                      </div>
                    );
                  })}
                  {openOrder.items.filter(i => i.status === "draft").length > 0 && (
                    <div className="text-[11px] opacity-50 pt-1">+ {openOrder.items.filter(i => i.status === "draft").length} article(s) pas encore envoyés</div>
                  )}
                </div>
              </>
            ) : <p className="rf-mono text-sm opacity-60 py-4">Aucune commande active pour cette table.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   DASHBOARD
   ============================================================ */

function Dashboard({ history, orders, tables }) {
  const [range, setRange] = useState("today");
  const now = Date.now();
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);

  const filtered = useMemo(() => {
    if (range === "today") return history.filter((h) => h.createdAt >= dayStart.getTime());
    if (range === "week") return history.filter((h) => h.createdAt >= now - 7 * 86400000);
    return history;
  }, [range, history]);

  const ca = filtered.reduce((s, h) => s + h.total, 0);
  const nOrders = filtered.length;
  const panierMoyen = nOrders ? ca / nOrders : 0;
  const occupied = tables.filter((t) => orders.some((o) => o.tableId === t.id)).length;

  const byDay = useMemo(() => {
    const map = {};
    history.forEach((h) => {
      const d = new Date(h.createdAt); const key = d.toLocaleDateString("fr-FR", { weekday: "short" });
      map[key] = (map[key] || 0) + h.total;
    });
    return Object.entries(map).map(([name, ca]) => ({ name, ca: Math.round(ca) }));
  }, [history]);

  const topProducts = useMemo(() => {
    const map = {};
    filtered.forEach((h) => h.items.forEach((it) => { map[it.name] = (map[it.name] || 0) + it.qty; }));
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, qty]) => ({ name, qty }));
  }, [filtered]);

  const liveByStatus = useMemo(() => {
    const counts = { new: 0, preparing: 0, ready: 0 };
    orders.forEach((o) => { const s = orderKitchenStatus(o); if (counts[s] !== undefined) counts[s]++; });
    return [
      { name: "Nouvelles", value: counts.new, color: "#D9A441" },
      { name: "En préparation", value: counts.preparing, color: "#3E7CB1" },
      { name: "Prêtes", value: counts.ready, color: "#2E9E5B" },
    ].filter((d) => d.value > 0);
  }, [orders]);

  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="rf-display text-2xl font-semibold text-[#2B2622]">Tableau de bord</h1>
          <p className="text-sm text-[#6B6355]">Vue d'ensemble de l'activité du restaurant</p>
        </div>
        <div className="flex gap-1 p-1 rounded-full bg-black/5">
          {[{ id: "today", l: "Aujourd'hui" }, { id: "week", l: "Cette semaine" }, { id: "all", l: "Historique complet" }].map((o) => (
            <button key={o.id} onClick={() => setRange(o.id)} className="rf-tap px-3 py-1.5 rounded-full text-xs font-semibold"
              style={{ background: range === o.id ? "#2B2622" : "transparent", color: range === o.id ? "#FAF6EE" : "#5B5346" }}>{o.l}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-5">
        <StatCard label="Chiffre d'affaires" value={money(ca)} icon={Sparkles} />
        <StatCard label="Commandes" value={nOrders} icon={ClipboardList} />
        <StatCard label="Panier moyen" value={money(panierMoyen)} icon={BarChart3} />
        <StatCard label="Tables occupées" value={`${occupied} / ${tables.length}`} icon={Table2} />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 rounded-2xl border border-black/10 bg-white p-4">
          <p className="text-sm font-semibold text-[#2B2622] mb-2">Chiffre d'affaires (7 derniers jours)</p>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={byDay}>
              <defs>
                <linearGradient id="ca" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#C1440E" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#C1440E" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#EFE7D2" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#8A8378" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#8A8378" }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => money(v)} contentStyle={{ borderRadius: 8, border: "1px solid #EFE7D2", fontSize: 12 }} />
              <Area type="monotone" dataKey="ca" stroke="#C1440E" fill="url(#ca)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-2xl border border-black/10 bg-white p-4">
          <p className="text-sm font-semibold text-[#2B2622] mb-2">Commandes en cuisine</p>
          {liveByStatus.length === 0 ? <p className="text-xs text-[#9A917E] py-10 text-center">Aucune commande active</p> : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={liveByStatus} dataKey="value" nameKey="name" innerRadius={45} outerRadius={72} paddingAngle={3}>
                  {liveByStatus.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div className="flex flex-wrap gap-2 justify-center mt-1">
            {liveByStatus.map((d) => <span key={d.name} className="text-[10px] flex items-center gap-1 text-[#5B5346]"><span className="w-2 h-2 rounded-full" style={{ background: d.color }} />{d.name}</span>)}
          </div>
        </div>

        <div className="col-span-3 rounded-2xl border border-black/10 bg-white p-4">
          <p className="text-sm font-semibold text-[#2B2622] mb-2">Produits les plus vendus</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={topProducts} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EFE7D2" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: "#8A8378" }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11, fill: "#2B2622" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #EFE7D2", fontSize: 12 }} />
              <Bar dataKey="qty" fill="#4A7856" radius={[0, 6, 6, 0]} barSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-[#8A8378] uppercase tracking-wide">{label}</span>
        <Icon size={15} className="text-[#C1440E]" />
      </div>
      <span className="rf-display text-2xl font-semibold text-[#2B2622]">{value}</span>
    </div>
  );
}

/* ============================================================
   GESTION — Tables / Produits / Menus
   ============================================================ */

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6" onClick={onClose}>
      <div className={`rf-anim-pop bg-white rounded-2xl w-full ${wide ? "max-w-2xl" : "max-w-md"} max-h-[85vh] overflow-y-auto rf-scrollbar shadow-xl`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/10 sticky top-0 bg-white">
          <h3 className="rf-display text-lg font-semibold text-[#2B2622]">{title}</h3>
          <button onClick={onClose} className="rf-tap p-1.5 rounded-full bg-black/5"><X size={16} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block mb-3">
      <span className="block text-xs font-semibold text-[#6B6355] mb-1">{label}</span>
      {children}
    </label>
  );
}

const inputCls = "w-full px-3 py-2 rounded-lg border border-black/15 text-sm outline-none focus:border-[#C1440E] bg-white";

function Gestion(props) {
  const { view, setView } = props;
  const tabs = [
    { id: "tables", label: "Tables", icon: Table2 },
    { id: "produits", label: "Produits", icon: Package },
    { id: "menus", label: "Menus", icon: LayoutList },
  ];
  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="rf-display text-2xl font-semibold text-[#2B2622]">Gestion</h1>
          <p className="text-sm text-[#6B6355]">Tables, catalogue produits et menus du restaurant</p>
        </div>
        <div className="flex gap-1 p-1 rounded-full bg-black/5">
          {tabs.map((t) => {
            const Icon = t.icon; const active = view === t.id;
            return (
              <button key={t.id} onClick={() => setView(t.id)} className="rf-tap flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium"
                style={{ background: active ? "#2B2622" : "transparent", color: active ? "#FAF6EE" : "#5B5346" }}>
                <Icon size={14} /> {t.label}
              </button>
            );
          })}
        </div>
      </div>
      {view === "tables" && <TableManager {...props} />}
      {view === "produits" && <ProductManager {...props} />}
      {view === "menus" && <MenuManager {...props} />}
    </div>
  );
}

/* ---------- Tables ---------- */

function TableManager({ tables, orders, onAddTable, onUpdateTable, onDeleteTable }) {
  const [editing, setEditing] = useState(null); // table object or "new" or null
  const nextNumber = (Math.max(0, ...tables.map((t) => t.number)) || 0) + 1;

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button onClick={() => setEditing("new")} className="rf-tap flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: "#C1440E" }}>
          <Plus size={15} /> Ajouter une table
        </button>
      </div>
      <div className="grid grid-cols-4 gap-3">
        {tables.map((t) => {
          const busy = orders.some((o) => o.tableId === t.id);
          return (
            <div key={t.id} className="rounded-xl border border-black/10 bg-white p-3.5">
              <div className="flex items-center justify-between mb-1">
                <span className="rf-black text-lg text-[#2B2622]">Table {t.number}</span>
                <div className="flex gap-1">
                  <button onClick={() => setEditing(t)} className="rf-tap p-1.5 rounded-full bg-black/5"><Pencil size={13} /></button>
                  <button onClick={() => onDeleteTable(t.id)} className="rf-tap p-1.5 rounded-full bg-black/5 text-[#C1361B]" title={busy ? "Commande en cours" : "Supprimer"}><Trash2 size={13} /></button>
                </div>
              </div>
              <p className="text-xs text-[#8A8378] flex items-center gap-1"><Users size={11} />{t.seats} places</p>
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {busy && <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/5 text-[#5B5346]">Commande active</span>}
              </div>
              {t.reserved ? (
                <div className="mt-2 rounded-lg p-2 space-y-0.5" style={{ background: "#5B534614" }}>
                  <p className="text-[10px] font-extrabold flex items-center gap-1" style={{ color: "#5B5346" }}><Lock size={10} /> RÉSERVÉE</p>
                  {(t.reservationName || t.reservationPeople || t.reservationTime) && (
                    <p className="text-[11px] text-[#5B5346]">{t.reservationName || "—"}{t.reservationPeople ? ` · ${t.reservationPeople} pers.` : ""}{t.reservationTime ? ` · ${t.reservationTime}` : ""}</p>
                  )}
                  {t.reservationNote && <p className="text-[10px] text-[#8A8378] italic">{t.reservationNote}</p>}
                  <div className="flex gap-2 pt-0.5">
                    <button onClick={() => setEditing(t)} className="rf-tap text-[10px] font-semibold text-[#3E7CB1]">Modifier</button>
                    <button onClick={() => onUpdateTable(t.id, { reserved: false, reservationName: "", reservationPeople: "", reservationTime: "", reservationNote: "" })} className="rf-tap text-[10px] font-semibold text-[#C1361B]">Annuler la réservation</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setEditing({ ...t, reserved: true })} className="rf-tap mt-2 text-[10px] font-semibold text-[#3E7CB1] flex items-center gap-1"><Lock size={10} /> Réserver cette table</button>
              )}
            </div>
          );
        })}
      </div>

      {editing && (
        <TableForm
          table={editing === "new" ? null : editing}
          defaultNumber={nextNumber}
          onCancel={() => setEditing(null)}
          onSave={(data) => {
            if (editing === "new") onAddTable(data); else onUpdateTable(editing.id, data);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function TableForm({ table, defaultNumber, onCancel, onSave }) {
  const [number, setNumber] = useState(table?.number ?? defaultNumber);
  const [seats, setSeats] = useState(table?.seats ?? 2);
  const [x, setX] = useState(table?.x ?? 50);
  const [y, setY] = useState(table?.y ?? 50);
  const [reserved, setReserved] = useState(table?.reserved ?? false);
  const [reservationName, setReservationName] = useState(table?.reservationName ?? "");
  const [reservationPeople, setReservationPeople] = useState(table?.reservationPeople ?? "");
  const [reservationTime, setReservationTime] = useState(table?.reservationTime ?? "");
  const [reservationNote, setReservationNote] = useState(table?.reservationNote ?? "");

  return (
    <Modal title={table ? `Modifier la table ${table.number}` : "Nouvelle table"} onClose={onCancel}>
      <Field label="Numéro de table">
        <input type="number" min={1} className={inputCls} value={number} onChange={(e) => setNumber(Number(e.target.value))} />
      </Field>
      <Field label="Nombre de places">
        <input type="number" min={1} max={20} className={inputCls} value={seats} onChange={(e) => setSeats(Number(e.target.value))} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={`Position horizontale (${x}%)`}>
          <input type="range" min={4} max={94} value={x} onChange={(e) => setX(Number(e.target.value))} className="w-full" />
        </Field>
        <Field label={`Position verticale (${y}%)`}>
          <input type="range" min={4} max={90} value={y} onChange={(e) => setY(Number(e.target.value))} className="w-full" />
        </Field>
      </div>
      <label className="flex items-center gap-2 mb-3 text-sm text-[#5B5346]">
        <input type="checkbox" checked={reserved} onChange={(e) => setReserved(e.target.checked)} /> Table réservée
      </label>
      {reserved && (
        <div className="rounded-xl border border-black/10 p-3 mb-4 space-y-0 bg-black/[.02]">
          <Field label="Nom de la réservation">
            <input className={inputCls} value={reservationName} onChange={(e) => setReservationName(e.target.value)} placeholder="Ex : Famille Dubois" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nombre de personnes">
              <input type="number" min={1} className={inputCls} value={reservationPeople} onChange={(e) => setReservationPeople(e.target.value)} />
            </Field>
            <Field label="Heure de réservation">
              <input type="time" className={inputCls} value={reservationTime} onChange={(e) => setReservationTime(e.target.value)} />
            </Field>
          </div>
          <Field label="Note (optionnel)">
            <input className={inputCls} value={reservationNote} onChange={(e) => setReservationNote(e.target.value)} placeholder="Ex : anniversaire, chaise bébé…" />
          </Field>
        </div>
      )}
      <div className="flex gap-2">
        <button onClick={onCancel} className="rf-tap flex-1 py-2.5 rounded-xl text-sm font-semibold bg-black/5">Annuler</button>
        <button onClick={() => onSave({
          number, seats, x, y, reserved,
          reservationName: reserved ? reservationName.trim() : "",
          reservationPeople: reserved ? reservationPeople : "",
          reservationTime: reserved ? reservationTime : "",
          reservationNote: reserved ? reservationNote.trim() : "",
        })} className="rf-tap flex-1 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: "#C1440E" }}>Enregistrer</button>
      </div>
    </Modal>
  );
}

/* ---------- Produits ---------- */

function ProductManager({ products, onAddProduct, onUpdateProduct, onDeleteProduct }) {
  const [editing, setEditing] = useState(null);
  const [filterCat, setFilterCat] = useState(null);
  const realCats = CATEGORIES.filter((c) => c.id !== "menus");
  const shown = filterCat ? products.filter((p) => p.cat === filterCat) : products;

  return (
    <div>
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <div className="flex gap-1.5 flex-wrap">
          <button onClick={() => setFilterCat(null)} className="rf-tap px-3 py-1.5 rounded-full text-xs font-semibold"
            style={{ background: filterCat === null ? "#2B2622" : "rgba(0,0,0,.05)", color: filterCat === null ? "#FAF6EE" : "#5B5346" }}>Tous</button>
          {realCats.map((c) => (
            <button key={c.id} onClick={() => setFilterCat(c.id)} className="rf-tap px-3 py-1.5 rounded-full text-xs font-semibold"
              style={{ background: filterCat === c.id ? c.accent : "rgba(0,0,0,.05)", color: filterCat === c.id ? "#FAF6EE" : "#5B5346" }}>{c.name}</button>
          ))}
        </div>
        <button onClick={() => setEditing("new")} className="rf-tap flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white shrink-0" style={{ background: "#C1440E" }}>
          <Plus size={15} /> Ajouter un produit
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {shown.map((p) => {
          const cat = CATEGORIES.find((c) => c.id === p.cat);
          const available = isAvailable(p);
          return (
            <div key={p.id} className="rounded-xl border border-black/10 bg-white p-3 flex gap-3">
              <div className="w-11 h-11 rounded-lg flex items-center justify-center text-xl shrink-0" style={{ background: (cat?.accent || "#999") + "22", filter: available ? "none" : "grayscale(1)" }}>{p.emoji}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-1">
                  <span className="text-sm font-semibold text-[#2B2622] leading-tight">{p.name}</span>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => setEditing(p)} className="rf-tap p-1 rounded-full bg-black/5"><Pencil size={12} /></button>
                    <button onClick={() => onDeleteProduct(p.id)} className="rf-tap p-1 rounded-full bg-black/5 text-[#C1361B]"><Trash2 size={12} /></button>
                  </div>
                </div>
                <p className="text-[11px] text-[#8A8378] leading-snug">{p.desc}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs font-bold">{money(p.price)}</span>
                  <span className="text-[10px] text-[#8A8378]">{cat?.name}</span>
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full flex items-center gap-0.5" style={{ background: available ? "#4A785622" : "#C1361B22", color: available ? "#4A7856" : "#C1361B" }}>
                    {available ? "DISPONIBLE" : <><Ban size={9} /> RUPTURE DE STOCK</>}
                  </span>
                  <button onClick={() => onUpdateProduct(p.id, { available: !available })} className="rf-tap text-[10px] font-semibold text-[#3E7CB1]">
                    {available ? "Marquer en rupture" : "Remettre disponible"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {shown.length === 0 && <p className="text-sm text-[#9A917E] col-span-3 text-center py-8">Aucun produit dans cette catégorie.</p>}
      </div>

      {editing && (
        <ProductForm
          product={editing === "new" ? null : editing}
          categories={realCats}
          onCancel={() => setEditing(null)}
          onSave={(data) => { if (editing === "new") onAddProduct(data); else onUpdateProduct(editing.id, data); setEditing(null); }}
        />
      )}
    </div>
  );
}

function ProductForm({ product, categories, onCancel, onSave }) {
  const [name, setName] = useState(product?.name ?? "");
  const [cat, setCat] = useState(product?.cat ?? categories[0]?.id);
  const [price, setPrice] = useState(product?.price ?? "");
  const [desc, setDesc] = useState(product?.desc ?? "");
  const [emoji, setEmoji] = useState(product?.emoji ?? "🍽️");
  const [allergens, setAllergens] = useState((product?.allergens ?? []).join(", "));
  const [available, setAvailable] = useState(product ? isAvailable(product) : true);
  const valid = name.trim() && price !== "" && !isNaN(Number(price));

  return (
    <Modal title={product ? "Modifier le produit" : "Nouveau produit"} onClose={onCancel}>
      <div className="grid grid-cols-[64px_1fr] gap-3">
        <Field label="Icône">
          <input className={inputCls + " text-center text-xl"} value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={2} />
        </Field>
        <Field label="Nom du produit">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex : Burger Classic" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Catégorie">
          <select className={inputCls} value={cat} onChange={(e) => setCat(e.target.value)}>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Prix (€)">
          <input type="number" step="0.5" min={0} className={inputCls} value={price} onChange={(e) => setPrice(e.target.value)} />
        </Field>
      </div>
      <Field label="Description courte">
        <input className={inputCls} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Ex : Bœuf, cheddar, oignons confits" />
      </Field>
      <Field label="Allergènes (séparés par des virgules)">
        <input className={inputCls} value={allergens} onChange={(e) => setAllergens(e.target.value)} placeholder="Ex : Gluten, Lait" />
      </Field>
      <Field label="Disponibilité">
        <div className="flex gap-2">
          <button type="button" onClick={() => setAvailable(true)} className="rf-tap flex-1 py-2 rounded-lg text-xs font-bold"
            style={{ background: available ? "#4A7856" : "rgba(0,0,0,.05)", color: available ? "#FAF6EE" : "#5B5346" }}>Disponible</button>
          <button type="button" onClick={() => setAvailable(false)} className="rf-tap flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1"
            style={{ background: !available ? "#C1361B" : "rgba(0,0,0,.05)", color: !available ? "#FAF6EE" : "#5B5346" }}><Ban size={12} />Rupture de stock</button>
        </div>
      </Field>
      <div className="flex gap-2 mt-1">
        <button onClick={onCancel} className="rf-tap flex-1 py-2.5 rounded-xl text-sm font-semibold bg-black/5">Annuler</button>
        <button disabled={!valid} onClick={() => onSave({
          name: name.trim(), cat, price: Number(price), desc: desc.trim(), emoji: emoji || "🍽️",
          allergens: allergens.split(",").map((s) => s.trim()).filter(Boolean),
          available,
        })} className="rf-tap flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40" style={{ background: "#C1440E" }}>Enregistrer</button>
      </div>
    </Modal>
  );
}

/* ---------- Menus ---------- */

function MenuManager({ products, menus, onAddMenu, onUpdateMenu, onDeleteMenu }) {
  const [editing, setEditing] = useState(null);

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button onClick={() => setEditing("new")} className="rf-tap flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: "#C1440E" }}>
          <Plus size={15} /> Créer un menu
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {menus.map((m) => {
          const groups = m.groups || [];
          return (
            <div key={m.id} className="rounded-xl border border-black/10 bg-white p-3.5">
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{m.emoji}</span>
                  <span className="rf-display text-base font-semibold text-[#2B2622]">{m.name}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-sm font-bold text-[#C1440E] mr-1">{money(m.price)}</span>
                  <button onClick={() => setEditing(m)} className="rf-tap p-1.5 rounded-full bg-black/5"><Pencil size={13} /></button>
                  <button onClick={() => onDeleteMenu(m.id)} className="rf-tap p-1.5 rounded-full bg-black/5 text-[#C1361B]"><Trash2 size={13} /></button>
                </div>
              </div>
              <div className="space-y-1">
                {groups.length === 0 && <span className="text-xs text-[#9A917E]">Aucune étape de choix configurée</span>}
                {groups.map((g) => {
                  const opts = g.productIds.map((id) => products.find((p) => p.id === id)).filter(Boolean);
                  return (
                    <div key={g.id} className="text-[11px] text-[#5B5346]">
                      <span className="font-semibold text-[#6B4226]">{g.title}</span> ({g.count} au choix parmi {opts.length}) : {opts.map((p) => p.name).join(", ") || "—"}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        {menus.length === 0 && <p className="text-sm text-[#9A917E] col-span-2 text-center py-8">Aucun menu créé pour le moment.</p>}
      </div>

      {editing && (
        <MenuForm
          menu={editing === "new" ? null : editing}
          products={products}
          onCancel={() => setEditing(null)}
          onSave={(data) => { if (editing === "new") onAddMenu(data); else onUpdateMenu(editing.id, data); setEditing(null); }}
        />
      )}
    </div>
  );
}

function MenuForm({ menu, products, onCancel, onSave }) {
  const [name, setName] = useState(menu?.name ?? "");
  const [price, setPrice] = useState(menu?.price ?? "");
  const [emoji, setEmoji] = useState(menu?.emoji ?? "📋");
  const [groups, setGroups] = useState(menu?.groups ?? [{ id: uid("grp"), title: "Entrée", count: 1, productIds: [] }]);
  const realCats = CATEGORIES.filter((c) => c.id !== "menus");

  const valid = name.trim() && price !== "" && !isNaN(Number(price)) && groups.length > 0
    && groups.every((g) => g.title.trim() && g.count >= 1 && g.productIds.length >= g.count);

  const addGroup = () => setGroups((prev) => [...prev, { id: uid("grp"), title: "Étape " + (prev.length + 1), count: 1, productIds: [] }]);
  const removeGroup = (id) => setGroups((prev) => prev.filter((g) => g.id !== id));
  const updateGroup = (id, patch) => setGroups((prev) => prev.map((g) => g.id === id ? { ...g, ...patch } : g));
  const toggleProduct = (groupId, productId) => setGroups((prev) => prev.map((g) => g.id === groupId
    ? { ...g, productIds: g.productIds.includes(productId) ? g.productIds.filter((x) => x !== productId) : [...g.productIds, productId] }
    : g));

  return (
    <Modal title={menu ? "Modifier le menu" : "Nouveau menu"} onClose={onCancel} wide>
      <div className="grid grid-cols-[64px_1fr_120px] gap-3">
        <Field label="Icône">
          <input className={inputCls + " text-center text-xl"} value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={2} />
        </Field>
        <Field label="Nom du menu">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex : Menu Burger" />
        </Field>
        <Field label="Prix (€)">
          <input type="number" step="0.5" min={0} className={inputCls} value={price} onChange={(e) => setPrice(e.target.value)} />
        </Field>
      </div>

      <p className="text-[11px] text-[#8A8378] mb-3">
        Composez le menu en étapes de choix (ex. « Entrée » au choix parmi plusieurs plats). Le serveur devra sélectionner une option par étape avant d'ajouter le menu à la commande.
      </p>

      <div className="space-y-3">
        {groups.map((g, idx) => {
          const min = g.productIds.length;
          return (
            <div key={g.id} className="border border-black/10 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2.5">
                <input value={g.title} onChange={(e) => updateGroup(g.id, { title: e.target.value })}
                  placeholder="Ex : Entrée" className={inputCls + " flex-1 font-semibold"} />
                <label className="flex items-center gap-1.5 text-xs text-[#6B6355] shrink-0">
                  Choix
                  <input type="number" min={1} max={Math.max(1, g.productIds.length)} value={g.count}
                    onChange={(e) => updateGroup(g.id, { count: Math.max(1, Number(e.target.value)) })}
                    className="w-14 px-2 py-1.5 rounded-lg border border-black/15 text-sm outline-none text-center" />
                </label>
                {groups.length > 1 && (
                  <button onClick={() => removeGroup(g.id)} className="rf-tap p-1.5 rounded-full bg-black/5 text-[#C1361B] shrink-0"><Trash2 size={13} /></button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-1.5 max-h-[180px] overflow-y-auto rf-scrollbar pr-1">
                {realCats.map((c) => {
                  const catProducts = products.filter((p) => p.cat === c.id);
                  return catProducts.map((p) => {
                    const checked = g.productIds.includes(p.id);
                    return (
                      <button type="button" key={p.id} onClick={() => toggleProduct(g.id, p.id)}
                        className="rf-tap flex items-center gap-2 text-left px-2.5 py-1.5 rounded-lg border text-xs"
                        style={{ borderColor: checked ? "#C1440E" : "rgba(0,0,0,.1)", background: checked ? "#C1440E12" : "white" }}>
                        <span className="w-4 h-4 rounded flex items-center justify-center shrink-0" style={{ background: checked ? "#C1440E" : "rgba(0,0,0,.08)" }}>
                          {checked && <Check size={11} color="white" />}
                        </span>
                        <span className="flex-1 truncate">{p.emoji} {p.name}</span>
                      </button>
                    );
                  });
                })}
              </div>
              {g.count > min && <p className="text-[10px] text-[#C1361B] mt-1.5">Sélectionnez au moins {g.count} produit(s) pour cette étape.</p>}
            </div>
          );
        })}
      </div>

      <button onClick={addGroup} className="rf-tap w-full mt-3 py-2 rounded-xl text-xs font-semibold bg-black/5 flex items-center justify-center gap-1.5">
        <Plus size={14} /> Ajouter une étape de choix
      </button>

      <div className="flex gap-2 mt-4">
        <button onClick={onCancel} className="rf-tap flex-1 py-2.5 rounded-xl text-sm font-semibold bg-black/5">Annuler</button>
        <button disabled={!valid} onClick={() => onSave({ name: name.trim(), price: Number(price), emoji: emoji || "📋", groups, desc: "" })}
          className="rf-tap flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40" style={{ background: "#C1440E" }}>Enregistrer</button>
      </div>
    </Modal>
  );
}
