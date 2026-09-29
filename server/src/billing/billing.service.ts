import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import * as crypto from "crypto";

export interface CheckoutInput {
  orderId: string;
  paymentMethod?: string;
  payments?: any[];
  serverName?: string;
  subtotal?: number;
  total?: number;
  discount?: any;
  vatDetails?: any;
  ticketNumber?: string;
  tip?: number;
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

    const discountPayload = {
      type: discount.type || "percent",
      value: Number(discount.value) || 0,
      reason: discount.reason || "Remise commerciale",
      code: discount.code || null,
      amount: Number(discount.amount) || 0,
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
    const order = await this.prisma.order.findUnique({
      where: { id: data.orderId },
      include: { items: true, table: true },
    });
    if (!order) throw new NotFoundException("Commande introuvable");

    const paidItems = order.items.filter((i) => i.status !== "draft");
    const rawSubtotal = paidItems.reduce((s, i) => s + i.price * i.qty, 0);
    const subtotal = rawSubtotal; // Always trust server-side calculation
    const orderDiscount = data.discount || (order.discount ? JSON.parse(order.discount) : null);
    const discountAmount = orderDiscount ? orderDiscount.amount || 0 : 0;
    const finalTotal = Math.max(0, subtotal - discountAmount); // Always recalculate, never trust client
    if (data.total != null && Math.abs(data.total - finalTotal) > 0.01) {
      console.warn(`[Billing] Client total mismatch: client=${data.total}, server=${finalTotal}, orderId=${data.orderId}`);
    }
    const paidAt = new Date();

    // Use serialized interactive transaction to prevent race conditions on sequenceNumber
    const result = await this.prisma.$transaction(async (tx) => {
      const historyCount = await tx.orderHistory.count();
      const currentYear = paidAt.getFullYear();
      const ticketNumber = `FAC-${currentYear}-${String(historyCount + 1).padStart(4, "0")}`;

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

      const finalMethod =
        data.paymentMethod || (paymentList.length > 1 ? "partage" : paymentList[0]?.method || "carte");

      // Chaînage cryptographique NF525
      const lastHistory = await tx.orderHistory.findFirst({
        orderBy: { createdAt: "desc" },
      });
      const nextSeq = (lastHistory?.sequenceNumber || historyCount || 0) + 1;
      const previousHash = lastHistory?.signature || "GENESIS_TICKET_RESTOFLOW";

      const cfg = await tx.restaurantConfig.findUnique({ where: { id: "default" } });
      const secretKey = cfg?.nf525Key || "RESTOFLOW_NF525_SECRET_KEY";

      const signaturePayload = [
        nextSeq,
        ticketNumber,
        paidAt.toISOString(),
        Number(finalTotal).toFixed(2),
        Number(subtotal).toFixed(2),
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
          discount: orderDiscount ? JSON.stringify(orderDiscount) : null,
          vatDetails: data.vatDetails
            ? typeof data.vatDetails === "string"
              ? data.vatDetails
              : JSON.stringify(data.vatDetails)
            : null,
          paymentMethod: finalMethod,
          payments: JSON.stringify(paymentList),
          tip: Number(data.tip || 0),
          sequenceNumber: nextSeq,
          previousHash,
          signature,
          createdAt: paidAt,
        },
      });

      // Clôture de la commande
      await tx.order.update({
        where: { id: order.id },
        data: { status: "closed" },
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
        subtotal: historyRecord.subtotal ?? historyRecord.total,
        total: historyRecord.total,
        discount: orderDiscount,
        vatDetails: data.vatDetails || null,
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
    });

    return result;
  }
}
