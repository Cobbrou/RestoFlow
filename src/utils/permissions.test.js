import { describe, it, expect } from "vitest";
import { pinLengthFor } from "./permissions.js";

describe("Longueur du PIN selon le rôle", () => {
  it("6 chiffres pour l'admin et tout rôle sensible, 4 sinon", () => {
    expect(pinLengthFor("admin", [])).toBe(6);
    for (const p of ["gestion.staff", "caisse.settings", "caisse.close", "caisse.fec"]) {
      expect(pinLengthFor("custom", ["salle.order", p]), p).toBe(6);
    }
    expect(pinLengthFor("server", ["salle.order", "caisse.checkout"])).toBe(4);
    expect(pinLengthFor("server", undefined)).toBe(4);
  });
});
