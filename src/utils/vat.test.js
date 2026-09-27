import { describe, it, expect } from "vitest";
import { calculateVatBreakdown } from "./vat.js";

describe("TVA & Fiscalité - calculateVatBreakdown", () => {
  it("calcule correctement la ventilation pour un produit unique à 10%", () => {
    const items = [{ name: "Plat du jour", price: 15.0, qty: 1, vatRate: 10, status: "served" }];
    const res = calculateVatBreakdown(items);

    expect(res.subtotal).toBe(15.0);
    expect(res.totalTTC).toBe(15.0);
    expect(res.discountAmount).toBe(0);
    expect(res.rates).toHaveLength(1);
    expect(res.rates[0].rate).toBe(10);
    expect(res.rates[0].ht).toBe(13.64);
    expect(res.rates[0].vat).toBe(1.36);
    expect(res.totalHT).toBe(13.64);
    expect(res.totalVAT).toBe(1.36);
  });

  it("calcule correctement le multi-taux 10% (nourriture) et 20% (alcool)", () => {
    const items = [
      { name: "Burger", price: 16.0, qty: 1, vatRate: 10, status: "served" },
      { name: "Bouteille de vin", price: 24.0, qty: 1, vatRate: 20, status: "served" },
    ];
    const res = calculateVatBreakdown(items);

    expect(res.subtotal).toBe(40.0);
    expect(res.totalTTC).toBe(40.0);
    expect(res.rates).toHaveLength(2);

    const rate10 = res.rates.find((r) => r.rate === 10);
    const rate20 = res.rates.find((r) => r.rate === 20);

    expect(rate10.rawTtc).toBe(16.0);
    expect(rate10.ht).toBe(14.55);
    expect(rate10.vat).toBe(1.45);

    expect(rate20.rawTtc).toBe(24.0);
    expect(rate20.ht).toBe(20.0);
    expect(rate20.vat).toBe(4.0);

    expect(res.totalHT).toBe(34.55);
    expect(res.totalVAT).toBe(5.45);
    expect(Math.round((res.totalHT + res.totalVAT) * 100) / 100).toBe(40.0);
  });

  it("applique fidèlement une remise en pourcentage avec lissage au centime", () => {
    const items = [
      { name: "Plat", price: 20.0, qty: 1, vatRate: 10, status: "served" },
      { name: "Cocktail", price: 10.0, qty: 1, vatRate: 20, status: "served" },
    ];
    // Remise de 20% sur 30€ = 6€ de remise -> Total net 24€
    const res = calculateVatBreakdown(items, { type: "percent", value: 20 });

    expect(res.subtotal).toBe(30.0);
    expect(res.discountAmount).toBe(6.0);
    expect(res.totalTTC).toBe(24.0);

    // Vérifie que la somme des TTC par taux égale le total net
    const sumTtc = res.rates.reduce((sum, r) => sum + r.ttc, 0);
    expect(Math.round(sumTtc * 100) / 100).toBe(24.0);
  });

  it("ignore les articles à l'état 'draft'", () => {
    const items = [
      { name: "Plat validé", price: 12.0, qty: 1, vatRate: 10, status: "served" },
      { name: "Article en brouillon", price: 50.0, qty: 1, vatRate: 10, status: "draft" },
    ];
    const res = calculateVatBreakdown(items);

    expect(res.totalTTC).toBe(12.0);
    expect(res.subtotal).toBe(12.0);
  });

  it("gère un panier vide sans générer d'erreur de division", () => {
    const res = calculateVatBreakdown([]);
    expect(res.totalTTC).toBe(0);
    expect(res.totalHT).toBe(0);
    expect(res.totalVAT).toBe(0);
    expect(res.rates).toEqual([]);
  });
});
