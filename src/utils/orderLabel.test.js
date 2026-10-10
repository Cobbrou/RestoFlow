import { describe, it, expect } from "vitest";
import { orderLabel, isOffPremise } from "./index.js";

describe("orderLabel (même rendu que le serveur)", () => {
  it("salle : numéro de table, depuis la commande ou la liste des tables", () => {
    expect(orderLabel({ tableId: "t1", table: { number: 4 } })).toBe("Table 4");
    expect(orderLabel({ type: "dine_in", tableId: "t1" }, [{ id: "t1", number: 7 }])).toBe("Table 7");
  });

  it("emporter : numéro d'appel et client, numéro en attente tant que le serveur ne l'a pas attribué", () => {
    expect(orderLabel({ type: "takeaway", pickupNumber: 12, customerName: "Dupont" })).toBe("Emporter #12 · Dupont");
    expect(orderLabel({ type: "takeaway", pickupNumber: null })).toBe("Emporter #…");
    expect(isOffPremise({ type: "takeaway" })).toBe(true);
    expect(isOffPremise({ tableId: "t1" })).toBe(false);
  });
});
