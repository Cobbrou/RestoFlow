import { describe, it, expect } from "vitest";
import { reorderBySupplier, reorderCsv } from "./reorder.js";

const ing = (o) => ({ name: "X", unit: "kg", currentStock: 1, minThreshold: 2, idealStock: 5, costPerUnit: 2, ...o });

describe("reorderBySupplier", () => {
  it("commande jusqu'au stock idéal ce qui est au seuil ou dessous, groupé par fournisseur", () => {
    const groups = reorderBySupplier([
      ing({ name: "Bœuf", supplier: "Metro" }),
      ing({ name: "Œufs", unit: "piece", currentStock: 0.5, idealStock: 12, costPerUnit: 0.25, supplier: "Metro" }),
      ing({ name: "Sel", currentStock: -3 }), // stock négatif : on recommande l'idéal, pas plus
      ing({ name: "Farine", currentStock: 3 }), // au-dessus du seuil
      ing({ name: "Vieux", archived: true }),
    ]);
    expect(groups.map((g) => g.supplier)).toEqual(["Metro", "Sans fournisseur"]);
    expect(groups[0].lines.map((l) => [l.ingredient.name, l.qty])).toEqual([["Bœuf", 4], ["Œufs", 12]]);
    expect(groups[0].totalCents).toBe(800 + 300);
    expect(groups[1].lines[0].qty).toBe(5);
  });

  it("exporte un CSV lisible par Excel FR", () => {
    const csv = reorderCsv(reorderBySupplier([ing({ name: 'Crème "fluide"', supplier: "Metro", supplierRef: "CR-1", currentStock: 0.5 })]));
    expect(csv.split("\r\n")[1]).toBe('"Metro";"CR-1";"Crème ""fluide""";"4,5";"kg";"2";"9,00"');
  });
});
