export const money = (n) => {
  const val = typeof n === "number" && !isNaN(n) ? n : 0;
  return val.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
};

/**
 * Retourne une durée relative lisible depuis un timestamp.
 * @param {number} ts - Timestamp en ms
 * @param {number} now - Timestamp actuel en ms
 */
export function elapsed(ts, now) {
  const m = Math.max(0, Math.floor((now - ts) / 60000));
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  return `il y a ${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`;
}

/**
 * Calcule le total d'une commande (tous articles confondus).
 * @param {object} order
 */
export function orderTotal(order) {
  return order.items.reduce((s, it) => s + it.price * it.qty, 0);
}

/**
 * Retourne le timestamp de départ du timer cuisine.
 * Préfère `sentAt` (envoi réel) à `createdAt`.
 */
export function kitchenStartTs(order) {
  return order.sentAt || order.createdAt;
}

/**
 * Formate une durée en ms sous la forme "MM:SS".
 */
export function formatTimer(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Niveaux visuels du timer cuisine selon le temps écoulé.
 * - normal  : < 8 min
 * - warning : 8–15 min
 * - critical: ≥ 15 min
 */
export const TIMER_LEVELS = {
  normal:   { color: "#4A7856", bg: "#4A785618", label: "normal" },
  warning:  { color: "#D9A441", bg: "#D9A44120", label: "attente" },
  critical: { color: "#C1361B", bg: "#C1361B22", label: "retard" },
};

export function timerLevel(elapsedMs) {
  const min = elapsedMs / 60000;
  if (min >= 15) return "critical";
  if (min >= 8)  return "warning";
  return "normal";
}

/**
 * Retourne true si un produit est disponible (champ absent = disponible par défaut).
 */
export function isAvailable(product) {
  return !product || product.available !== false;
}

/**
 * Détecte si une note de commande contient un mot-clé d'allergie.
 */
export function noteIndicatesAllergy(notes) {
  if (!notes) return false;
  return /allerg/i.test(notes);
}

/**
 * Calcule le statut global d'une commande vu de la cuisine.
 * Exclut les items "draft" (non encore envoyés) et "served".
 * @returns {"new"|"preparing"|"ready"|"done"}
 */
export function orderKitchenStatus(order) {
  const unserved = (order?.items || []).filter((i) => i.status !== "draft" && i.status !== "served");
  if (unserved.length === 0) return "done";
  const active = unserved.filter((i) => i.courseStatus !== "held");
  if (active.length > 0) {
    if (active.every((i) => i.status === "ready")) return "ready";
    if (active.some((i) => i.status === "preparing" || i.status === "ready")) return "preparing";
    return "new";
  }
  return "new";
}

/**
 * Retourne le statut visuel d'une table (utilisé par le plan de salle et la cuisine).
 * @returns {"free"|"occupied"|"sent"|"ready"|"alert"|"reserved"}
 */
export function tableStatus(table, order) {
  if (order) {
    const hasDraft    = order.items.some((i) => i.status === "draft");
    const hasSent     = order.items.some((i) => i.status !== "draft" && i.status !== "served");
    const hasReady    = order.items.some((i) => i.status === "ready");
    const allServed   = order.items.length > 0 && order.items.every((i) => i.status === "served");
    if (table.alert) return "alert";
    if (allServed)   return "occupied";
    if (hasReady)    return "ready";
    if (hasSent)     return "sent";
    if (hasDraft)    return "occupied";
  }
  if (table.alert)    return "alert";
  if (table.reserved) return "reserved";
  return "free";
}

/**
 * Métadonnées des statuts de table (couleur, label, dot).
 */
export const STATUS_META = {
  free:     { label: "Disponible",          color: "#4A7856", dot: "🟢" },
  occupied: { label: "Commande en cours",   color: "#D9A441", dot: "🟠" },
  sent:     { label: "Envoyée en cuisine",  color: "#3E7CB1", dot: "🔵" },
  ready:    { label: "Prête à servir",      color: "#2E9E5B", dot: "🟢" },
  alert:    { label: "Attention",           color: "#C1361B", dot: "🔴" },
  reserved: { label: "Réservée",            color: "#8A8378", dot: "⚪" },
};

/**
 * Transforme un menu (avec ses groupes de choix) en article commandable
 * affiché dans la catégorie "Menus".
 */
export function menuToProduct(menu, allProducts) {
  const groups = menu.groups || [];
  const allergens = Array.from(
    new Set(
      groups
        .flatMap((g) => g.productIds)
        .map((id) => allProducts.find((p) => p.id === id))
        .filter(Boolean)
        .flatMap((p) => p.allergens || [])
    )
  );
  return {
    id: `menu_${menu.id}`,
    cat: "menus",
    isMenu: true,
    menuId: menu.id,
    groups,
    name: menu.name,
    price: menu.price,
    emoji: menu.emoji || "📋",
    available: menu.available !== false,
    allergens,
    desc:
      menu.desc ||
      (groups.length
        ? `${groups.map((g) => g.title).join(" + ")}, au choix`
        : "Menu à composer"),
  };
}

/**
 * Détermine si le Happy Hour est actuellement actif selon la configuration
 */
export function isHappyHourActive(config, date = new Date()) {
  if (!config?.happyHourConfig?.enabled) return false;
  const hh = config.happyHourConfig;

  // Jour de la semaine (0 = Dimanche, 1 = Lundi, etc.)
  const currentDay = date.getDay();
  if (Array.isArray(hh.days) && !hh.days.includes(currentDay)) {
    return false;
  }

  // Plage horaire
  const nowMinutes = date.getHours() * 60 + date.getMinutes();
  const [startH, startM] = (hh.startTime || "17:00").split(":").map(Number);
  const [endH, endM] = (hh.endTime || "20:00").split(":").map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  return nowMinutes >= startMinutes && nowMinutes < endMinutes;
}

/**
 * Calcule le prix effectif d'un produit (en tenant compte du Happy Hour s'il est actif)
 */
export function getProductEffectivePrice(product, config, date = new Date()) {
  if (!product) return 0;
  if (!isHappyHourActive(config, date)) {
    return product.price || 0;
  }

  // Prix Happy Hour fixe spécifique
  if (product.happyHourPrice != null && product.happyHourPrice > 0) {
    return product.happyHourPrice;
  }

  // Remise Happy Hour sur la catégorie ciblée (par défaut "boissons")
  const targetCats = config?.happyHourConfig?.categories || ["boissons"];
  if (targetCats.includes(product.cat)) {
    const discountRate = (config?.happyHourConfig?.discountPercent || 20) / 100;
    return Math.max(0, Math.round(product.price * (1 - discountRate) * 100) / 100);
  }

  return product.price || 0;
}

/**
 * Dédoublonne les entrées d'historique de commande (évite doublon optimiste + socket/serveur).
 */
export function deduplicateHistory(list) {
  if (!Array.isArray(list)) return [];
  const map = new Map();

  for (const item of list) {
    if (!item) continue;
    // Clé de déduplication : orderId ou ticketNumber si présent, sinon id
    const key = item.orderId ? `ord_${item.orderId}` : item.ticketNumber ? `tick_${item.ticketNumber}` : item.id;
    if (!key) continue;

    if (!map.has(key)) {
      map.set(key, item);
    } else {
      // Si on a déjà une entrée, conserver celle qui provient du serveur (avec signature ou sequenceNumber)
      const existing = map.get(key);
      if (!existing.signature && item.signature) {
        map.set(key, item);
      }
    }
  }

  return Array.from(map.values());
}
