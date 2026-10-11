import { describe, it, expect } from "vitest";
import { conversionFactor, toStockQty } from "./units";

describe("conversion d'unités des fiches techniques", () => {
  it("convertit dans un même groupe, refuse les groupes incompatibles", () => {
    expect(toStockQty(150, "g", "kg")).toBeCloseTo(0.15);
    expect(toStockQty(4, "cl", "l")).toBeCloseTo(0.04);
    expect(toStockQty(0.2, "kg", "g")).toBeCloseTo(200);
    expect(toStockQty(2, "piece", "piece")).toBe(2);
    expect(conversionFactor("g", "l")).toBeNull();
    expect(conversionFactor("pincée", "g")).toBeNull();
  });
});
