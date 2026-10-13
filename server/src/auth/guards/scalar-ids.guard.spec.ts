import { describe, it, expect } from "vitest";
import { assertScalarIds } from "./scalar-ids.guard";

describe("Identifiants des actions temps réel", () => {
  it("refuse un filtre Prisma à la place d'un identifiant, à toute profondeur", () => {
    expect(() => assertScalarIds({ orderId: { not: "" }, covers: 1 })).toThrow(/données.orderId/);
    expect(() => assertScalarIds({ id: "t1", data: { tableId: { in: ["a"] } } })).toThrow(/data.tableId/);
    expect(() => assertScalarIds({ product: { id: { contains: "" } } })).toThrow(/product.id/);
    expect(() => assertScalarIds({ lines: [{ itemId: { gt: "" }, qty: 1 }] })).toThrow(/lines.0.itemId/);
    expect(() => assertScalarIds({ itemIds: [{ not: "" }] })).toThrow(/itemIds/);
  });

  it("laisse passer les charges utiles légitimes", () => {
    expect(() =>
      assertScalarIds({
        orderId: "o1",
        tableId: null,
        product: { id: "p1", name: "Café", price: 2 },
        options: [{ groupId: "g1", choiceIds: ["c1", "c2"] }],
        data: { seats: 4 },
        clientActionId: "abcdefgh",
      })
    ).not.toThrow();
    expect(() => assertScalarIds(undefined)).not.toThrow();
  });
});
