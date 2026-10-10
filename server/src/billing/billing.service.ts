import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { computeDiscountCents, computeVatBreakdown, toCents, toEuros } from "./pricing";
import { GENESIS_TICKET, signTicket } from "./fiscal";

export interface CheckoutInput {
  orderId: string;
  paymentMethod?: string;
  payments?: any[];
  serverName?: string;
  tip?: number;
}

type TicketDraft = {
  orderId: string;
  tableNumber: number | null;
  server: string;
  items: string;
  subtotal: number;
  total: number;
  discount: string | null;
  vatDetails: string;
  paymentMethod: string;
  payments: string;
  tip: number;
  type: "SALE" | "CREDIT_NOTE";
  refTicketNumber: string | null;
  reason: string | null;
};

const parseJson = (v: string | null, fallback: any = null) => (v ? JSON.parse(v) : fallback);

/** Format d'un ticket envoyé aux clients (history:new_entry, sync:init) */
export function toClientHistory(h: any) {
  return {
    ...h,
    items: parseJson(h.items, []),
    discount: parseJson(h.discount),
    vatDetails: parseJson(h.vatDetails),
    payments: parseJson(h.payments, []),
    createdAt: new Date(h.createdAt).getTime(),
  };
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
    return this.withSequenceRetry(
      () => this.prisma.$transaction((tx) => this.checkoutInTransaction(tx, data)),
      "Cette commande a déjà été encaissée"
    );
  }

  /**
   * Avoir NF525 : annule un ticket par un ticket aux montants négatifs, signé dans la même chaîne.
   * Le ticket d'origine n'est jamais modifié. Un seul avoir (total) par ticket.
   */
  async refundTicket(historyId: string, reason: string, actorName: string) {
    const motif = (reason || "").trim();
    if (motif.length < 3) throw new BadRequestException("Motif d'annulation obligatoire");

    return this.withSequenceRetry(
      () =>
        this.prisma.$transaction(async (tx) => {
          const orig = await tx.orderHistory.findUnique({ where: { id: historyId } });
          if (!orig) throw new NotFoundException("Ticket introuvable");
          if (orig.type !== "SALE") throw new BadRequestException("Un avoir ne peut pas être annulé");

          const neg = (n: any) => (typeof n === "number" ? -n : n);
          const vat = parseJson(orig.vatDetails);
          const discount = parseJson(orig.discount);
          const record = await this.appendTicket(tx, {
            orderId: `refund:${orig.orderId}`,
            tableNumber: orig.tableNumber,
            server: actorName,
            items: JSON.stringify(parseJson(orig.items, []).map((i: any) => ({ ...i, qty: -i.qty }))),
            subtotal: -(orig.subtotal ?? orig.total),
            total: -orig.total,
            discount: discount ? JSON.stringify({ ...discount, amount: neg(discount.amount) }) : null,
            vatDetails: JSON.stringify(
              vat
                ? {
                    ...Object.fromEntries(Object.entries(vat).map(([k, v]) => [k, neg(v)])),
                    rates: (vat.rates || []).map((r: any) => ({
                      ...r,
                      rawTtc: -r.rawTtc,
                      ttc: -r.ttc,
                      ht: -r.ht,
                      vat: -r.vat,
                    })),
                  }
                : null
            ),
            paymentMethod: orig.paymentMethod,
            payments: JSON.stringify(
              parseJson(orig.payments, []).map((p: any) => ({ ...p, label: "Remboursement", amount: -p.amount }))
            ),
            tip: -(orig.tip || 0),
            type: "CREDIT_NOTE",
            refTicketNumber: orig.ticketNumber,
            reason: motif,
          });
          return toClientHistory(record);
        }),
      "Ce ticket a déjà fait l'objet d'un avoir"
    );
  }

  /** Rejoue en cas de collision de séquence (deux tickets simultanés) ; un doublon d'orderId = opération déjà faite */
  private async withSequenceRetry<T>(fn: () => Promise<T>, duplicateMessage: string): Promise<T> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await fn();
      } catch (err: any) {
        const target = String(err?.meta?.target || "");
        if (err?.code === "P2002" && target.includes("orderId")) throw new ConflictException(duplicateMessage);
        const seqCollision = err?.code === "P2002" && /sequenceNumber|ticketNumber/.test(target);
        if (!seqCollision || attempt >= 3) throw err;
      }
    }
  }

  /**
   * Ajoute un ticket (vente ou avoir) à la chaîne NF525 : séquence, numéro de pièce,
   * chaînage et signature sont attribués ici et nulle part ailleurs.
   */
  private async appendTicket(tx: Prisma.TransactionClient, draft: TicketDraft) {
    const last = await tx.orderHistory.findFirst({
      where: { sequenceNumber: { not: null } },
      orderBy: { sequenceNumber: "desc" },
    });
    const sequenceNumber = (last?.sequenceNumber || 0) + 1;
    const createdAt = new Date();
    const prefix = draft.type === "CREDIT_NOTE" ? "AV" : "FAC";
    const fields = {
      ...draft,
      sequenceNumber,
      ticketNumber: `${prefix}-${createdAt.getFullYear()}-${String(sequenceNumber).padStart(4, "0")}`,
      createdAt,
      previousHash: last?.signature || GENESIS_TICKET,
    };

    const cfg = await tx.restaurantConfig.findUnique({ where: { id: "default" } });
    if (!cfg?.nf525Key) throw new Error("Clé NF525 absente de la configuration");

    return tx.orderHistory.create({
      data: {
        id: `hist_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        ...fields,
        signature: signTicket(fields, cfg.nf525Key),
      },
    });
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

    // Pourboire : hors CA soumis à TVA, mais encaissé avec les règlements
    const tipValue = Number(data.tip ?? 0);
    if (!Number.isFinite(tipValue) || tipValue < 0) throw new BadRequestException("Pourboire invalide");
    const tipCents = toCents(tipValue);

    const paymentList =
      data.payments && data.payments.length > 0
        ? data.payments
        : [
            {
              id: `pay_${Date.now()}`,
              label: "Paiement unique",
              amount: toEuros(totalCents + tipCents),
              method: data.paymentMethod || "carte",
              paidAt: Date.now(),
            },
          ];

    const paidCents = paymentList.reduce((sum: number, p: any) => {
      const amount = Number(p?.amount);
      if (!Number.isFinite(amount) || amount < 0) throw new BadRequestException("Montant de paiement invalide");
      return sum + toCents(amount);
    }, 0);
    if (paidCents !== totalCents + tipCents) {
      throw new BadRequestException(
        `Paiements (${toEuros(paidCents).toFixed(2)} €) différents du total (${toEuros(totalCents + tipCents).toFixed(2)} €)`
      );
    }

    const finalMethod =
      data.paymentMethod || (paymentList.length > 1 ? "partage" : paymentList[0]?.method || "carte");

    const historyRecord = await this.appendTicket(tx, {
      orderId: order.id,
      tableNumber: order.table?.number ?? null,
      server: data.serverName || order.server,
      items: JSON.stringify(paidItems),
      subtotal,
      total: finalTotal,
      discount: discountSnapshot ? JSON.stringify(discountSnapshot) : null,
      vatDetails: JSON.stringify(vatDetails),
      paymentMethod: finalMethod,
      payments: JSON.stringify(paymentList),
      tip: toEuros(tipCents),
      type: "SALE",
      refTicketNumber: null,
      reason: null,
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

    return {
      orderId: order.id,
      history: toClientHistory(historyRecord),
      table: updatedTable,
    };
  }
}
