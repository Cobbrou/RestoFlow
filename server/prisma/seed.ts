import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const CATEGORIES = [
  { id: "entrees", name: "Entrées", accent: "#B5451B", vatRate: 10, station: "kitchen" },
  { id: "plats", name: "Plats", accent: "#8B5E34", vatRate: 10, station: "kitchen" },
  { id: "burgers", name: "Burgers", accent: "#A6431A", vatRate: 10, station: "kitchen" },
  { id: "pizzas", name: "Pizzas", accent: "#C1440E", vatRate: 10, station: "kitchen" },
  { id: "salades", name: "Salades", accent: "#4A7856", vatRate: 10, station: "kitchen" },
  { id: "desserts", name: "Desserts", accent: "#B5793A", vatRate: 10, station: "kitchen" },
  { id: "boissons", name: "Boissons", accent: "#3E7CB1", vatRate: 10, station: "bar" },
  { id: "menus", name: "Menus", accent: "#6B4226", vatRate: 10, station: "kitchen" },
];

const PRODUCTS_SEED = [
  { id: "p1", cat: "entrees", name: "Burrata crémeuse", desc: "Tomates anciennes, basilic, huile d'olive", price: 9, emoji: "🍅", allergens: ["Lait"], vatRate: 10, station: "kitchen" },
  { id: "p2", cat: "entrees", name: "Velouté du jour", desc: "Potiron rôti, crème, noisettes", price: 7.5, emoji: "🥣", allergens: ["Lait", "Fruits à coque"], vatRate: 10, station: "kitchen" },
  { id: "p3", cat: "entrees", name: "Planche à partager", desc: "Charcuterie, fromages, pain grillé", price: 14, emoji: "🧀", allergens: ["Lait", "Gluten"], vatRate: 10, station: "kitchen" },
  { id: "p4", cat: "plats", name: "Entrecôte grillée", desc: "Frites maison, sauce au poivre", price: 22, emoji: "🥩", allergens: [], vatRate: 10, station: "kitchen" },
  { id: "p5", cat: "plats", name: "Saumon rôti", desc: "Purée de panais, beurre citronné", price: 19, emoji: "🐟", allergens: ["Poisson", "Lait"], vatRate: 10, station: "kitchen" },
  { id: "p6", cat: "plats", name: "Risotto champignons", desc: "Parmesan, huile de truffe", price: 16, emoji: "🍚", allergens: ["Lait"], vatRate: 10, station: "kitchen" },
  { id: "p7", cat: "burgers", name: "Burger Classic", desc: "Bœuf, cheddar, oignons confits", price: 12, emoji: "🍔", allergens: ["Gluten", "Lait"], vatRate: 10, station: "kitchen" },
  { id: "p8", cat: "burgers", name: "Burger Veggie", desc: "Galette de légumes, avocat, roquette", price: 12.5, emoji: "🥑", allergens: ["Gluten"], vatRate: 10, station: "kitchen" },
  { id: "p9", cat: "burgers", name: "Burger Bacon BBQ", desc: "Double bœuf, bacon, sauce barbecue", price: 14.5, emoji: "🥓", allergens: ["Gluten", "Lait"], vatRate: 10, station: "kitchen" },
  { id: "p10", cat: "pizzas", name: "Pizza 4 Fromages", desc: "Mozzarella, gorgonzola, chèvre, parmesan", price: 14, emoji: "🍕", allergens: ["Gluten", "Lait"], vatRate: 10, station: "kitchen" },
  { id: "p11", cat: "pizzas", name: "Pizza Regina", desc: "Jambon, champignons, mozzarella", price: 13, emoji: "🍕", allergens: ["Gluten", "Lait"], vatRate: 10, station: "kitchen" },
  { id: "p12", cat: "pizzas", name: "Pizza Diavola", desc: "Salami piquant, piment, mozzarella", price: 13.5, emoji: "🌶️", allergens: ["Gluten", "Lait"], vatRate: 10, station: "kitchen" },
  { id: "p13", cat: "salades", name: "César Poulet", desc: "Poulet grillé, parmesan, croûtons", price: 13, emoji: "🥗", allergens: ["Gluten", "Lait", "Œuf"], vatRate: 10, station: "kitchen" },
  { id: "p14", cat: "salades", name: "Salade Chèvre Chaud", desc: "Chèvre, miel, noix, mesclun", price: 12, emoji: "🐐", allergens: ["Lait", "Fruits à coque"], vatRate: 10, station: "kitchen" },
  { id: "p15", cat: "desserts", name: "Tiramisu maison", desc: "Mascarpone, café, cacao", price: 7, emoji: "🍰", allergens: ["Lait", "Œuf", "Gluten"], vatRate: 10, station: "kitchen" },
  { id: "p16", cat: "desserts", name: "Fondant au chocolat", desc: "Cœur coulant, glace vanille", price: 8, emoji: "🍫", allergens: ["Lait", "Œuf", "Gluten"], vatRate: 10, station: "kitchen" },
  { id: "p17", cat: "desserts", name: "Crème brûlée", desc: "Vanille de Madagascar", price: 6.5, emoji: "🍮", allergens: ["Lait", "Œuf"], vatRate: 10, station: "kitchen" },
  { id: "p18", cat: "boissons", name: "Coca-Cola", desc: "33cl", price: 4, emoji: "🥤", allergens: [], vatRate: 10, station: "bar" },
  { id: "p19", cat: "boissons", name: "Eau pétillante", desc: "50cl", price: 3.5, emoji: "💧", allergens: [], vatRate: 10, station: "bar" },
  { id: "p20", cat: "boissons", name: "Verre de Côtes du Rhône", desc: "12cl (Alcool)", price: 6, emoji: "🍷", allergens: ["Sulfites"], vatRate: 20, station: "bar" },
  { id: "p21", cat: "boissons", name: "Café", desc: "Expresso", price: 2.5, emoji: "☕", allergens: [], vatRate: 10, station: "bar" },
];

const MENUS_SEED = [
  {
    id: "menu1",
    name: "Menu Burger",
    price: 17,
    desc: "Formule burger complète",
    emoji: "🍔",
    groups: [
      { id: "g1", title: "Entrée", count: 1, productIds: ["p1", "p2", "p3"] },
      { id: "g2", title: "Plat", count: 1, productIds: ["p7", "p8", "p9"] },
      { id: "g3", title: "Dessert", count: 1, productIds: ["p15", "p16", "p17"] },
    ],
  },
  {
    id: "menu2",
    name: "Menu Midi",
    price: 19,
    desc: "Formule express du midi",
    emoji: "🍽️",
    groups: [
      { id: "g1", title: "Plat", count: 1, productIds: ["p4", "p5", "p6", "p10", "p11"] },
      { id: "g2", title: "Dessert", count: 1, productIds: ["p15", "p16", "p17"] },
      { id: "g3", title: "Boisson", count: 1, productIds: ["p18", "p19", "p21"] },
    ],
  },
];

const TABLE_LAYOUT = [
  { number: 1, seats: 2, x: 8, y: 12 },
  { number: 2, seats: 2, x: 24, y: 12 },
  { number: 3, seats: 4, x: 44, y: 10 },
  { number: 4, seats: 4, x: 68, y: 10 },
  { number: 5, seats: 6, x: 88, y: 14 },
  { number: 6, seats: 2, x: 8, y: 42 },
  { number: 7, seats: 4, x: 30, y: 44 },
  { number: 8, seats: 4, x: 54, y: 42 },
  { number: 9, seats: 2, x: 76, y: 44 },
  { number: 10, seats: 6, x: 14, y: 74 },
  { number: 11, seats: 4, x: 42, y: 76 },
  { number: 12, seats: 8, x: 72, y: 74 },
];

const INITIAL_ROLES = [
  {
    id: "admin",
    name: "Administrateur / Gérant",
    description: "Accès intégral à l'ensemble du système, aux configurations et aux paramètres financiers.",
    color: "#C1440E",
    isSystem: true,
    permissions: [
      "salle.view", "salle.order", "salle.send_kitchen", "salle.serve", "salle.reservations", "salle.alerts",
      "cuisine.view", "cuisine.status",
      "caisse.checkout", "caisse.split", "caisse.history", "caisse.discount", "caisse.settings",
      "gestion.tables", "gestion.products", "gestion.menus", "gestion.staff", "gestion.stocks", "gestion.recipes",
      "dashboard.view",
    ],
  },
  {
    id: "head_waiter",
    name: "Responsable de salle",
    description: "Supervision du service en salle, réservations, gestion des tables et encaissements.",
    color: "#3E7CB1",
    isSystem: false,
    permissions: [
      "salle.view", "salle.order", "salle.send_kitchen", "salle.serve", "salle.reservations", "salle.alerts",
      "caisse.checkout", "caisse.split", "caisse.history", "caisse.discount", "gestion.tables", "gestion.stocks", "dashboard.view",
    ],
  },
  {
    id: "server",
    name: "Serveur / Serveuse",
    description: "Prise de commande, transmission en cuisine, service des plats et encaissements courants.",
    color: "#D9A441",
    isSystem: false,
    permissions: [
      "salle.view", "salle.order", "salle.send_kitchen", "salle.serve", "salle.alerts",
      "caisse.checkout", "caisse.split", "caisse.discount",
    ],
  },
  {
    id: "cook",
    name: "Chef de cuisine",
    description: "Affichage des commandes en direct, gestion du KDS et signalement des ruptures de produits.",
    color: "#8B5A2B",
    isSystem: false,
    permissions: ["cuisine.view", "cuisine.status", "gestion.products", "gestion.stocks", "gestion.recipes"],
  },
  {
    id: "accountant",
    name: "Comptable / Finance",
    description: "Suivi des ventes, consultation des rapports financiers et historique complet des paiements.",
    color: "#6B5B95",
    isSystem: false,
    permissions: ["caisse.history", "dashboard.view"],
  },
];

const INITIAL_STAFF = [
  {
    id: "stf_1",
    name: "Léa Martin",
    roleId: "server",
    pin: "1011",
    email: "lea.martin@restoflow.fr",
    phone: "06 12 34 56 78",
    active: true,
    avatarBg: "#D9A441",
  },
  {
    id: "stf_2",
    name: "Marco Rossi",
    roleId: "server",
    pin: "2022",
    email: "marco.rossi@restoflow.fr",
    phone: "06 23 45 67 89",
    active: true,
    avatarBg: "#D9A441",
  },
  {
    id: "stf_3",
    name: "Inès Benali",
    roleId: "head_waiter",
    pin: "3033",
    email: "ines.benali@restoflow.fr",
    phone: "06 34 56 78 90",
    active: true,
    avatarBg: "#3E7CB1",
  },
  {
    id: "stf_4",
    name: "Antoine Dubois",
    roleId: "cook",
    pin: "4044",
    email: "antoine.dubois@restoflow.fr",
    phone: "06 45 67 89 01",
    active: true,
    avatarBg: "#8B5A2B",
  },
  {
    id: "stf_5",
    name: "Sarah Laurent",
    roleId: "admin",
    pin: "5055",
    email: "sarah.laurent@restoflow.fr",
    phone: "06 56 78 90 12",
    active: true,
    avatarBg: "#C1440E",
  },
];

const INGREDIENTS_SEED = [
  { id: "ing_1", name: "Steak haché pur bœuf 180g", category: "Boucherie", unit: "piece", currentStock: 45, minThreshold: 10, idealStock: 60, costPerUnit: 2.60, supplier: "Metro Viandes", supplierRef: "BOUF-180" },
  { id: "ing_2", name: "Pain brioché burger artisanal", category: "Pains", unit: "piece", currentStock: 50, minThreshold: 12, idealStock: 80, costPerUnit: 0.55, supplier: "Boulangerie des Halles", supplierRef: "PAIN-BRIO" },
  { id: "ing_3", name: "Cheddar affiné tranché", category: "Crémerie", unit: "g", currentStock: 2400, minThreshold: 500, idealStock: 3000, costPerUnit: 0.014, supplier: "Fromagerie Normande", supplierRef: "CHED-AFF" },
  { id: "ing_4", name: "Bacon fumé supérieur", category: "Boucherie", unit: "g", currentStock: 1800, minThreshold: 400, idealStock: 2500, costPerUnit: 0.016, supplier: "Metro Viandes", supplierRef: "BAC-FUM" },
  { id: "ing_5", name: "Sauce barbecue fumée", category: "Épicerie", unit: "ml", currentStock: 3000, minThreshold: 500, idealStock: 4000, costPerUnit: 0.005, supplier: "Sysco France", supplierRef: "SAUC-BBQ" },
  { id: "ing_6", name: "Pommes de terre Bintje (Frites)", category: "Maraîchage", unit: "g", currentStock: 25000, minThreshold: 5000, idealStock: 35000, costPerUnit: 0.0018, supplier: "Primeurs d'Île-de-France", supplierRef: "PDT-BINT" },
  { id: "ing_7", name: "Entrecôte bœuf Simmental 250g", category: "Boucherie", unit: "piece", currentStock: 20, minThreshold: 5, idealStock: 30, costPerUnit: 6.80, supplier: "Boucheries Nivernaises", supplierRef: "ENTR-250" },
  { id: "ing_8", name: "Sauce au poivre vert maison", category: "Épicerie", unit: "ml", currentStock: 2500, minThreshold: 500, idealStock: 3500, costPerUnit: 0.008, supplier: "Préparation Maison", supplierRef: "SAUC-POV" },
  { id: "ing_9", name: "Pavé de saumon Label Rouge 180g", category: "Poissonnerie", unit: "piece", currentStock: 18, minThreshold: 5, idealStock: 25, costPerUnit: 4.90, supplier: "Rungis Marée", supplierRef: "SAUM-180" },
  { id: "ing_10", name: "Panais frais bio", category: "Maraîchage", unit: "g", currentStock: 4000, minThreshold: 800, idealStock: 6000, costPerUnit: 0.003, supplier: "Primeurs d'Île-de-France", supplierRef: "PAN-BIO" },
  { id: "ing_11", name: "Burrata di Bufala 125g", category: "Crémerie", unit: "piece", currentStock: 22, minThreshold: 6, idealStock: 35, costPerUnit: 1.85, supplier: "Casa Italia Rungis", supplierRef: "BURR-125" },
  { id: "ing_12", name: "Tomates anciennes de plein champ", category: "Maraîchage", unit: "g", currentStock: 6000, minThreshold: 1500, idealStock: 8000, costPerUnit: 0.0035, supplier: "Primeurs d'Île-de-France", supplierRef: "TOM-ANC" },
  { id: "ing_13", name: "Pâton à pizza frais 280g", category: "Pains", unit: "piece", currentStock: 40, minThreshold: 10, idealStock: 60, costPerUnit: 0.70, supplier: "Moulins de Paris", supplierRef: "PAT-PIZ" },
  { id: "ing_14", name: "Mozzarella Fior di Latte râpée", category: "Crémerie", unit: "g", currentStock: 5000, minThreshold: 1000, idealStock: 7000, costPerUnit: 0.009, supplier: "Casa Italia Rungis", supplierRef: "MOZZ-FIO" },
  { id: "ing_15", name: "Jambon blanc supérieur cuit au torchon", category: "Boucherie", unit: "g", currentStock: 3200, minThreshold: 600, idealStock: 4000, costPerUnit: 0.015, supplier: "Metro Viandes", supplierRef: "JAMB-TOR" },
  { id: "ing_16", name: "Champignons de Paris bruns", category: "Maraîchage", unit: "g", currentStock: 2800, minThreshold: 500, idealStock: 4000, costPerUnit: 0.0045, supplier: "Primeurs d'Île-de-France", supplierRef: "CHAM-PAR" },
  { id: "ing_17", name: "Filet de poulet fermier", category: "Boucherie", unit: "g", currentStock: 4500, minThreshold: 1000, idealStock: 6000, costPerUnit: 0.012, supplier: "Metro Viandes", supplierRef: "POUL-FERM" },
  { id: "ing_18", name: "Mesclun & jeunes pousses", category: "Maraîchage", unit: "g", currentStock: 2200, minThreshold: 500, idealStock: 3000, costPerUnit: 0.008, supplier: "Primeurs d'Île-de-France", supplierRef: "MESC-SAL" },
  { id: "ing_19", name: "Parmigiano Reggiano 24 mois AOP", category: "Crémerie", unit: "g", currentStock: 1600, minThreshold: 300, idealStock: 2000, costPerUnit: 0.024, supplier: "Casa Italia Rungis", supplierRef: "PARM-24M" },
  { id: "ing_20", name: "Sauce César crémeuse", category: "Épicerie", unit: "ml", currentStock: 1800, minThreshold: 400, idealStock: 2500, costPerUnit: 0.007, supplier: "Sysco France", supplierRef: "SAUC-CES" },
  { id: "ing_21", name: "Mascarpone crémeux", category: "Crémerie", unit: "g", currentStock: 2000, minThreshold: 400, idealStock: 3000, costPerUnit: 0.0085, supplier: "Casa Italia Rungis", supplierRef: "MASC-GAL" },
  { id: "ing_22", name: "Chocolat noir Guanaja 70%", category: "Épicerie", unit: "g", currentStock: 3500, minThreshold: 600, idealStock: 5000, costPerUnit: 0.019, supplier: "Valrhona Gastronomie", supplierRef: "CHOC-70" },
  { id: "ing_23", name: "Canette Coca-Cola 33cl", category: "Boissons", unit: "piece", currentStock: 96, minThreshold: 24, idealStock: 144, costPerUnit: 0.65, supplier: "France Boissons / C10", supplierRef: "BOIS-COCA" },
  { id: "ing_24", name: "Eau San Pellegrino 50cl verre", category: "Boissons", unit: "piece", currentStock: 72, minThreshold: 18, idealStock: 96, costPerUnit: 0.55, supplier: "France Boissons / C10", supplierRef: "BOIS-SPEL" },
  { id: "ing_25", name: "Café grains 100% Arabica", category: "Épicerie", unit: "g", currentStock: 4000, minThreshold: 800, idealStock: 5000, costPerUnit: 0.022, supplier: "Torréfaction de Belleville", supplierRef: "EPIC-CAFE" },
];

const RECIPES_SEED = [
  // Burger Classic (p7, PV=12€)
  { productId: "p7", ingredientId: "ing_2", quantity: 1, unit: "piece", isCritical: true, notes: "Pain toasté" },
  { productId: "p7", ingredientId: "ing_1", quantity: 1, unit: "piece", isCritical: true, notes: "Cuisson demandée" },
  { productId: "p7", ingredientId: "ing_3", quantity: 30, unit: "g", isCritical: false, notes: "Fondu sur viande" },
  { productId: "p7", ingredientId: "ing_6", quantity: 200, unit: "g", isCritical: false, notes: "Frites d'accompagnement" },

  // Burger Bacon BBQ (p9, PV=14.5€)
  { productId: "p9", ingredientId: "ing_2", quantity: 1, unit: "piece", isCritical: true, notes: "Pain burger" },
  { productId: "p9", ingredientId: "ing_1", quantity: 2, unit: "piece", isCritical: true, notes: "Double steak" },
  { productId: "p9", ingredientId: "ing_4", quantity: 40, unit: "g", isCritical: false, notes: "Bacon croustillant" },
  { productId: "p9", ingredientId: "ing_3", quantity: 30, unit: "g", isCritical: false, notes: "Cheddar" },
  { productId: "p9", ingredientId: "ing_5", quantity: 30, unit: "ml", isCritical: false, notes: "Sauce BBQ" },
  { productId: "p9", ingredientId: "ing_6", quantity: 200, unit: "g", isCritical: false, notes: "Portion frites" },

  // Entrecôte grillée (p4, PV=22€)
  { productId: "p4", ingredientId: "ing_7", quantity: 1, unit: "piece", isCritical: true, notes: "Pièce noble de bœuf" },
  { productId: "p4", ingredientId: "ing_6", quantity: 250, unit: "g", isCritical: false, notes: "Frites fraîches" },
  { productId: "p4", ingredientId: "ing_8", quantity: 50, unit: "ml", isCritical: false, notes: "Sauce poivre" },

  // Saumon rôti (p5, PV=19€)
  { productId: "p5", ingredientId: "ing_9", quantity: 1, unit: "piece", isCritical: true, notes: "Cuit unilatéral" },
  { productId: "p5", ingredientId: "ing_10", quantity: 200, unit: "g", isCritical: false, notes: "Purée de panais" },

  // Burrata crémeuse (p1, PV=9€)
  { productId: "p1", ingredientId: "ing_11", quantity: 1, unit: "piece", isCritical: true, notes: "Pièce entière" },
  { productId: "p1", ingredientId: "ing_12", quantity: 120, unit: "g", isCritical: false, notes: "Tomates tranchées" },

  // Pizza Regina (p11, PV=13€)
  { productId: "p11", ingredientId: "ing_13", quantity: 1, unit: "piece", isCritical: true, notes: "Pâte étalée main" },
  { productId: "p11", ingredientId: "ing_14", quantity: 120, unit: "g", isCritical: true, notes: "Mozzarella" },
  { productId: "p11", ingredientId: "ing_15", quantity: 80, unit: "g", isCritical: false, notes: "Jambon blanc" },
  { productId: "p11", ingredientId: "ing_16", quantity: 60, unit: "g", isCritical: false, notes: "Champignons émincés" },

  // Salade César Poulet (p13, PV=13€)
  { productId: "p13", ingredientId: "ing_17", quantity: 150, unit: "g", isCritical: true, notes: "Poulet émincé grillé" },
  { productId: "p13", ingredientId: "ing_18", quantity: 80, unit: "g", isCritical: true, notes: "Mesclun frais" },
  { productId: "p13", ingredientId: "ing_19", quantity: 25, unit: "g", isCritical: false, notes: "Copeaux parmesan" },
  { productId: "p13", ingredientId: "ing_20", quantity: 40, unit: "ml", isCritical: false, notes: "Sauce César" },

  // Tiramisu maison (p15, PV=7€)
  { productId: "p15", ingredientId: "ing_21", quantity: 90, unit: "g", isCritical: true, notes: "Appareil mascarpone" },
  { productId: "p15", ingredientId: "ing_25", quantity: 15, unit: "g", isCritical: false, notes: "Imbibage café" },

  // Fondant au chocolat (p16, PV=8€)
  { productId: "p16", ingredientId: "ing_22", quantity: 70, unit: "g", isCritical: true, notes: "Chocolat noir" },

  // Boissons (p18, p19, p21)
  { productId: "p18", ingredientId: "ing_23", quantity: 1, unit: "piece", isCritical: true, notes: "Canette 33cl servie fraîche" },
  { productId: "p19", ingredientId: "ing_24", quantity: 1, unit: "piece", isCritical: true, notes: "Bouteille verre 50cl" },
  { productId: "p21", ingredientId: "ing_25", quantity: 8, unit: "g", isCritical: true, notes: "Extraction expresso" },
];

async function main() {
  console.log("Seeding RestoFlow Database...");

  // Clear existing data in correct dependency order
  await prisma.restaurantConfig.deleteMany({});
  await prisma.stockMovement.deleteMany({});
  await prisma.recipeItem.deleteMany({});
  await prisma.ingredient.deleteMany({});
  await prisma.orderItem.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.orderHistory.deleteMany({});
  await prisma.staff.deleteMany({});
  await prisma.role.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.menu.deleteMany({});
  await prisma.category.deleteMany({});
  await prisma.reservation.deleteMany({});
  await prisma.table.deleteMany({});

  // 0. Configuration Restaurant & Imprimantes (Phase 3)
  await prisma.restaurantConfig.create({
    data: {
      id: "default",
      name: "RestoFlow Bistrot",
      legalName: "RESTOFLOW BISTROT SAS",
      siret: "987 654 321 00012",
      vatNumber: "FR 12 987654321",
      address: "14 Rue de la Paix",
      city: "75002 Paris",
      phone: "01 42 68 55 00",
      email: "contact@restoflow-bistrot.fr",
      website: "www.restoflow.fr",
      footerNote: "Merci de votre visite ! Service & taxes compris.",
      currency: "EUR",
      tpeAutoPrint: true,
      printers: JSON.stringify([
        { id: "prn_caisse", name: "Imprimante Caisse", type: "caisse", width: "80mm", status: "online", autoCut: true, openDrawer: true },
        { id: "prn_cuisine", name: "Imprimante Cuisine", type: "cuisine", width: "80mm", status: "online", autoCut: true, beep: true },
        { id: "prn_bar", name: "Imprimante Bar", type: "bar", width: "58mm", status: "online", autoCut: true, beep: false },
      ]),
      promoCodes: JSON.stringify([
        { code: "HAPPYHOUR", label: "Happy Hour (-15%)", type: "percent", value: 15, active: true },
        { code: "STAFF", label: "Tarif Équipe (-20%)", type: "percent", value: 20, active: true },
        { code: "BIENVENUE5", label: "Offre Bienvenue (-5€)", type: "fixed", value: 5, active: true },
        { code: "FIDELITE10", label: "Remise Fidélité (-10%)", type: "percent", value: 10, active: true },
        { code: "VIP25", label: "Client Privilège (-25%)", type: "percent", value: 25, active: true },
      ]),
    },
  });

  // 1. Categories
  for (const cat of CATEGORIES) {
    await prisma.category.create({ data: cat });
  }

  // 2. Products
  for (const p of PRODUCTS_SEED) {
    await prisma.product.create({
      data: {
        id: p.id,
        name: p.name,
        cat: p.cat,
        price: p.price,
        desc: p.desc,
        emoji: p.emoji || "🍽️",
        allergens: JSON.stringify(p.allergens),
        available: true,
        isMenu: false,
        vatRate: p.vatRate || 10,
        station: p.station || "kitchen",
      },
    });
  }

  // 3. Menus
  for (const m of MENUS_SEED) {
    await prisma.menu.create({
      data: {
        id: m.id,
        name: m.name,
        price: m.price,
        desc: m.desc,
        emoji: m.emoji || "📋",
        available: true,
        groups: JSON.stringify(m.groups),
      },
    });
  }

  // 3b. Ingrédients (Phase 2)
  for (const ing of INGREDIENTS_SEED) {
    await prisma.ingredient.create({
      data: ing,
    });

    // Mouvement initial d'ouverture de stock
    await prisma.stockMovement.create({
      data: {
        id: `mov_init_${ing.id}`,
        ingredientId: ing.id,
        type: "DELIVERY",
        quantity: ing.currentStock,
        unitCost: ing.costPerUnit,
        reason: "Stock initial d'ouverture & inventaire de démarrage",
        createdAt: new Date(Date.now() - 48 * 3600000),
      },
    });
  }

  // 3c. Fiches Techniques / RecipeItems (Phase 2)
  for (let idx = 0; idx < RECIPES_SEED.length; idx++) {
    const rc = RECIPES_SEED[idx];
    await prisma.recipeItem.create({
      data: {
        id: `rc_${rc.productId}_${rc.ingredientId}`,
        ...rc,
      },
    });
  }

  // 4. Roles
  for (const r of INITIAL_ROLES) {
    await prisma.role.create({
      data: {
        id: r.id,
        name: r.name,
        description: r.description,
        color: r.color,
        isSystem: r.isSystem,
        permissions: JSON.stringify(r.permissions),
      },
    });
  }

  // 5. Staff
  for (const s of INITIAL_STAFF) {
    const hashedPin = bcrypt.hashSync(s.pin, 10);
    await prisma.staff.create({
      data: {
        id: s.id,
        name: s.name,
        roleId: s.roleId,
        pin: hashedPin,
        email: s.email,
        phone: s.phone,
        active: s.active,
        avatarBg: s.avatarBg,
      },
    });
  }

  // 6. Tables
  const createdTables = [];
  for (let i = 0; i < TABLE_LAYOUT.length; i++) {
    const t = TABLE_LAYOUT[i];
    const isT2 = t.number === 2;
    const isT11 = t.number === 11;
    const isT10 = t.number === 10;

    const created = await prisma.table.create({
      data: {
        id: `tbl_${t.number}`,
        number: t.number,
        seats: t.seats,
        x: t.x,
        y: t.y,
        reserved: isT2 || isT11,
        alert: isT10,
        reservationName: isT2 ? "Famille Dubois" : isT11 ? "M. Bertrand" : null,
        reservationPeople: isT2 ? 2 : isT11 ? 4 : null,
        reservationTime: isT2 ? "20:30" : isT11 ? "21:00" : null,
        reservationNote: null,
      },
    });
    createdTables.push(created);
  }

  // 7. Seed Orders
  const now = new Date();

  // Order Table 3 (preparing)
  const o3 = await prisma.order.create({
    data: {
      id: "ord_demo_t3",
      tableId: "tbl_3",
      server: "Léa",
      serverId: "stf_1",
      status: "open",
      createdAt: new Date(now.getTime() - 8 * 60000),
      sentAt: new Date(now.getTime() - 8 * 60000),
    },
  });
  await prisma.orderItem.createMany({
    data: [
      { id: "it_demo_1", orderId: o3.id, productId: "p7", name: "Burger Classic", price: 12, qty: 1, notes: "sans oignons", status: "preparing", course: "plat", courseStatus: "held", station: "kitchen" },
      { id: "it_demo_2", orderId: o3.id, productId: "p18", name: "Coca-Cola", price: 4, qty: 2, notes: "", status: "preparing", course: "boisson", courseStatus: "direct", station: "bar" },
      { id: "it_demo_3", orderId: o3.id, productId: "p10", name: "Pizza 4 Fromages", price: 14, qty: 1, notes: "", status: "preparing", course: "plat", courseStatus: "held", station: "kitchen" },
    ],
  });

  // Order Table 5 (new - sent 2 min ago)
  const o5 = await prisma.order.create({
    data: {
      id: "ord_demo_t5",
      tableId: "tbl_5",
      server: "Marco",
      serverId: "stf_2",
      status: "open",
      createdAt: new Date(now.getTime() - 2 * 60000),
      sentAt: new Date(now.getTime() - 2 * 60000),
    },
  });
  await prisma.orderItem.createMany({
    data: [
      { id: "it_demo_4", orderId: o5.id, productId: "p4", name: "Entrecôte grillée", price: 22, qty: 1, notes: "cuisson saignante", status: "new", course: "plat", courseStatus: "held", station: "kitchen" },
      { id: "it_demo_5", orderId: o5.id, productId: "p1", name: "Burrata crémeuse", price: 9, qty: 1, notes: "", status: "new", course: "entree", courseStatus: "direct", station: "kitchen" },
      { id: "it_demo_6", orderId: o5.id, productId: "p20", name: "Verre de Côtes du Rhône", price: 6, qty: 2, notes: "", status: "new", course: "boisson", courseStatus: "direct", station: "bar" },
    ],
  });

  // Order Table 8 (ready - sent 14 min ago)
  const o8 = await prisma.order.create({
    data: {
      id: "ord_demo_t8",
      tableId: "tbl_8",
      server: "Inès",
      serverId: "stf_3",
      status: "open",
      createdAt: new Date(now.getTime() - 14 * 60000),
      sentAt: new Date(now.getTime() - 14 * 60000),
    },
  });
  await prisma.orderItem.createMany({
    data: [
      { id: "it_demo_7", orderId: o8.id, productId: "p5", name: "Saumon rôti", price: 19, qty: 1, notes: "", status: "ready", course: "plat", courseStatus: "called", station: "kitchen" },
      { id: "it_demo_8", orderId: o8.id, productId: "p13", name: "César Poulet", price: 13, qty: 1, notes: "", status: "ready", course: "plat", courseStatus: "called", station: "kitchen" },
    ],
  });

  // Order Table 10 (mixed - served + allergy)
  const o10 = await prisma.order.create({
    data: {
      id: "ord_demo_t10",
      tableId: "tbl_10",
      server: "Léa",
      serverId: "stf_1",
      status: "open",
      createdAt: new Date(now.getTime() - 20 * 60000),
      sentAt: new Date(now.getTime() - 20 * 60000),
    },
  });
  await prisma.orderItem.createMany({
    data: [
      { id: "it_demo_9", orderId: o10.id, productId: "p3", name: "Planche à partager", price: 14, qty: 1, notes: "", status: "served", course: "entree", courseStatus: "direct", station: "kitchen" },
      { id: "it_demo_10", orderId: o10.id, productId: "p19", name: "Eau pétillante", price: 3.5, qty: 2, notes: "", status: "served", course: "boisson", courseStatus: "direct", station: "bar" },
      { id: "it_demo_11", orderId: o10.id, productId: "p14", name: "Salade Chèvre Chaud", price: 12, qty: 1, notes: "allergie fruits à coque", status: "preparing", course: "plat", courseStatus: "called", station: "kitchen" },
    ],
  });

  // 8. Order History (for Dashboard)
  const servers = ["Léa", "Marco", "Inès"];
  const paymentMethods = ["carte", "especes", "partage"];

  for (let d = 6; d >= 0; d--) {
    const dayTimestamp = now.getTime() - d * 86400000;
    const ordersPerDay = 10 + Math.floor(Math.random() * 6);

    for (let j = 0; j < ordersPerDay; j++) {
      const server = servers[Math.floor(Math.random() * servers.length)];
      const method = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];
      const items = [
        { id: `hist_it_${d}_${j}_1`, productId: "p7", name: "Burger Classic", price: 12, qty: 2, status: "served" },
        { id: `hist_it_${d}_${j}_2`, productId: "p15", name: "Tiramisu maison", price: 7, qty: 2, status: "served" },
        { id: `hist_it_${d}_${j}_3`, productId: "p18", name: "Coca-Cola", price: 4, qty: 2, status: "served" },
      ];
      const total = items.reduce((s, it) => s + it.price * it.qty, 0);

      await prisma.orderHistory.create({
        data: {
          id: `hist_${d}_${j}`,
          orderId: `ord_old_${d}_${j}`,
          tableNumber: (j % 12) + 1,
          server,
          items: JSON.stringify(items),
          total,
          paymentMethod: method,
          payments: JSON.stringify([
            { id: `pay_${d}_${j}`, label: "Paiement", amount: total, method, paidAt: dayTimestamp - j * 1800000 },
          ]),
          createdAt: new Date(dayTimestamp - j * 1800000),
        },
      });
    }
  }

  // 9. Reservations (Phase 4)
  const todayStr = new Date().toISOString().slice(0, 10);
  await prisma.reservation.createMany({
    data: [
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
    ],
  });

  console.log("Database seeded successfully!");
}

main()
  .catch((e) => {
    console.error("Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
