import { useState, useEffect, useCallback } from "react";
import { seedTables, seedOrders, seedHistory, seedMenus, seedReservations } from "../data/seed.js";
import { PRODUCTS_SEED } from "../data/products.js";
import { INITIAL_ROLES, INITIAL_STAFF } from "../data/staff.js";
import { deduplicateHistory } from "../utils/index.js";
import { DEFAULT_MODULES_CONFIG } from "./useModules.js";
import { getSocket } from "../services/socket.js";
import { saveFullState, loadCachedState, saveCollection } from "../services/db.js";

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
  modulesConfig: DEFAULT_MODULES_CONFIG,
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

// Cache local : une liste vide ne remplace pas les données de démo, sauf pour ces collections
const CACHE_MAY_BE_EMPTY = new Set(["orders", "reservations", "history"]);

/**
 * État métier global (collections synchronisées avec le serveur), restauré depuis IndexedDB
 * au démarrage puis sauvegardé à chaque mutation.
 */
export function useRestoState() {
  const [tables,         setTables]         = useState(fallbackTables);
  const [orders,         setOrders]         = useState(fallbackOrders);
  const [reservations,   setReservations]   = useState(fallbackReservations);
  const [history,        setHistory]        = useState(seedHistory);
  const [products,       setProducts]       = useState(PRODUCTS_SEED);
  const [menus,          setMenus]          = useState(seedMenus);
  const [staff,          setStaff]          = useState(INITIAL_STAFF);
  const [roles,          setRoles]          = useState(INITIAL_ROLES);
  const [ingredients,    setIngredients]    = useState([]);
  const [recipes,        setRecipes]        = useState([]);
  const [stockMovements, setStockMovements] = useState([]);
  const [closings,       setClosings]       = useState([]);
  const [config,         setConfig]         = useState(DEFAULT_CONFIG);

  // Applique un état complet (serveur ou cache) ; les clés absentes sont ignorées
  const applyState = useCallback((state, fromCache = false) => {
    const setters = {
      tables: setTables, orders: setOrders, reservations: setReservations, history: setHistory,
      products: setProducts, menus: setMenus, staff: setStaff, roles: setRoles,
      ingredients: setIngredients, recipes: setRecipes, stockMovements: setStockMovements,
      closings: setClosings, config: setConfig,
    };
    for (const [key, set] of Object.entries(setters)) {
      const value = state[key];
      if (!value) continue;
      if (fromCache && Array.isArray(value) && value.length === 0 && !CACHE_MAY_BE_EMPTY.has(key)) continue;
      set(key === "history" ? deduplicateHistory(value) : value);
    }
  }, []);

  /** État complet envoyé par le serveur : appliqué puis persisté dans IndexedDB */
  const applyServerState = useCallback((state) => {
    if (!state) return;
    applyState(state);
    saveFullState(state);
  }, [applyState]);

  /** Réconciliation avec l'état réel de la base */
  const requestSync = useCallback(() => {
    getSocket().emit("sync:request", {}, (res) => {
      if (res && res.state) applyServerState(res.state);
    });
  }, [applyServerState]);

  // ── Restauration immédiate depuis IndexedDB (Mode 100% Autonome / Offline) ──
  useEffect(() => {
    let active = true;
    loadCachedState().then((cached) => {
      if (active && cached) applyState(cached, true);
    });
    return () => {
      active = false;
    };
  }, [applyState]);

  // Sauvegarde debounced des mutations locales dans IndexedDB (évite le flood I/O)
  useEffect(() => {
    const timer = setTimeout(() => {
      saveCollection("tables", tables);
      saveCollection("orders", orders);
      saveCollection("reservations", reservations);
      saveCollection("history", history);
      saveCollection("closings", closings);
      saveCollection("products", products);
      saveCollection("ingredients", ingredients);
      saveCollection("recipes", recipes);
      saveCollection("stockMovements", stockMovements);
    }, 500);
    return () => clearTimeout(timer);
  }, [tables, orders, reservations, history, closings, products, ingredients, recipes, stockMovements]);

  return {
    tables, setTables,
    orders, setOrders,
    reservations, setReservations,
    history, setHistory,
    products, setProducts,
    menus, setMenus,
    staff, setStaff,
    roles, setRoles,
    ingredients, setIngredients,
    recipes, setRecipes,
    stockMovements, setStockMovements,
    closings, setClosings,
    config, setConfig,
    applyServerState,
    requestSync,
  };
}
