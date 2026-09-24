import { TABLE_LAYOUT, MENUS_SEED, SERVERS } from "./tables.js";
import { PRODUCTS_SEED } from "./products.js";

/** Génère un identifiant unique avec préfixe */
export const uid = (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 9)}`;

/** Retourne un produit aléatoire du catalogue (pour le seed des commandes) */
function randomProduct() {
  return PRODUCTS_SEED[Math.floor(Math.random() * PRODUCTS_SEED.length)];
}

/** Crée un article de commande factice pour le seed */
function makeItem(status, notes, prOverride) {
  const pr = prOverride || randomProduct();
  const cat = pr.cat || "";
  const isBar = cat === "boissons" || pr.station === "bar";
  let course = isBar ? "boisson" : cat === "entrees" ? "entree" : cat === "desserts" ? "dessert" : "plat";
  return {
    id: uid("it"),
    productId: pr.id,
    name: pr.name,
    price: pr.price,
    qty: 1 + Math.floor(Math.random() * 2),
    notes: notes || "",
    status,
    course,
    courseStatus: course === "entree" || course === "boisson" ? "direct" : "held",
    station: isBar ? "bar" : "kitchen",
  };
}

/** Génère les tables initiales à partir du layout */
export function seedTables() {
  return TABLE_LAYOUT.map((t) => ({
    id: `tbl_${t.number}`,
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
    items: [
      makeItem("new", "cuisson saignante", PRODUCTS_SEED[3]), // Entrecôte grillée (plat, held)
      makeItem("new", "", PRODUCTS_SEED[0]), // Burrata crémeuse (entree, direct)
      makeItem("new", "", PRODUCTS_SEED[19]), // Verre de Côtes du Rhône (boisson, direct)
    ],
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

/** Génère les réservations initiales de démonstration (Phase 4) */
export function seedReservations() {
  const todayStr = new Date().toISOString().slice(0, 10);
  return [
    {
      id: "res_demo_1",
      customerName: "Famille Dubois",
      phone: "06 11 22 33 44",
      email: "dubois@email.fr",
      date: todayStr,
      time: "20:30",
      guests: 2,
      status: "confirmed",
      tableId: "tbl_2",
      notes: "Près de la baie vitrée",
    },
    {
      id: "res_demo_2",
      customerName: "M. Bertrand",
      phone: "06 99 88 77 66",
      email: "bertrand@outlook.com",
      date: todayStr,
      time: "21:00",
      guests: 4,
      status: "confirmed",
      tableId: "tbl_11",
      notes: "Anniversaire - dessert avec bougie",
    },
    {
      id: "res_demo_3",
      customerName: "Sophie Morel",
      phone: "07 44 55 66 77",
      email: "sophie.m@gmail.com",
      date: todayStr,
      time: "19:45",
      guests: 3,
      status: "confirmed",
      tableId: null,
      notes: "1 poussette / chaise haute",
    },
    {
      id: "res_demo_4",
      customerName: "Cabinet Valois",
      phone: "01 44 22 00 11",
      email: "valois@avocats.fr",
      date: todayStr,
      time: "12:30",
      guests: 6,
      status: "seated",
      tableId: "tbl_5",
      notes: "Déjeuner d'affaires",
    },
  ];
}
