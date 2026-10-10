import { describe, it, expect, vi, beforeEach } from "vitest";
import { BadRequestException } from "@nestjs/common";
import { OrdersService } from "./orders.service";

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
