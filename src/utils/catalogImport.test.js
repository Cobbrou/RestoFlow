import { describe, it, expect } from "vitest";
import { parseCsv, productsFromCsv, CSV_TEMPLATE } from "./catalogImport.js";
import { CATEGORIES } from "../data/categories.js";

describe("import CSV de la carte", () => {
  it("lit guillemets, séparateur virgule et retours ligne Windows", () => {
    expect(parseCsv('nom,prix\r\n"Burger ""Maison"", frites",12.5\r\n\r\n')).toEqual([
      ["nom", "prix"],
      ['Burger "Maison", frites', "12.5"],
    ]);
  });

  it("importe le modèle tel quel", () => {
    const { rows } = productsFromCsv("﻿" + CSV_TEMPLATE, CATEGORIES);
    expect(rows.map((r) => r.error)).toEqual([undefined, undefined, undefined]);
    expect(rows[2].product).toEqual({
      name: "Verre de Côtes du Rhône", cat: "boissons", price: 6, desc: "12cl", emoji: "🍷",
      allergens: ["Sulfites"], options: [], available: true, vatRate: 20, station: "bar",
    });
    expect(rows[1].product.allergens).toEqual(["Lait", "Œuf", "Gluten"]);
  });

  it("signale chaque ligne invalide et les doublons sans bloquer les autres", () => {
    const csv = "Catégorie;Nom;Prix (€);TVA\nentrees;Soupe;abc;\nPizzas;Regina;13;7\nSushis;Maki;5;\nplats;Steak;18;\nPlats;steak;19;\nDesserts;Flan;4,5;";
    const { rows } = productsFromCsv(csv, CATEGORIES, [{ name: "Flan" }]);
    expect(rows.map((r) => [r.line, r.error?.split(" ")[0] ?? "ok"])).toEqual([
      [2, "Prix"], [3, "TVA"], [4, "Catégorie"], [5, "ok"], [6, "Déjà"], [7, "Déjà"],
    ]);
  });

  it("refuse un en-tête sans colonnes obligatoires", () => {
    expect(productsFromCsv("nom;tarif\nSoupe;5", CATEGORIES).error).toMatch(/categorie, prix/);
  });
});
