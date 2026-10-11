import { describe, it, expect } from "vitest";
import { canCachePinOffline } from "./db.js";

describe("canCachePinOffline", () => {
  it("n'autorise le cache hors-ligne que pour les comptes sans droits sensibles", () => {
    expect(canCachePinOffline({ roleId: "server", permissions: ["salle.order", "caisse.checkout"] })).toBe(true);
    expect(canCachePinOffline({ roleId: "admin", permissions: [] })).toBe(false);
    expect(canCachePinOffline({ roleId: "head_waiter", role: { permissions: ["caisse.close"] } })).toBe(false);
  });
});
