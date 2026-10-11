import { useState, useEffect, useCallback, useRef } from "react";
import { deduplicateHistory } from "../utils/index.js";
import { DEFAULT_MODULES_CONFIG } from "./useModules.js";
import { getSocket } from "../services/socket.js";
import { saveFullState, loadCachedState, saveCollection } from "../services/db.js";

// La configuration réelle (mentions légales, imprimantes, codes promo) vient du serveur
const DEFAULT_CONFIG = { currency: "EUR", modulesConfig: DEFAULT_MODULES_CONFIG };

/**
 * État métier global (collections synchronisées avec le serveur), restauré depuis IndexedDB
 * au démarrage puis sauvegardé à chaque mutation.
 * Aucune donnée de démo côté client : `ready` reste faux tant que ni le cache ni le serveur n'ont répondu.
 */
export function useRestoState() {
  const [ready,          setReady]          = useState(false);
  const [tables,         setTables]         = useState([]);
  const [orders,         setOrders]         = useState([]);
  const [reservations,   setReservations]   = useState([]);
  const [history,        setHistory]        = useState([]);
  const [products,       setProducts]       = useState([]);
  const [menus,          setMenus]          = useState([]);
  const [staff,          setStaff]          = useState([]);
  const [roles,          setRoles]          = useState([]);
  const [ingredients,    setIngredients]    = useState([]);
  const [recipes,        setRecipes]        = useState([]);
  const [stockMovements, setStockMovements] = useState([]);
  const [closings,       setClosings]       = useState([]);
  const [config,         setConfig]         = useState(DEFAULT_CONFIG);

  // Applique un état complet (serveur ou cache) ; les clés absentes sont ignorées
  const applyState = useCallback((state) => {
    const setters = {
      tables: setTables, orders: setOrders, reservations: setReservations, history: setHistory,
      products: setProducts, menus: setMenus, staff: setStaff, roles: setRoles,
      ingredients: setIngredients, recipes: setRecipes, stockMovements: setStockMovements,
      closings: setClosings, config: setConfig,
    };
    for (const [key, set] of Object.entries(setters)) {
      const value = state[key];
      if (!value) continue;
      set(key === "history" ? deduplicateHistory(value) : value);
    }
    setReady(true);
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
      if (active && cached) applyState(cached);
    });
    return () => {
      active = false;
    };
  }, [applyState]);

  // Sauvegarde debounced des mutations locales dans IndexedDB (évite le flood I/O)
  const savedRef = useRef({});
  useEffect(() => {
    if (!ready) return; // ne pas écraser le cache avec l'état vide du démarrage
    const timer = setTimeout(() => {
      const current = { tables, orders, reservations, history, closings, products, ingredients, recipes, stockMovements };
      // Seules les collections modifiées (référence changée) sont réécrites : l'historique grossit tout le service
      for (const [key, value] of Object.entries(current)) {
        if (savedRef.current[key] === value) continue;
        savedRef.current[key] = value;
        saveCollection(key, value);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [ready, tables, orders, reservations, history, closings, products, ingredients, recipes, stockMovements]);

  return {
    ready,
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
