/**
 * Données de seed pour le plan de salle.
 * Chaque table a un numéro, un nombre de places et une position (x, y) en % sur le plan.
 */
export const TABLE_LAYOUT = [
  { number: 1,  seats: 2, x: 8,  y: 12 },
  { number: 2,  seats: 2, x: 24, y: 12 },
  { number: 3,  seats: 4, x: 44, y: 10 },
  { number: 4,  seats: 4, x: 68, y: 10 },
  { number: 5,  seats: 6, x: 88, y: 14 },
  { number: 6,  seats: 2, x: 8,  y: 42 },
  { number: 7,  seats: 4, x: 30, y: 44 },
  { number: 8,  seats: 4, x: 54, y: 42 },
  { number: 9,  seats: 2, x: 76, y: 44 },
  { number: 10, seats: 6, x: 14, y: 74 },
  { number: 11, seats: 4, x: 42, y: 76 },
  { number: 12, seats: 8, x: 72, y: 74 },
];

/** Serveurs disponibles (pour assigner les commandes) */
export const SERVERS = ["Léa", "Marco", "Inès"];

/**
 * Menus composés (seed).
 * Chaque menu contient des groupes de choix — ex : "Entrée au choix parmi..."
 */
export const MENUS_SEED = [
  {
    id: "menu1",
    name: "Menu Burger",
    price: 17,
    emoji: "🍔",
    desc: "",
    groups: [
      { id: "g1", title: "Entrée",  count: 1, productIds: ["p1", "p2", "p3"] },
      { id: "g2", title: "Plat",    count: 1, productIds: ["p7", "p8", "p9"] },
      { id: "g3", title: "Dessert", count: 1, productIds: ["p15", "p16", "p17"] },
    ],
  },
  {
    id: "menu2",
    name: "Menu Midi",
    price: 19,
    emoji: "🍽️",
    desc: "",
    groups: [
      { id: "g1", title: "Plat",    count: 1, productIds: ["p4", "p5", "p6", "p10", "p11"] },
      { id: "g2", title: "Dessert", count: 1, productIds: ["p15", "p16", "p17"] },
      { id: "g3", title: "Boisson", count: 1, productIds: ["p18", "p19", "p21"] },
    ],
  },
];
