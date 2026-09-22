import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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
      "caisse.checkout", "caisse.split", "caisse.history",
      "gestion.tables", "gestion.products", "gestion.menus", "gestion.staff",
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
      "caisse.checkout", "caisse.split", "caisse.history", "gestion.tables", "dashboard.view",
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
      "caisse.checkout", "caisse.split",
    ],
  },
  {
    id: "cook",
    name: "Chef de cuisine",
    description: "Affichage des commandes en direct, gestion du KDS et signalement des ruptures de produits.",
    color: "#8B5A2B",
    isSystem: false,
    permissions: ["cuisine.view", "cuisine.status", "gestion.products"],
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

async function main() {
  console.log("Seeding RestoFlow Database...");

  // Clear existing data
  await prisma.orderItem.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.orderHistory.deleteMany({});
  await prisma.staff.deleteMany({});
  await prisma.role.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.menu.deleteMany({});
  await prisma.category.deleteMany({});
  await prisma.table.deleteMany({});

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
    await prisma.staff.create({
      data: {
        id: s.id,
        name: s.name,
        roleId: s.roleId,
        pin: s.pin,
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
      { id: "it_demo_1", orderId: o3.id, productId: "p7", name: "Burger Classic", price: 12, qty: 1, notes: "sans oignons", status: "preparing" },
      { id: "it_demo_2", orderId: o3.id, productId: "p18", name: "Coca-Cola", price: 4, qty: 2, notes: "", status: "preparing" },
      { id: "it_demo_3", orderId: o3.id, productId: "p10", name: "Pizza 4 Fromages", price: 14, qty: 1, notes: "", status: "preparing" },
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
      { id: "it_demo_4", orderId: o5.id, productId: "p4", name: "Entrecôte grillée", price: 22, qty: 1, notes: "cuisson saignante", status: "new" },
      { id: "it_demo_5", orderId: o5.id, productId: "p1", name: "Burrata crémeuse", price: 9, qty: 1, notes: "", status: "new" },
      { id: "it_demo_6", orderId: o5.id, productId: "p20", name: "Verre de Côtes du Rhône", price: 6, qty: 2, notes: "", status: "new" },
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
      { id: "it_demo_7", orderId: o8.id, productId: "p5", name: "Saumon rôti", price: 19, qty: 1, notes: "", status: "ready" },
      { id: "it_demo_8", orderId: o8.id, productId: "p13", name: "César Poulet", price: 13, qty: 1, notes: "", status: "ready" },
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
      { id: "it_demo_9", orderId: o10.id, productId: "p3", name: "Planche à partager", price: 14, qty: 1, notes: "", status: "served" },
      { id: "it_demo_10", orderId: o10.id, productId: "p19", name: "Eau pétillante", price: 3.5, qty: 2, notes: "", status: "served" },
      { id: "it_demo_11", orderId: o10.id, productId: "p14", name: "Salade Chèvre Chaud", price: 12, qty: 1, notes: "allergie fruits à coque", status: "preparing" },
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
