import { TABLE_LAYOUT, MENUS_SEED, SERVERS } from "./tables.js";
import { PRODUCTS_SEED } from "./products.js";

/** Génère un identifiant unique avec préfixe */
export const uid = (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 9)}`;

/** Retourne un produit aléatoire du catalogue (pour le seed des commandes) */
function randomProduct() {
  return PRODUCTS_SEED[Math.floor(Math.random() * PRODUCTS_SEED.length)];
}

/** Crée un article de commande factice pour le seed */
function makeItem(status, notes) {
  const pr = randomProduct();
  return {
    id: uid("it"),
    productId: pr.id,
    name: pr.name,
    price: pr.price,
    qty: 1 + Math.floor(Math.random() * 2),
    notes: notes || "",
    status,
  };
}

/** Génère les tables initiales à partir du layout */
export function seedTables() {
  return TABLE_LAYOUT.map((t) => ({
    id: uid("tbl"),
    number: t.number,
    seats: t.seats,
    x: t.x,
    y: t.y,
    reserved: false,
    alert: false,
    reservationName: "",
    reservationPeople: "",
    reservationTime: "",
    reservationNote: "",
  }));
}

/** Génère des commandes en cours pour illustrer l'état initial du restaurant */
export function seedOrders(tables) {
  const now = Date.now();
  const orders = [];

  // Table 3 : commande en préparation (8 min)
  orders.push({
    id: uid("ord"),
    tableId: tables[2].id,
    server: "Léa",
    createdAt: now - 8 * 60000,
    sentAt: now - 8 * 60000,
    items: [makeItem("preparing", "sans oignons"), makeItem("preparing"), makeItem("preparing")],
  });

  // Table 5 : nouvelle commande (2 min)
  orders.push({
    id: uid("ord"),
    tableId: tables[4].id,
    server: "Marco",
    createdAt: now - 2 * 60000,
    sentAt: now - 2 * 60000,
    items: [makeItem("new"), makeItem("new", "cuisson saignante"), makeItem("new")],
  });

  // Table 8 : prête à servir (14 min)
  orders.push({
    id: uid("ord"),
    tableId: tables[7].id,
    server: "Inès",
    createdAt: now - 14 * 60000,
    sentAt: now - 14 * 60000,
    items: [makeItem("ready"), makeItem("ready")],
  });

  // Table 10 : mixte + alerte allergie
  tables[9].alert = true;
  orders.push({
    id: uid("ord"),
    tableId: tables[9].id,
    server: "Léa",
    createdAt: now - 20 * 60000,
    sentAt: now - 20 * 60000,
    items: [makeItem("served"), makeItem("served"), makeItem("preparing", "allergie fruits à coque")],
  });

  // Réservations
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

/** Génère un historique de commandes payées sur les 7 derniers jours (pour le dashboard) */
export function seedHistory() {
  const days = 6;
  const out = [];
  for (let d = days; d >= 0; d--) {
    const dayStart = Date.now() - d * 86400000;
    const nOrders = 14 + Math.floor(Math.random() * 10);
    for (let i = 0; i < nOrders; i++) {
      const items = Array.from({ length: 1 + Math.floor(Math.random() * 4) }, () => makeItem("served"));
      const server = SERVERS[Math.floor(Math.random() * SERVERS.length)];
      out.push({
        id: uid("hist"),
        createdAt: dayStart - Math.random() * 8 * 3600000,
        server,
        items,
        total: items.reduce((s, it) => s + it.price * it.qty, 0),
      });
    }
  }
  return out;
}

/** Retourne les menus seed prêts à l'emploi */
export function seedMenus() {
  return MENUS_SEED.map((m) => ({ ...m }));
}
