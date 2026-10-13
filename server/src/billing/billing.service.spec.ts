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

    it("refuse un mode de règlement inconnu et ne fige que les champs attendus", async () => {
      const order = { id: "o1", tableId: null, server: "A", items: [{ id: "i", name: "Café", price: 2, qty: 1, status: "served" }] };
      mockPrisma.order.findUnique.mockResolvedValue(order);
      await expect(
        billingService.processCheckout({ orderId: "o1", payments: [{ amount: 2, method: "bitcoin" }] })
      ).rejects.toThrow("Mode de règlement inconnu");

      const res = await billingService.processCheckout({
        orderId: "o1",
        payments: [{ id: "p1", label: "Carte", amount: 2, method: "carte", injecte: "x".repeat(1000) }],
      });
      expect(res.history.payments[0]).not.toHaveProperty("injecte");
      expect(res.history.payments[0]).toMatchObject({ id: "p1", method: "carte", amount: 2 });
    });

    it("fige les règlements au centime et refuse un montant illisible", async () => {
      mockPrisma.order.findUnique.mockResolvedValue({ id: "o1", tableId: null, server: "A", items: [{ id: "i", name: "Café", price: 2, qty: 1, status: "served" }] });
      const res = await billingService.processCheckout({ orderId: "o1", payments: [{ amount: 1.004, method: "carte" }, { amount: 0.996, method: "especes" }] });
      expect(res.history.payments.map((p: any) => p.amount)).toEqual([1, 1]);
      await expect(
        billingService.processCheckout({ orderId: "o1", payments: [{ amount: "abc", method: "carte" }, { amount: 2, method: "especes" }] })
      ).rejects.toThrow("Montant de paiement invalide");
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

  describe("processCheckout (vente comptoir)", () => {
    it("vend les brouillons d'une commande comptoir sans envoi en cuisine, et les renvoie pour déstockage", async () => {
      mockPrisma.orderItem = { updateMany: vi.fn() };
      mockPrisma.order.findUnique.mockResolvedValue({
        id: "c1", type: "counter", pickupNumber: 3, tableId: null,
        items: [{ id: "x", name: "Café", price: 2, qty: 2, status: "draft", vatRate: 10 }],
      });
      const res = await billingService.processCheckout({ orderId: "c1", payments: [{ amount: 4, method: "especes" }] });
      expect(res.history.total).toBe(4);
      expect(res.soldDirectIds).toEqual(["x"]);
      expect(mockPrisma.orderItem.updateMany).toHaveBeenCalledWith({ where: { id: { in: ["x"] } }, data: { status: "served" } });
    });

    it("refuse toujours une commande en salle dont rien n'est envoyé", async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: "t1", type: "dine_in", tableId: "tb1", items: [{ id: "y", price: 2, qty: 1, status: "draft" }],
      });
      await expect(billingService.processCheckout({ orderId: "t1", payments: [{ amount: 2, method: "carte" }] })).rejects.toThrow("Aucun article");
    });
  });

  describe("processCheckout (un ticket par convive)", () => {
    // Note de 26 € brut, remise 10 % → 23,40 € : 2 plats à 10 € + vin à 6 €, 3 couverts
    let order: any;
    beforeEach(() => {
      order = {
        id: "o5", type: "dine_in", status: "open", tableId: "tb1", table: { number: 5 }, covers: 3, paidTotal: 0,
        discount: JSON.stringify({ type: "percent", value: 10 }),
        items: [
          { id: "p", name: "Plat", price: 10, qty: 2, paidQty: 0, status: "served", vatRate: 10 },
          { id: "v", name: "Vin", price: 6, qty: 1, paidQty: 0, status: "served", vatRate: 20 },
        ],
      };
      mockPrisma.order.findUnique.mockImplementation(() => Promise.resolve(order));
      mockPrisma.order.update = vi.fn().mockImplementation(({ data }) => {
        order = { ...order, ...data };
        return Promise.resolve(order);
      });
      mockPrisma.orderItem = {
        updateMany: vi.fn().mockImplementation(({ where, data }) => {
          const it = order.items.find((i: any) => i.id === where.id);
          if (it.paidQty > where.paidQty.lte) return Promise.resolve({ count: 0 });
          it.paidQty += data.paidQty.increment;
          return Promise.resolve({ count: 1 });
        }),
      };
      mockPrisma.orderHistory.count = vi.fn().mockResolvedValue(0);
    });

    it("émet un ticket par convive, remise au prorata, le dernier solde au centime et libère la table", async () => {
      const a = await billingService.processCheckout({ orderId: "o5", lines: [{ itemId: "p", qty: 1 }], payments: [{ amount: 9, method: "carte" }] });
      expect(a.history.total).toBe(9);
      expect(a.history.covers).toBe(1);
      expect(a.closed).toBe(false);
      expect(mockPrisma.order.updateMany).not.toHaveBeenCalled(); // la note reste ouverte

      mockPrisma.orderHistory.count.mockResolvedValue(1);
      const b = await billingService.processCheckout({ orderId: "o5", payments: [{ amount: 14.4, method: "especes" }] });
      expect(b.history.total).toBe(14.4); // 23,40 − 9,00
      expect(b.history.covers).toBe(2);
      expect(b.closed).toBe(true);
      expect(b.table).toBeTruthy();
      expect(order.status).toBe("closed");
    });

    it("refuse d'encaisser deux fois la même part et une remise après un premier ticket", async () => {
      await billingService.processCheckout({ orderId: "o5", lines: [{ itemId: "v", qty: 1 }], payments: [{ amount: 5.4, method: "carte" }] });
      await expect(
        billingService.processCheckout({ orderId: "o5", lines: [{ itemId: "v", qty: 1 }], payments: [{ amount: 5.4, method: "carte" }] })
      ).rejects.toThrow("déjà encaissée");
      await expect(billingService.applyDiscount("o5", { type: "percent", value: 20 })).rejects.toThrow("en partie encaissée");
    });
  });

  describe("refundTicket (avoir partiel)", () => {
    // Ticket de 26 € brut, remise 10 % → 23,40 € : plat 20 € (10 %) + vin 6 € (20 %)
    const orig = {
      id: "h1", orderId: "o1", ticketNumber: "FAC-2026-0001", type: "SALE", subtotal: 26, total: 23.4, tip: 2,
      paymentMethod: "carte", payments: JSON.stringify([{ method: "carte", amount: 25.4 }]),
      items: JSON.stringify([
        { id: "a", name: "Plat", price: 20, qty: 1, vatRate: 10 },
        { id: "b", name: "Vin", price: 6, qty: 1, vatRate: 20 },
      ]),
    };
    let notes: any[];

    beforeEach(() => {
      notes = [];
      mockPrisma.orderHistory.findUnique = vi.fn().mockResolvedValue(orig);
      mockPrisma.orderHistory.findMany = vi.fn().mockImplementation(() => Promise.resolve([...notes]));
      mockPrisma.orderHistory.create = vi.fn().mockImplementation(({ data }) => {
        notes.push(data);
        return Promise.resolve({ ...data });
      });
    });

    it("rembourse une ligne avec la remise au prorata, puis le reste au centime près, sans le pourboire", async () => {
      const first = await billingService.refundTicket("h1", "vin bouchonné", "Admin", [{ itemId: "b", qty: 1 }], "especes");
      expect(first.total).toBe(-5.4);
      expect(first.vatDetails.rates.map((r: any) => r.rate)).toEqual([20]);
      expect(first.payments).toEqual([expect.objectContaining({ method: "especes", amount: -5.4 })]);

      const rest = await billingService.refundTicket("h1", "client parti", "Admin");
      expect(rest.total).toBe(-18);
      expect(rest.tip).toBe(0);
      expect(first.total + rest.total).toBeCloseTo(-23.4, 10);

      await expect(billingService.refundTicket("h1", "encore", "Admin")).rejects.toThrow("entièrement remboursé");
    });

    it("avoir total : mode de remboursement choisi, pourboire non remboursé", async () => {
      const full = await billingService.refundTicket("h1", "erreur de table", "Admin", null, "especes");
      expect(full.total).toBe(-23.4);
      expect(full.tip).toBe(0);
      expect(full.paymentMethod).toBe("especes");
      expect(full.payments).toEqual([expect.objectContaining({ method: "especes", amount: -23.4 })]);
    });

    it("refuse une quantité au-delà du reste ou une ligne inconnue", async () => {
      await expect(billingService.refundTicket("h1", "erreur", "Admin", [{ itemId: "b", qty: 2 }])).rejects.toThrow("reste à rembourser");
      await expect(billingService.refundTicket("h1", "erreur", "Admin", [{ itemId: "zz", qty: 1 }])).rejects.toThrow("Ligne inconnue");
    });
  });
});
