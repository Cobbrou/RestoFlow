import { describe, it, expect } from "vitest";
import { aggregateClosings, periodBounds, signPeriodClosing } from "./period";

describe("clôtures périodiques", () => {
  it("bornes d'un mois (décembre inclus) et d'une année, format invalide refusé", () => {
    expect(periodBounds("MONTH", "2026-12")).toEqual({ start: new Date(2026, 11, 1), end: new Date(2027, 0, 1) });
    expect(periodBounds("YEAR", "2026")).toEqual({ start: new Date(2026, 0, 1), end: new Date(2027, 0, 1) });
    expect(periodBounds("MONTH", "2026-13")).toBeNull();
    expect(periodBounds("YEAR", "26")).toBeNull();
  });

  it("cumule les Z au centime près, règlements et TVA par taux", () => {
    const z = (net: number, cash: number) => ({
      totalGross: net, totalDiscounts: 0, totalNet: net, totalHT: 0.1, totalVAT: 0.2, totalTips: 0.1,
      ticketsCount: 2, coversCount: 3,
      paymentsBreakdown: JSON.stringify({ especes: cash, carte: net - cash }),
      vatBreakdown: JSON.stringify([{ rate: 10, ht: 0.1, vat: 0.01, ttc: 0.11 }]),
    });
    const res = aggregateClosings([z(10.1, 0.1), z(20.2, 0.2), z(0.3, 0)]);
    expect(res.totalNet).toBe(30.6); // 10.1 + 20.2 + 0.3 sans dérive flottante
    expect(res.totalVAT).toBe(0.6);
    expect(res.ticketsCount).toBe(6);
    expect(res.coversCount).toBe(9);
    expect(res.paymentsBreakdown.especes).toBe(0.3);
    expect(res.vatBreakdown).toEqual([{ rate: 10, ht: 0.3, vat: 0.03, ttc: 0.33 }]);
  });

  it("toute altération d'un montant casse la signature", () => {
    const p = {
      sequenceNumber: 1, reportNumber: "M-2026-10", type: "MONTH", period: "2026-10", closedAt: new Date(2026, 10, 1),
      closedBy: "Admin", closingsCount: 30, totalNet: 1000, totalHT: 900, totalVAT: 100, ticketsCount: 50,
      grandTotal: 5000, previousHash: null,
    };
    const sig = signPeriodClosing(p, "k");
    expect(signPeriodClosing({ ...p }, "k")).toBe(sig);
    expect(signPeriodClosing({ ...p, totalNet: 999 }, "k")).not.toBe(sig);
  });
});
