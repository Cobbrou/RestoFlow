import { describe, it, expect } from "vitest";
import { compatibleUnits, conversionFactor, toStockQty } from "./units.js";

describe("conversion d'unités (copie client)", () => {
  it("mêmes résultats que le serveur", () => {
    expect(toStockQty(150, "g", "kg")).toBeCloseTo(0.15);
    expect(toStockQty(4, "cl", "l")).toBeCloseTo(0.04);
    expect(conversionFactor("g", "l")).toBeNull();
    expect(compatibleUnits("kg")).toEqual(["g", "kg"]);
  });
});
