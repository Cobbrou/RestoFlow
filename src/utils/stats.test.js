import { describe, it, expect } from "vitest";
import { salesByHour, salesByServer } from "./stats.js";

const at = (h, m = 0) => new Date(2026, 9, 12, h, m).getTime();
const history = [
  { createdAt: at(12, 10), total: 10.1, tip: 1, server: "Léa" },
  { createdAt: at(12, 50), total: 0.2, tip: 0, server: "Marco" },
  { createdAt: at(14, 5), total: 20, tip: 0, server: "Léa" },
  { createdAt: at(14, 30), total: -5, type: "CREDIT_NOTE", server: "Léa" },
];

describe("salesByHour", () => {
  it("cumule par heure en centimes, de la première à la dernière heure active", () => {
    expect(salesByHour(history)).toEqual([
      { name: "12h", ca: 10.3, tickets: 2 },
      { name: "13h", ca: 0, tickets: 0 },
      { name: "14h", ca: 15, tickets: 1 },
    ]);
    expect(salesByHour([])).toEqual([]);
  });
});

describe("salesByServer", () => {
  it("cumule CA, tickets hors avoirs, panier moyen et pourboires", () => {
    expect(salesByServer(history)).toEqual([
      { name: "Léa", ca: 25.1, tickets: 2, average: 12.55, tips: 1 },
      { name: "Marco", ca: 0.2, tickets: 1, average: 0.2, tips: 0 },
    ]);
  });
});
