/**
 * Catalogue de produits initiaux (seed).
 * En production, ces données viendraient d'une API ou d'une base de données.
 */
export const PRODUCTS_SEED = [
  // Entrées
  { id: "p1",  cat: "entrees",  name: "Burrata crémeuse",         desc: "Tomates anciennes, basilic, huile d'olive",         price: 9,    emoji: "🍅", allergens: ["Lait"] },
  { id: "p2",  cat: "entrees",  name: "Velouté du jour",           desc: "Potiron rôti, crème, noisettes",                    price: 7.5,  emoji: "🥣", allergens: ["Lait", "Fruits à coque"] },
  { id: "p3",  cat: "entrees",  name: "Planche à partager",        desc: "Charcuterie, fromages, pain grillé",                price: 14,   emoji: "🧀", allergens: ["Lait", "Gluten"] },
  // Plats
  { id: "p4",  cat: "plats",    name: "Entrecôte grillée",         desc: "Frites maison, sauce au poivre",                    price: 22,   emoji: "🥩", allergens: [] },
  { id: "p5",  cat: "plats",    name: "Saumon rôti",               desc: "Purée de panais, beurre citronné",                  price: 19,   emoji: "🐟", allergens: ["Poisson", "Lait"] },
  { id: "p6",  cat: "plats",    name: "Risotto champignons",        desc: "Parmesan, huile de truffe",                         price: 16,   emoji: "🍚", allergens: ["Lait"] },
  // Burgers
  { id: "p7",  cat: "burgers",  name: "Burger Classic",            desc: "Bœuf, cheddar, oignons confits",                    price: 12,   emoji: "🍔", allergens: ["Gluten", "Lait"] },
  { id: "p8",  cat: "burgers",  name: "Burger Veggie",             desc: "Galette de légumes, avocat, roquette",              price: 12.5, emoji: "🥑", allergens: ["Gluten"] },
  { id: "p9",  cat: "burgers",  name: "Burger Bacon BBQ",          desc: "Double bœuf, bacon, sauce barbecue",                price: 14.5, emoji: "🥓", allergens: ["Gluten", "Lait"] },
  // Pizzas
  { id: "p10", cat: "pizzas",   name: "Pizza 4 Fromages",          desc: "Mozzarella, gorgonzola, chèvre, parmesan",          price: 14,   emoji: "🍕", allergens: ["Gluten", "Lait"] },
  { id: "p11", cat: "pizzas",   name: "Pizza Regina",              desc: "Jambon, champignons, mozzarella",                   price: 13,   emoji: "🍕", allergens: ["Gluten", "Lait"] },
  { id: "p12", cat: "pizzas",   name: "Pizza Diavola",             desc: "Salami piquant, piment, mozzarella",                price: 13.5, emoji: "🌶️", allergens: ["Gluten", "Lait"] },
  // Salades
  { id: "p13", cat: "salades",  name: "César Poulet",              desc: "Poulet grillé, parmesan, croûtons",                 price: 13,   emoji: "🥗", allergens: ["Gluten", "Lait", "Œuf"] },
  { id: "p14", cat: "salades",  name: "Salade Chèvre Chaud",       desc: "Chèvre, miel, noix, mesclun",                      price: 12,   emoji: "🐐", allergens: ["Lait", "Fruits à coque"] },
  // Desserts
  { id: "p15", cat: "desserts", name: "Tiramisu maison",           desc: "Mascarpone, café, cacao",                           price: 7,    emoji: "🍰", allergens: ["Lait", "Œuf", "Gluten"] },
  { id: "p16", cat: "desserts", name: "Fondant au chocolat",       desc: "Cœur coulant, glace vanille",                       price: 8,    emoji: "🍫", allergens: ["Lait", "Œuf", "Gluten"] },
  { id: "p17", cat: "desserts", name: "Crème brûlée",              desc: "Vanille de Madagascar",                             price: 6.5,  emoji: "🍮", allergens: ["Lait", "Œuf"] },
  // Boissons
  { id: "p18", cat: "boissons", name: "Coca-Cola",                 desc: "33cl",                                              price: 4,    emoji: "🥤", allergens: [] },
  { id: "p19", cat: "boissons", name: "Eau pétillante",            desc: "50cl",                                              price: 3.5,  emoji: "💧", allergens: [] },
  { id: "p20", cat: "boissons", name: "Verre de Côtes du Rhône",   desc: "12cl (Alcool)",                                     price: 6,    emoji: "🍷", allergens: ["Sulfites"], vatRate: 20 },
  { id: "p21", cat: "boissons", name: "Café",                      desc: "Expresso",                                          price: 2.5,  emoji: "☕", allergens: [] },
];
