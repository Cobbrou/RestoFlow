import { describe, it, expect, vi, beforeEach } from "vitest";
import { BillingService } from "./billing.service";
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";

describe("BillingService (Unitaire & Intégrité Financière)", () => {
  let billingService: BillingService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      order: {
        findUnique: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        delete: vi.fn(),
      },
      orderHistory: {
        count: vi.fn().mockResolvedValue(0),
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ ...data })),
      },
      $transaction: vi.fn().mockImplementation((fn) => fn(mockPrisma)),
      restaurantConfig: {
        findUnique: vi.fn().mockResolvedValue({ nf525Key: "TEST_SECRET_KEY" }),
      },
      table: {
        update: vi.fn().mockResolvedValue({ id: "t1", number: 1, alert: false }),
      },
      stockMovement: {
        create: vi.fn(),
      },
    };

    billingService = new BillingService(mockPrisma);
  });

  describe("applyDiscount", () => {
    it("lève une NotFoundException si la commande n'existe pas", async () => {
      mockPrisma.order.findUnique.mockResolvedValue(null);

      await expect(
        billingService.applyDiscount("invalid_id", { type: "percent", value: 10 })
      ).rejects.toThrow(NotFoundException);
    });

    it("enregistre fidèlement la remise commerciale et met à jour la commande", async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: "order_1",
        items: [{ price: 20, qty: 1 }],
      });

      mockPrisma.order.update.mockResolvedValue({
        id: "order_1",
        discount: JSON.stringify({ type: "percent", value: 10, amount: 2 }),
      });

      const res = await billingService.applyDiscount("order_1", {
        type: "percent",
        value: 10,
        amount: 2,
        reason: "Geste commercial",
      });

      expect(mockPrisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "order_1" },
        })
      );
      expect(res.order.discount.value).toBe(10);
      expect(res.order.discount.amount).toBe(2);
    });
  });

  describe("processCheckout (Chaînage NF525 & Clôture)", () => {
    it("exécute le checkout, génère la signature cryptographique et archive le ticket", async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: "order_123",
        tableId: "t1",
        server: "Alice",
        table: { number: 4 },
        items: [
          { id: "it1", name: "Pizza", price: 14.0, qty: 2, status: "served" },
          { id: "it2", name: "Brouillon", price: 5.0, qty: 1, status: "draft" },
        ],
      });

      const checkoutData = {
        orderId: "order_123",
        paymentMethod: "carte",
      };

      const result = await billingService.processCheckout(checkoutData);

      expect(result.orderId).toBe("order_123");
      expect(result.history.total).toBe(28.0);
      expect(result.history.signature).toBeDefined();
      expect(result.history.signature.length).toBe(64); // SHA-256 HMAC
      expect(result.history.sequenceNumber).toBe(1);

      // Vérifie que la commande est marquée fermée et la table libérée
      expect(mockPrisma.order.updateMany).toHaveBeenCalledWith({
        where: { id: "order_123", status: "open" },
        data: { status: "closed" },
      });
      expect(result.history.ticketNumber).toMatch(/^FAC-\d{4}-0001$/);
      expect(mockPrisma.table.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "t1" } })
      );
    });

    it("encaisse une commande à emporter sans table et fige son libellé sur le ticket", async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: "order_emp",
        tableId: null,
        table: null,
        type: "takeaway",
        channel: "phone",
        pickupNumber: 12,
        customerName: "Dupont",
        server: "Alice",
        items: [{ id: "it1", name: "Burger", price: 15, qty: 1, status: "ready", vatRate: 10 }],
      });

      const result = await billingService.processCheckout({ orderId: "order_emp", paymentMethod: "carte" });

      expect(result.table).toBeNull();
      expect(mockPrisma.table.update).not.toHaveBeenCalled();
      expect(result.history).toMatchObject({
        tableNumber: null,
        orderType: "takeaway",
        channel: "phone",
        orderLabel: "Emporter #12 · Dupont",
      });
    });

    const order = {
      id: "order_9",
      tableId: "t1",
      server: "Alice",
      table: { number: 2 },
      discount: null,
      items: [
        { id: "a", name: "Plat", price: 20, qty: 1, status: "served", vatRate: 10 },
        { id: "b", name: "Vin", price: 6, qty: 1, status: "served", vatRate: 20 },
      ],
    };

    it("refuse un second encaissement de la même commande", async () => {
      mockPrisma.order.findUnique.mockResolvedValue(order);
      mockPrisma.order.updateMany.mockResolvedValue({ count: 0 });
      await expect(billingService.processCheckout({ orderId: "order_9" })).rejects.toThrow(ConflictException);
      expect(mockPrisma.orderHistory.create).not.toHaveBeenCalled();
    });

    it("ignore les montants du client et refuse des paiements différents du total", async () => {
      mockPrisma.order.findUnique.mockResolvedValue(order);
      await expect(
        billingService.processCheckout({
          orderId: "order_9",
          total: 0.01,
          payments: [{ amount: 0.01, method: "especes" }],
        } as any)
      ).rejects.toThrow(BadRequestException);
    });

    it("recalcule remise et ventilation TVA par taux depuis la base", async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        ...order,
        discount: JSON.stringify({ type: "percent", value: 10, amount: 999 }),
      });
      const res = await billingService.processCheckout({
        orderId: "order_9",
        payments: [{ amount: 23.4, method: "carte" }],
      });
      expect(res.history.total).toBe(23.4);
      expect(res.history.discount.amount).toBe(2.6);
      expect(res.history.vatDetails.rates.map((r: any) => r.rate)).toEqual([10, 20]);
    });
  });
});
