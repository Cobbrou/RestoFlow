import { describe, it, expect, vi } from "vitest";
import { StockService, numOr } from "./stock.service";

describe("StockService.recordMovement", () => {
  const make = (stockAfterIncrement: number) => {
    const ingredient = { id: "ing1", currentStock: 999, costPerUnit: 2, recipeItems: [] };
    const tx: any = {
      ingredient: {
        update: vi.fn(async ({ data }) => ({
          ...ingredient,
          currentStock: typeof data.currentStock === "number" ? data.currentStock : stockAfterIncrement,
        })),
      },
      stockMovement: { create: vi.fn(async ({ data }) => data) },
    };
    const prisma: any = {
      ingredient: { findUnique: vi.fn().mockResolvedValue(ingredient) },
      $transaction: vi.fn((fn) => fn(tx)),
    };
    return { tx, service: new StockService(prisma) };
  };

  it("incrémente en base au lieu de réécrire une valeur relue (déstockage concurrent préservé)", async () => {
    const { tx, service } = make(15);
    const res = await service.recordMovement({ ingredientId: "ing1", type: "DELIVERY", quantity: 10 });
    expect(tx.ingredient.update.mock.calls[0][0].data.currentStock).toEqual({ increment: 10 });
    expect(res.ingredient.currentStock).toBe(15);
  });

  it("ramène à 0 un stock passé en négatif", async () => {
    const { tx, service } = make(-3);
    const res = await service.recordMovement({ ingredientId: "ing1", type: "WASTE", quantity: -5 });
    expect(tx.ingredient.update).toHaveBeenLastCalledWith({ where: { id: "ing1" }, data: { currentStock: 0 } });
    expect(res.ingredient.currentStock).toBe(0);
  });
});

describe("numOr", () => {
  it("garde 0 (seuil d'alerte), défaut seulement si vide ou invalide", () => {
    expect(numOr(0, 5)).toBe(0);
    expect(numOr("2.5", 5)).toBe(2.5);
    expect(numOr("", 5)).toBe(5);
    expect(numOr(undefined, 5)).toBe(5);
    expect(numOr("abc", 5)).toBe(5);
  });
});
