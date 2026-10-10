import { describe, it, expect } from "vitest";
import { normalizeOptionGroups, resolveOptions } from "./pricing";

const groups = normalizeOptionGroups([
  { name: "Cuisson", required: true, max: 1, choices: [{ label: "Saignant" }, { label: "À point" }] },
  { name: "Suppléments", max: 2, choices: [{ label: "Bacon", price: 2 }, { label: "Œuf", price: 1.5 }, { label: "Cheddar", price: 1 }] },
]);

describe("options produit", () => {
  it("nettoie la saisie : prix négatifs, groupes vides, max borné", () => {
    const g = normalizeOptionGroups([
      { name: " Sauce ", max: 99, choices: [{ label: "Poivre", price: -3 }, { label: "" }, { label: "Poivre" }] },
      { name: "Vide", choices: [] },
      "n'importe quoi",
    ]);
    expect(g).toEqual([{ name: "Sauce", required: false, max: 1, choices: [{ label: "Poivre", price: 0 }] }]);
  });

  it("calcule libellé et supplément dans l'ordre des groupes", () => {
    const r = resolveOptions(groups, [
      { group: "Suppléments", choice: "Œuf" },
      { group: "Cuisson", choice: "Saignant" },
      { group: "Suppléments", choice: "Bacon" },
    ]);
    expect(r.extraCents).toBe(350);
    expect(r.label).toBe("Saignant · Bacon (+2.00€) · Œuf (+1.50€)");
  });

  it("refuse une sélection invalide", () => {
    expect(() => resolveOptions(groups, [])).toThrow("Choix obligatoire");
    expect(() => resolveOptions(groups, [{ group: "Cuisson", choice: "Bleu" }])).toThrow();
    expect(() => resolveOptions(groups, [{ group: "Cuisson", choice: "Saignant" }, { group: "Cuisson", choice: "Saignant" }])).toThrow();
    expect(() => resolveOptions(groups, [{ group: "Cuisson", choice: "Saignant" }, { group: "Sauce", choice: "x" }])).toThrow();
    expect(() =>
      resolveOptions(groups, [
        { group: "Cuisson", choice: "À point" },
        { group: "Suppléments", choice: "Bacon" },
        { group: "Suppléments", choice: "Œuf" },
        { group: "Suppléments", choice: "Cheddar" },
      ])
    ).toThrow("2 choix maximum");
  });

  it("produit sans options : rien à payer en plus", () => {
    expect(resolveOptions([], undefined)).toEqual({ label: "", extraCents: 0 });
  });
});
