import { describe, it, expect } from "vitest";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import { assertScalarIds, ScalarIdsGuard } from "./scalar-ids.guard";
import { WebsocketGateway } from "../../websocket/websocket.gateway";
import { ManagementGateway } from "../../management/management.gateway";
import { ReservationsGateway } from "../../reservations/reservations.gateway";

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

  it("protège chaque gateway", () => {
    for (const gateway of [WebsocketGateway, ManagementGateway, ReservationsGateway]) {
      expect(Reflect.getMetadata(GUARDS_METADATA, gateway)[0]).toBe(ScalarIdsGuard);
    }
  });
});
