/**
 * Import de la carte depuis un CSV (export Excel / Google Sheets / ancienne caisse).
 * Colonnes reconnues par leur en-tête, dans n'importe quel ordre (casse et accents ignorés) :
 *   categorie*, nom*, prix*, description, tva, poste (cuisine | bar), allergenes, emoji
 */

export const CSV_TEMPLATE = [
  "categorie;nom;prix;description;tva;poste;allergenes;emoji",
  "Plats;Entrecôte grillée;22,00;Frites maison, sauce au poivre;10;cuisine;;🥩",
  "Desserts;Tiramisu maison;7,00;Mascarpone, café;10;cuisine;Lait, Œuf, Gluten;🍰",
  "Boissons;Verre de Côtes du Rhône;6,00;12cl;20;bar;Sulfites;🍷",
].join("\n");

const COLUMNS = { categorie: "cat", nom: "name", prix: "price", description: "desc", tva: "vatRate", poste: "station", allergenes: "allergens", emoji: "emoji" };
const REQUIRED = ["categorie", "nom", "prix"];
const VAT_RATES = [2.1, 5.5, 10, 20];
const STATIONS = { cuisine: "kitchen", kitchen: "kitchen", bar: "bar" };

const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
const num = (s) => (String(s).trim() === "" ? NaN : Number(String(s).replace(/[€\s]/g, "").replace(",", ".")));

// CSV standard (guillemets, "" échappé, retour ligne dans un champ). Séparateur « ; » (Excel FR) ou « , », deviné sur l'en-tête.
export function parseCsv(text) {
  const src = String(text).replace(/^﻿/, "");
  const header = src.split(/\r?\n/, 1)[0];
  const sep = (header.match(/,/g) || []).length > (header.match(/;/g) || []).length ? "," : ";";
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c !== '"') field += c;
      else if (src[i + 1] === '"') { field += '"'; i++; }
      else quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === sep) { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((f) => f.trim()));
}

/**
 * Transforme le CSV en produits prêts à créer.
 * Retourne { error } si l'en-tête est inutilisable, sinon { rows: [{ line, product?, error? }] }
 * (une ligne en erreur ou déjà présente dans la carte n'est pas importée).
 */
export function productsFromCsv(text, categories, existingProducts = []) {
  const [header, ...lines] = parseCsv(text);
  if (!header) return { error: "Fichier vide" };
  const keys = header.map((h) => norm(h).replace(/[^a-z]/g, ""));
  const missing = REQUIRED.filter((k) => !keys.includes(k));
  if (missing.length) return { error: `Colonnes obligatoires manquantes : ${missing.join(", ")}` };

  const seen = new Set(existingProducts.map((p) => norm(p.name)));
  const catNames = categories.map((c) => c.name).join(", ");

  const rows = lines.map((cells, i) => {
    const line = i + 2;
    const v = {};
    keys.forEach((k, j) => { if (COLUMNS[k]) v[COLUMNS[k]] = (cells[j] ?? "").trim(); });

    const cat = categories.find((c) => norm(c.id) === norm(v.cat) || norm(c.name) === norm(v.cat));
    const price = num(v.price);
    const vatRate = v.vatRate ? num(v.vatRate) : undefined;
    const station = v.station ? STATIONS[norm(v.station)] : undefined;

    let error = null;
    if (!v.name) error = "Nom manquant";
    else if (!cat) error = `Catégorie « ${v.cat} » inconnue (attendu : ${catNames})`;
    else if (!Number.isFinite(price) || price < 0) error = `Prix invalide : « ${v.price} »`;
    else if (vatRate !== undefined && !VAT_RATES.includes(vatRate)) error = `TVA invalide : « ${v.vatRate} » (2,1 / 5,5 / 10 / 20)`;
    else if (v.station && !station) error = `Poste invalide : « ${v.station} » (cuisine ou bar)`;
    else if (seen.has(norm(v.name))) error = "Déjà dans la carte";
    if (error) return { line, name: v.name, error };

    seen.add(norm(v.name));
    const product = {
      name: v.name,
      cat: cat.id,
      price,
      desc: v.desc || "",
      emoji: v.emoji || "🍽️",
      allergens: (v.allergens || "").split(/[,|]/).map((s) => s.trim()).filter(Boolean),
      options: [],
      available: true,
    };
    if (vatRate !== undefined) product.vatRate = vatRate;
    if (station) product.station = station;
    return { line, name: v.name, product };
  });

  return { rows };
}
