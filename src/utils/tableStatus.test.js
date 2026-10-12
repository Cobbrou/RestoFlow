import { describe, it, expect } from "vitest";
import { tableStatus, paymentRows } from "./index.js";

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
