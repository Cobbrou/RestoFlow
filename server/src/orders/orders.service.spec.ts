import { describe, it, expect, vi, beforeEach } from "vitest";
import { BadRequestException } from "@nestjs/common";
import { OrdersService, checkMenuComposition, heldToRelease, orderLabel } from "./orders.service";

describe("OrdersService : article déjà envoyé en cuisine", () => {
  const sent = { id: "it1", orderId: "o1", status: "new", notes: "sans sel", course: "plat" };
  let prisma: any;
  let service: OrdersService;

  beforeEach(() => {
    prisma = {
      orderItem: { findFirst: vi.fn().mockResolvedValue(sent), findUnique: vi.fn().mockResolvedValue(sent), update: vi.fn() },
      order: { findUnique: vi.fn().mockResolvedValue({ id: "o1", items: [] }) },
    };
    service = new OrdersService(prisma);
  });

  it("refuse de changer la note ou la suite, accepte le rejeu à l'identique", async () => {
    await expect(service.setNote("o1", "it1", "bien cuit")).rejects.toThrow(BadRequestException);
    await expect(service.changeItemCourse("it1", "dessert")).rejects.toThrow(BadRequestException);
    await service.setNote("o1", "it1", "sans sel");
    await service.changeItemCourse("it1", "plat");
    expect(prisma.orderItem.update).toHaveBeenCalledTimes(1); // seul le rejeu de note réécrit la même valeur
  });
});

describe("OrdersService.cancelOffPremise", () => {
  const make = (order: any) => {
    const prisma: any = {
      order: { findUnique: vi.fn().mockResolvedValue(order), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    };
    return { prisma, service: new OrdersService(prisma) };
  };
  const base = { id: "o9", type: "takeaway", status: "open", pickupNumber: 4, paidTotal: 0, items: [] as any[] };

  it("annule une commande à emporter ou comptoir dont rien n'est envoyé", async () => {
    const { prisma, service } = make({ ...base, type: "counter", items: [{ id: "a", status: "draft" }] });
    const res = await service.cancelOffPremise("o9");
    expect(prisma.order.updateMany).toHaveBeenCalledWith({ where: { id: "o9", status: "open" }, data: { status: "cancelled" } });
    expect(res.label).toBe("Comptoir #4");
  });

  it("refuse une commande en salle, envoyée en cuisine, encaissée ou entamée", async () => {
    await expect(make({ ...base, type: "dine_in" }).service.cancelOffPremise("o9")).rejects.toThrow("emporter ou comptoir");
    await expect(make({ ...base, items: [{ status: "new" }] }).service.cancelOffPremise("o9")).rejects.toThrow("partis en cuisine");
    await expect(make({ ...base, status: "closed" }).service.cancelOffPremise("o9")).rejects.toThrow("avoir");
    await expect(make({ ...base, paidTotal: 5 }).service.cancelOffPremise("o9")).rejects.toThrow("en partie");
  });
});

describe("OrdersService.setCovers", () => {
  it("refuse une valeur hors de 1 à 99 ou une commande encaissée", async () => {
    const prisma: any = {
      order: { updateMany: vi.fn().mockResolvedValue({ count: 0 }), findUnique: vi.fn().mockResolvedValue({ id: "o1", items: [] }) },
    };
    const service = new OrdersService(prisma);
    await expect(service.setCovers("o1", 0)).rejects.toThrow(BadRequestException);
    await expect(service.setCovers("o1", 2.5)).rejects.toThrow(BadRequestException);
    await expect(service.setCovers("o1", 3)).rejects.toThrow("déjà encaissée");
    prisma.order.updateMany.mockResolvedValue({ count: 1 });
    expect((await service.setCovers("o1", 3))?.id).toBe("o1");
  });
});

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

describe("OrdersService.sendKitchen", () => {
  it("n'envoie que les brouillons qu'il a lui-même basculés (double appui, deux terminaux)", async () => {
    const order = { id: "o1", status: "open", items: [{ id: "a", status: "draft" }, { id: "b", status: "draft" }, { id: "c", status: "new" }] };
    const prisma: any = {
      order: { findUnique: vi.fn().mockResolvedValue(order), update: vi.fn() },
      restaurantConfig: { findUnique: vi.fn().mockResolvedValue(null) },
      // "b" a déjà été réclamé par un envoi concurrent
      orderItem: { updateMany: vi.fn(({ where }) => ({ count: where.id === "b" ? 0 : 1 })) },
    };
    const { sentIds } = await new OrdersService(prisma).sendKitchen("o1");
    expect(sentIds).toEqual(["a"]);
  });

  it("refuse une commande encaissée", async () => {
    const prisma: any = { order: { findUnique: vi.fn().mockResolvedValue({ id: "o1", status: "closed", items: [] }) } };
    await expect(new OrdersService(prisma).sendKitchen("o1")).rejects.toThrow(BadRequestException);
  });
});

describe("Menus : composition validée contre la formule", () => {
  const groups = [
    { title: "Plat", count: 1, productIds: ["p1", "p2"] },
    { title: "Dessert", count: 1, productIds: ["p3"] },
  ];

  it("accepte un choix par étape parmi ceux proposés", () => {
    expect(checkMenuComposition(groups, [{ productIds: ["p2"] }, { productIds: ["p3"] }])).toBe(groups);
  });

  it("refuse une étape manquante, un produit hors formule ou un nombre de choix faux", () => {
    expect(() => checkMenuComposition(groups, [{ productIds: ["p1"] }])).toThrow("incomplète");
    expect(() => checkMenuComposition(groups, [{ productIds: ["p9"] }, { productIds: ["p3"] }])).toThrow("Plat");
    expect(() => checkMenuComposition(groups, [{ productIds: ["p1", "p2"] }, { productIds: ["p3"] }])).toThrow("Plat");
    expect(() => checkMenuComposition(groups, null)).toThrow(BadRequestException);
  });

  it("addItem traite « menu_… » comme un menu même si le client envoie isMenu: false", async () => {
    const prisma: any = {
      order: { findUnique: vi.fn().mockResolvedValue({ id: "o1", status: "open", items: [] }) },
      menu: { findUnique: vi.fn().mockResolvedValue({ id: "m1", name: "Menu", price: 15, groups: JSON.stringify(groups) }) },
      orderItem: { create: vi.fn() },
    };
    await expect(
      new OrdersService(prisma).addItem({ orderId: "o1", product: { id: "menu_m1", name: "x", price: 1, isMenu: false } })
    ).rejects.toThrow("incomplète");
    expect(prisma.orderItem.create).not.toHaveBeenCalled();
  });
});
