import { describe, it, expect } from "vitest";
import { tableStatus, paymentRows, isWithinHours } from "./index.js";

describe("isWithinHours", () => {
  const at = (h, m) => new Date(2026, 9, 12, h, m);
  it("respecte les créneaux, y compris après minuit", () => {
    expect(isWithinHours(null, at(3, 0))).toBe(true);
    expect(isWithinHours("11:30-14:30, 19:00-22:30", at(12, 0))).toBe(true);
    expect(isWithinHours("11:30-14:30, 19:00-22:30", at(14, 30))).toBe(false);
    expect(isWithinHours("11:30-14:30, 19:00-22:30", at(20, 0))).toBe(true);
    expect(isWithinHours("22:00-02:00", at(1, 59))).toBe(true);
    expect(isWithinHours("22:00-02:00", at(12, 0))).toBe(false);
  });
});

describe("tableStatus : addition demandée", () => {
  const served = { items: [{ status: "served" }] };
  it("signale l'addition demandée, sous l'alerte et les plats prêts", () => {
    expect(tableStatus({}, { ...served, billRequestedAt: 1 })).toBe("bill");
    expect(tableStatus({ alert: true }, { ...served, billRequestedAt: 1 })).toBe("alert");
    expect(tableStatus({}, { items: [{ status: "ready" }], billRequestedAt: 1 })).toBe("ready");
    expect(tableStatus({}, served)).toBe("occupied");
  });
});

describe("paymentRows", () => {
  it("garde carte, espèces, autre et n'ajoute un autre mode que s'il a servi", () => {
    expect(paymentRows({ carte: 10, titre_resto: 5, cheque: 0 })).toEqual([
      ["carte", 10], ["especes", 0], ["titre_resto", 5], ["autre", 0],
    ]);
  });
});
