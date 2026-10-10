import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import * as crypto from "crypto";
import { computeDiscountCents, computeVatBreakdown, toCents, toEuros } from "./pricing";

export interface CheckoutInput {
  orderId: string;
  paymentMethod?: string;
  payments?: any[];
  serverName?: string;
}

@Injectable()
export class BillingService {
  constructor(private prisma: PrismaService) {}

  async applyDiscount(orderId: string, discount: any) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) throw new NotFoundException("Commande introuvable");

    if (discount?.type !== "percent" && discount?.type !== "fixed") {
      throw new BadRequestException("Type de remise invalide");
    }
    const value = Math.max(0, Number(discount.value) || 0);
    const subtotalCents = order.items
      .filter((i) => i.status !== "draft")
      .reduce((s, i) => s + toCents(i.price) * i.qty, 0);

    // Montant indicatif recalculé par le serveur ; le montant définitif est recalculé à l'encaissement
    const discountPayload = {
      type: discount.type,
      value: discount.type === "percent" ? Math.min(100, value) : value,
      reason: discount.reason || "Remise commerciale",
      code: discount.code || null,
      label: discount.label || null,
      amount: toEuros(computeDiscountCents(subtotalCents, discount)),
    };

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { discount: JSON.stringify(discountPayload) },
      include: { items: true, table: true },
    });

    return {
      order: {
        ...updated,
        discount: discountPayload,
      },
    };
  }

  async removeDiscount(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) throw new NotFoundException("Commande introuvable");

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { discount: null },
      include: { items: true, table: true },
    });

    return {
      order: {
        ...updated,
        discount: null,
      },
    };
  }

  async processCheckout(data: CheckoutInput) {
    // Collision de numéro de séquence entre deux encaissements simultanés : on rejoue la transaction
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.prisma.$transaction((tx) => this.checkoutInTransaction(tx, data));
      } catch (err: any) {
        const target = String(err?.meta?.target || "");
        if (err?.code === "P2002" && target.includes("orderId")) {
          throw new ConflictException("Cette commande a déjà été encaissée");
        }
        const seqCollision = err?.code === "P2002" && /sequenceNumber|ticketNumber/.test(target);
        if (!seqCollision || attempt >= 3) throw err;
      }
    }
  }

  private async checkoutInTransaction(tx: Prisma.TransactionClient, data: CheckoutInput) {
    const order = await tx.order.findUnique({
      where: { id: data.orderId },
      include: { items: true, table: true },
    });
    if (!order) throw new NotFoundException("Commande introuvable");

    // 🔒 Garde anti double encaissement (double clic, rejeu hors-ligne, deux terminaux)
    const claimed = await tx.order.updateMany({
      where: { id: order.id, status: "open" },
      data: { status: "closed" },
    });
    if (claimed.count === 0) throw new ConflictException("Cette commande a déjà été encaissée");

    // 🔒 Montants recalculés depuis la base : sous-total, remise et TVA du client sont ignorés
    const paidItems = order.items.filter((i) => i.status !== "draft");
    if (paidItems.length === 0) throw new BadRequestException("Aucun article envoyé à encaisser");
    const orderDiscount = order.discount ? JSON.parse(order.discount) : null;
    const { subtotalCents, discountCents, totalCents, ...vatDetails } = computeVatBreakdown(paidItems, orderDiscount);
    const subtotal = toEuros(subtotalCents);
    const finalTotal = toEuros(totalCents);
    const discountSnapshot = orderDiscount ? { ...orderDiscount, amount: toEuros(discountCents) } : null;
    const paidAt = new Date();

    const paymentList =
      data.payments && data.payments.length > 0
        ? data.payments
        : [
            {
              id: `pay_${Date.now()}`,
              label: "Paiement unique",
              amount: finalTotal,
              method: data.paymentMethod || "carte",
              paidAt: paidAt.getTime(),
            },
          ];

    const paidCents = paymentList.reduce((sum: number, p: any) => {
      const amount = Number(p?.amount);
      if (!Number.isFinite(amount) || amount < 0) throw new BadRequestException("Montant de paiement invalide");
      return sum + toCents(amount);
    }, 0);
    if (paidCents !== totalCents) {
      throw new BadRequestException(
        `Paiements (${toEuros(paidCents).toFixed(2)} €) différents du total (${finalTotal.toFixed(2)} €)`
      );
    }

    const finalMethod =
      data.paymentMethod || (paymentList.length > 1 ? "partage" : paymentList[0]?.method || "carte");

    // Chaînage cryptographique NF525 : séquence et numéro de ticket attribués par le serveur uniquement
    const lastHistory = await tx.orderHistory.findFirst({
      where: { sequenceNumber: { not: null } },
      orderBy: { sequenceNumber: "desc" },
    });
    const nextSeq = (lastHistory?.sequenceNumber || 0) + 1;
    const previousHash = lastHistory?.signature || "GENESIS_TICKET_RESTOFLOW";
    const ticketNumber = `FAC-${paidAt.getFullYear()}-${String(nextSeq).padStart(4, "0")}`;

    const cfg = await tx.restaurantConfig.findUnique({ where: { id: "default" } });
    if (!cfg?.nf525Key) throw new Error("Clé NF525 absente de la configuration");
    const secretKey = cfg.nf525Key;

    const signaturePayload = [
      nextSeq,
      ticketNumber,
      paidAt.toISOString(),
      finalTotal.toFixed(2),
      subtotal.toFixed(2),
      finalMethod,
      previousHash,
    ].join("|");
    const signature = crypto.createHmac("sha256", secretKey).update(signaturePayload).digest("hex");

    // Création de l'enregistrement historique immutable
    const historyRecord = await tx.orderHistory.create({
      data: {
        id: `hist_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        orderId: order.id,
        ticketNumber,
        tableNumber: order.table?.number,
        server: data.serverName || order.server,
        items: JSON.stringify(paidItems),
        subtotal,
        total: finalTotal,
        discount: discountSnapshot ? JSON.stringify(discountSnapshot) : null,
        vatDetails: JSON.stringify(vatDetails),
        paymentMethod: finalMethod,
        payments: JSON.stringify(paymentList),
        sequenceNumber: nextSeq,
        previousHash,
        signature,
        createdAt: paidAt,
      },
    });

    // Réinitialisation de la table
    const updatedTable = await tx.table.update({
      where: { id: order.tableId },
      data: {
        alert: false,
        reserved: false,
        reservationName: null,
        reservationPeople: null,
        reservationTime: null,
        reservationNote: null,
      },
    });

    const parsedHistory = {
      id: historyRecord.id,
      orderId: historyRecord.orderId,
      ticketNumber: historyRecord.ticketNumber,
      tableNumber: historyRecord.tableNumber,
      server: historyRecord.server,
      items: paidItems,
      subtotal,
      total: finalTotal,
      discount: discountSnapshot,
      vatDetails,
      paymentMethod: historyRecord.paymentMethod,
      payments: paymentList,
      sequenceNumber: historyRecord.sequenceNumber,
      previousHash: historyRecord.previousHash,
      signature: historyRecord.signature,
      createdAt: paidAt.getTime(),
    };

    return {
      orderId: order.id,
      history: parsedHistory,
      table: updatedTable,
    };
  }
}
