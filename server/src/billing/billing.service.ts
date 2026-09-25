import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

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
    const subtotal = data.subtotal != null ? data.subtotal : rawSubtotal;
    const orderDiscount = data.discount || (order.discount ? JSON.parse(order.discount) : null);
    const discountAmount = orderDiscount ? orderDiscount.amount || 0 : 0;
    const finalTotal = data.total != null ? data.total : Math.max(0, subtotal - discountAmount);
    const paidAt = new Date();

    const historyCount = await this.prisma.orderHistory.count();
    const currentYear = paidAt.getFullYear();
    const ticketNumber =
      data.ticketNumber || `FAC-${currentYear}-${String(historyCount + 1).padStart(4, "0")}`;

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

    // Création de l'enregistrement historique immutable
    const historyRecord = await this.prisma.orderHistory.create({
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
        createdAt: paidAt,
      },
    });

    // Clôture de la commande
    await this.prisma.order.update({
      where: { id: order.id },
      data: { status: "closed" },
    });

    // Réinitialisation de la table
    const updatedTable = await this.prisma.table.update({
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
      createdAt: paidAt.getTime(),
    };

    return {
      orderId: order.id,
      history: parsedHistory,
      table: updatedTable,
    };
  }
}
