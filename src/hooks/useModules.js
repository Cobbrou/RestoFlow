import { useRestoFlow } from "../context/RestoFlowContext.jsx";

/**
 * Configuration par défaut des modules activables de RestoFlow (Phase 8).
 */
export const DEFAULT_MODULES_CONFIG = {
  enableStockManagement: true,     // Stocks, fiches techniques & alertes de rupture
  enableOnlineReservations: true,  // Réservations en ligne & indications sur les tables
  enableCoursePacing: true,        // Cadencement des "Suites" & réclame (Entrée, Plat, Dessert)
  enableMultiStationKds: true,     // Routage KDS séparé Bar vs Cuisine
  enableDiscounts: true,           // Gestion des remises & codes promotionnels
  enableAdvancedSplitModes: true,  // Modes de partage avancés (par article, montant proportionnel)
  enablePinAuth: true,             // Verrouillage PIN multi-serveurs
  enableTips: true,                // Saisie & gestion des pourboires au paiement
  enableTakeaway: false,           // Vente à emporter (commandes hors salle, numéro d'appel)
};

/**
 * Hook réactif pour interroger l'activation des modules à la carte.
 */
export function useModules() {
  let ctx = {};
  try {
    ctx = useRestoFlow() || {};
  } catch {
    ctx = {};
  }

  const raw = ctx?.modulesConfig || ctx?.config?.modulesConfig || DEFAULT_MODULES_CONFIG;
  const modules = typeof raw === "string" ? JSON.parse(raw) : (raw || DEFAULT_MODULES_CONFIG);

  return {
    modules,
    hasStocks: modules.enableStockManagement ?? true,
    hasReservations: modules.enableOnlineReservations ?? true,
    hasSuites: modules.enableCoursePacing ?? true,
    hasMultiStation: modules.enableMultiStationKds ?? true,
    hasDiscounts: modules.enableDiscounts ?? true,
    hasAdvancedSplits: modules.enableAdvancedSplitModes ?? true,
    hasPinAuth: modules.enablePinAuth ?? true,
    hasTips: modules.enableTips ?? true,
    hasTakeaway: modules.enableTakeaway ?? false,
  };
}
