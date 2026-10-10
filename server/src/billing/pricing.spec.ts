import { describe, it, expect } from "vitest";
import { computeDiscountCents, computeVatBreakdown, effectivePrice, isHappyHourActive } from "./pricing";

describe("pricing (calculs serveur en centimes)", () => {
  it("3 x 3,33 € à 10 % : 9,99 TTC sans dérive", () => {
    const res = computeVatBreakdown([{ price: 3.33, qty: 3, vatRate: 10 }]);
    expect(res.totalTTC).toBe(9.99);
    expect(res.totalHT).toBe(9.08);
    expect(res.totalVAT).toBe(0.91);
  });

  it("remise 20 % répartie sur 10 % et 20 %, somme des TTC = total", () => {
    const res = computeVatBreakdown(
      [
        { price: 20, qty: 1, vatRate: 10 },
        { price: 10, qty: 1, vatRate: 20 },
      ],
      { type: "percent", value: 20 }
    );
    expect(res.discountAmount).toBe(6);
    expect(res.totalTTC).toBe(24);
    expect(res.rates.reduce((s, r) => s + Math.round(r.ttc * 100), 0)).toBe(2400);
    expect(Math.round((res.totalHT + res.totalVAT) * 100)).toBe(2400);
  });

  it("gère le taux 5,5 %", () => {
    const res = computeVatBreakdown([{ price: 10.55, qty: 1, vatRate: 5.5 }]);
    expect(res.rates[0].rate).toBe(5.5);
    expect(res.totalHT).toBe(10);
    expect(res.totalVAT).toBe(0.55);
  });

  it("borne les remises : pourcentage > 100 et montant fixe > sous-total", () => {
    expect(computeDiscountCents(1000, { type: "percent", value: 150 })).toBe(1000);
    expect(computeDiscountCents(1000, { type: "fixed", value: 999 })).toBe(1000);
    expect(computeDiscountCents(1000, { type: "fixed", value: -5 })).toBe(0);
    expect(computeDiscountCents(1000, { type: "inconnu", value: 50 })).toBe(0);
  });

  it("prix Happy Hour selon l'heure", () => {
    const hh = { enabled: true, startTime: "17:00", endTime: "20:00", days: [0, 1, 2, 3, 4, 5, 6], categories: ["boissons"], discountPercent: 20 };
    const in_ = new Date(2026, 9, 10, 18, 0);
    const out = new Date(2026, 9, 10, 21, 0);
    expect(isHappyHourActive(hh, in_)).toBe(true);
    expect(effectivePrice({ price: 5, cat: "boissons" }, hh, in_)).toBe(4);
    expect(effectivePrice({ price: 5, cat: "boissons" }, hh, out)).toBe(5);
    expect(effectivePrice({ price: 5, cat: "boissons", happyHourPrice: 3.5 }, hh, in_)).toBe(3.5);
    expect(effectivePrice({ price: 12, cat: "plats" }, hh, in_)).toBe(12);
  });
});
