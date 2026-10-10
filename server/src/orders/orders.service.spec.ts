import { describe, it, expect, vi, beforeEach } from "vitest";
import { BadRequestException } from "@nestjs/common";
import { OrdersService, heldToRelease, orderLabel } from "./orders.service";

describe("OrdersService.voidItem", () => {
  let service: OrdersService;
  let prisma: any;
  const sent = { id: "it1", orderId: "o1", status: "new", qty: 3, order: { status: "open", table: { number: 4 } } };

  beforeEach(() => {
    prisma = {
      orderItem: { findUnique: vi.fn(), delete: vi.fn(), update: vi.fn() },
      order: { findUnique: vi.fn().mockResolvedValue({ id: "o1", items: [] }) },
    };
    service = new OrdersService(prisma);
  });

  it("réduit la quantité sur une annulation partielle", async () => {
    prisma.orderItem.findUnique.mockResolvedValue(sent);
    const res = await service.voidItem("o1", "it1", 1);
    expect(prisma.orderItem.update).toHaveBeenCalledWith({ where: { id: "it1" }, data: { qty: 2 } });
    expect(res.voidQty).toBe(1);
    expect(res.tableNumber).toBe(4);
  });

  it("supprime la ligne sans quantité précisée", async () => {
    prisma.orderItem.findUnique.mockResolvedValue(sent);
    await service.voidItem("o1", "it1");
    expect(prisma.orderItem.delete).toHaveBeenCalledWith({ where: { id: "it1" } });
  });

  it("refuse une quantité hors bornes, un brouillon ou une commande encaissée", async () => {
    prisma.orderItem.findUnique.mockResolvedValue(sent);
    await expect(service.voidItem("o1", "it1", 4)).rejects.toThrow(BadRequestException);
    await expect(service.voidItem("o1", "it1", 0)).rejects.toThrow(BadRequestException);
    prisma.orderItem.findUnique.mockResolvedValue({ ...sent, status: "draft" });
    await expect(service.voidItem("o1", "it1")).rejects.toThrow(BadRequestException);
    prisma.orderItem.findUnique.mockResolvedValue({ ...sent, order: { status: "closed" } });
    await expect(service.voidItem("o1", "it1")).rejects.toThrow(BadRequestException);
    expect(prisma.orderItem.delete).not.toHaveBeenCalled();
    expect(prisma.orderItem.update).not.toHaveBeenCalled();
  });
});

describe("heldToRelease (cadencement à l'envoi)", () => {
  const it_ = (id: string, course: string, status = "draft", courseStatus = course === "plat" || course === "dessert" ? "held" : "direct") => ({ id, course, status, courseStatus });

  it("burger seul : le plat part directement", () => {
    expect(heldToRelease([it_("b", "plat"), it_("v", "boisson")], true)).toEqual(["b"]);
  });

  it("entrée + plat + dessert : seule l'entrée part, plat et dessert attendent", () => {
    expect(heldToRelease([it_("e", "entree"), it_("p", "plat"), it_("d", "dessert")], true)).toEqual([]);
  });

  it("plat + dessert : le plat part, le dessert attend", () => {
    expect(heldToRelease([it_("p", "plat"), it_("d", "dessert")], true)).toEqual(["p"]);
  });

  it("entrées déjà servies : le plat ajouté ensuite part directement", () => {
    expect(heldToRelease([it_("e", "entree", "served"), it_("p", "plat")], true)).toEqual(["p"]);
  });

  it("entrée envoyée mais pas servie : le plat attend la réclame", () => {
    expect(heldToRelease([it_("e", "entree", "preparing"), it_("p", "plat")], true)).toEqual([]);
  });

  it("cadencement désactivé : rien n'attend", () => {
    expect(heldToRelease([it_("e", "entree"), it_("p", "plat"), it_("d", "dessert")], false)).toEqual(["p", "d"]);
  });
});

describe("OrdersService.createOffPremise (emporter)", () => {
  let service: OrdersService;
  let prisma: any;
  const modules = (m: object) => ({ modulesConfig: JSON.stringify(m) });

  beforeEach(() => {
    prisma = {
      restaurantConfig: { findUnique: vi.fn().mockResolvedValue(modules({ enableTakeaway: true })) },
      order: {
        findUnique: vi.fn().mockResolvedValue(null),
        aggregate: vi.fn().mockResolvedValue({ _max: { pickupNumber: 11 } }),
        create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ ...data, items: [] })),
      },
    };
    service = new OrdersService(prisma);
  });

  it("crée une commande sans table avec le numéro d'appel suivant", async () => {
    const order = await service.createOffPremise({ orderId: "ord_x", type: "takeaway", channel: "phone", customerName: " Dupont " });
    expect(order).toMatchObject({ id: "ord_x", tableId: undefined, type: "takeaway", channel: "phone", customerName: "Dupont", pickupNumber: 12 });
    expect(orderLabel(order)).toBe("Emporter #12 · Dupont");
  });

  it("refuse si le module est coupé, le mode inconnu ou le canal non saisissable en caisse", async () => {
    await expect(service.createOffPremise({ type: "delivery" })).rejects.toThrow(BadRequestException);
    await expect(service.createOffPremise({ type: "takeaway", channel: "ubereats" })).rejects.toThrow(BadRequestException);
    prisma.restaurantConfig.findUnique.mockResolvedValue(modules({ enableTakeaway: false }));
    await expect(service.createOffPremise({ type: "takeaway" })).rejects.toThrow(BadRequestException);
    expect(prisma.order.create).not.toHaveBeenCalled();
  });

  it("rejeu hors-ligne : renvoie la commande existante sans en créer une seconde", async () => {
    prisma.order.findUnique.mockResolvedValue({ id: "ord_x", type: "takeaway", pickupNumber: 3, items: [] });
    const order = await service.createOffPremise({ orderId: "ord_x", type: "takeaway" });
    expect(order.pickupNumber).toBe(3);
    expect(prisma.order.create).not.toHaveBeenCalled();
  });

  it("libellé : la salle garde « Table N »", () => {
    expect(orderLabel({ type: "dine_in", table: { number: 4 } })).toBe("Table 4");
  });
});
