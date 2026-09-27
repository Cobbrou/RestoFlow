import { describe, it, expect, vi, beforeEach } from "vitest";
import { BillingService } from "./billing.service";
import { NotFoundException } from "@nestjs/common";

describe("BillingService (Unitaire & Intégrité Financière)", () => {
  let billingService: BillingService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      order: {
        findUnique: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      orderHistory: {
        count: vi.fn().mockResolvedValue(0),
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ ...data })),
      },
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
        subtotal: 28.0,
        total: 28.0,
      };

      const result = await billingService.processCheckout(checkoutData);

      expect(result.orderId).toBe("order_123");
      expect(result.history.total).toBe(28.0);
      expect(result.history.signature).toBeDefined();
      expect(result.history.signature.length).toBe(64); // SHA-256 HMAC
      expect(result.history.sequenceNumber).toBe(1);

      // Vérifie que la commande est marquée fermée et la table libérée
      expect(mockPrisma.order.update).toHaveBeenCalledWith({
        where: { id: "order_123" },
        data: { status: "closed" },
      });
      expect(mockPrisma.table.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "t1" } })
      );
    });
  });
});
