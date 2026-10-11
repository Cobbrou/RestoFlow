import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { computeDiscountCents, computeVatBreakdown, partialNetCents, toCents, toEuros } from "./pricing";
import { GENESIS_TICKET, signTicket } from "./fiscal";
import { isOffPremise, orderLabel } from "../orders/orders.service";

export interface CheckoutInput {
  orderId: string;
  paymentMethod?: string;
  payments?: any[];
  serverName?: string;
  tip?: number;
  lines?: { itemId: string; qty: number }[]; // ticket par convive : lignes encaissées sur ce ticket
}

type TicketDraft = {
  orderId: string;
  tableNumber: number | null;
  orderType: string;
  channel: string;
  orderLabel: string | null;
  server: string;
  items: string;
  subtotal: number;
  total: number;
  discount: string | null;
  vatDetails: string;
  paymentMethod: string;
  payments: string;
  tip: number;
  covers?: number | null;
  type: "SALE" | "CREDIT_NOTE";
  refTicketNumber: string | null;
  reason: string | null;
};

// La remise est répartie sur les tickets de convive : elle ne change plus une fois la note entamée
export function assertNotPartiallyPaid(order: { paidTotal?: number | null }) {
  if ((order.paidTotal || 0) > 0) throw new BadRequestException("Note déjà en partie encaissée : action impossible");
}

const parseJson =(v: string | null, fallback: any = null) => (v ? JSON.parse(v) : fallback);

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
    assertNotPartiallyPaid(order);

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
    assertNotPartiallyPaid(order);

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
   * Le ticket d'origine n'est jamais modifié.
   * Sans `lines` : avoir total (ou du reste, si des avoirs partiels existent déjà).
   * Avec `lines` [{ itemId, qty }] : avoir partiel, jamais au-delà des quantités restant à rembourser.
   */
  async refundTicket(
    historyId: string,
    reason: string,
    actorName: string,
    lines?: { itemId: string; qty: number }[] | null,
    refundMethod?: string
  ) {
    const motif = (reason || "").trim();
    if (motif.length < 3) throw new BadRequestException("Motif d'annulation obligatoire");

    return this.withSequenceRetry(
      () =>
        this.prisma.$transaction(async (tx) => {
          const orig = await tx.orderHistory.findUnique({ where: { id: historyId } });
          if (!orig) throw new NotFoundException("Ticket introuvable");
          if (orig.type !== "SALE") throw new BadRequestException("Un avoir ne peut pas être annulé");

          const previous = await tx.orderHistory.findMany({
            where: { type: "CREDIT_NOTE", refTicketNumber: orig.ticketNumber },
          });
          if (previous.length > 0 || Array.isArray(lines)) {
            return toClientHistory(await this.appendPartialRefund(tx, orig, previous, lines ?? null, motif, actorName, refundMethod));
          }

          const neg = (n: any) => (typeof n === "number" ? -n : n);
          const vat = parseJson(orig.vatDetails);
          const discount = parseJson(orig.discount);
          const record = await this.appendTicket(tx, {
            orderId: `refund:${orig.orderId}`,
            tableNumber: orig.tableNumber,
            orderType: orig.orderType,
            channel: orig.channel,
            orderLabel: orig.orderLabel,
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

  /**
   * Avoir partiel (ou du reste) : remise d'origine appliquée au prorata ; l'avoir qui solde le ticket
   * prend exactement le reste, pour que la somme des avoirs égale le ticket. Le pourboire n'est pas remboursé.
   */
  private async appendPartialRefund(
    tx: Prisma.TransactionClient,
    orig: any,
    previous: any[],
    lines: { itemId: string; qty: number }[] | null,
    motif: string,
    actorName: string,
    refundMethod?: string
  ) {
    const origItems: any[] = parseJson(orig.items, []);
    const keyOf = (it: any, idx: number) => it.refKey ?? it.id ?? `#${idx}`;

    const refunded = new Map<string, number>();
    for (const cn of previous) {
      parseJson(cn.items, []).forEach((it: any, idx: number) =>
        refunded.set(keyOf(it, idx), (refunded.get(keyOf(it, idx)) || 0) + Math.abs(Number(it.qty) || 0))
      );
    }
    const remaining = new Map<string, number>(
      origItems.map((it, idx) => [keyOf(it, idx), (Number(it.qty) || 0) - (refunded.get(keyOf(it, idx)) || 0)])
    );

    const requested = new Map<string, number>();
    if (lines) {
      for (const l of lines) {
        const key = String(l?.itemId);
        const qty = Number(l?.qty);
        if (!remaining.has(key)) throw new BadRequestException("Ligne inconnue sur ce ticket");
        if (!Number.isInteger(qty) || qty < 1) throw new BadRequestException("Quantité à rembourser invalide");
        requested.set(key, (requested.get(key) || 0) + qty);
      }
    } else {
      for (const [key, qty] of remaining) if (qty > 0) requested.set(key, qty);
    }
    for (const [key, qty] of requested) {
      if (qty > (remaining.get(key) || 0)) throw new BadRequestException("Quantité supérieure au reste à rembourser");
    }
    if (requested.size === 0) throw new BadRequestException("Ce ticket est déjà entièrement remboursé");

    const refundItems = origItems
      .map((it, idx) => ({ ...it, refKey: keyOf(it, idx), qty: requested.get(keyOf(it, idx)) || 0 }))
      .filter((it) => it.qty > 0);
    const grossCents = refundItems.reduce((s, it) => s + toCents(it.price) * it.qty, 0);
    const origSubCents = toCents(orig.subtotal ?? orig.total);
    const origTotalCents = toCents(orig.total);
    const completes = [...remaining].every(([key, qty]) => qty === (requested.get(key) || 0));
    const alreadyCents = previous.reduce((s, cn) => s - toCents(cn.total), 0);
    // ponytail: si les arrondis des avoirs précédents ont trop remboursé, l'avoir final est plafonné au brut (écart ≤ 1 ct)
    const targetNet = partialNetCents({ grossCents, fullSubCents: origSubCents, fullTotalCents: origTotalCents, alreadyCents, completes });
    const discountCents = Math.max(0, grossCents - targetNet);
    const { subtotalCents, totalCents, ...vat } = computeVatBreakdown(
      refundItems,
      discountCents > 0 ? { type: "fixed", value: toEuros(discountCents) } : null
    );

    const methods = parseJson(orig.payments, []).map((p: any) => p.method);
    const method = ["especes", "carte", "autre", ...methods].includes(refundMethod)
      ? refundMethod
      : methods[0] || orig.paymentMethod || "carte";
    const neg = (n: any) => (typeof n === "number" ? -n : n);

    return this.appendTicket(tx, {
      orderId: `refund:${orig.orderId}:${previous.length + 1}`,
      tableNumber: orig.tableNumber,
      orderType: orig.orderType,
      channel: orig.channel,
      orderLabel: orig.orderLabel,
      server: actorName,
      items: JSON.stringify(refundItems.map((it) => ({ ...it, qty: -it.qty }))),
      subtotal: -toEuros(subtotalCents),
      total: -toEuros(totalCents),
      discount: discountCents > 0 ? JSON.stringify({ type: "fixed", value: toEuros(discountCents), amount: -toEuros(discountCents) }) : null,
      vatDetails: JSON.stringify({
        ...Object.fromEntries(Object.entries(vat).map(([k, v]) => [k, neg(v)])),
        rates: vat.rates.map((r) => ({ ...r, rawTtc: -r.rawTtc, ttc: -r.ttc, ht: -r.ht, vat: -r.vat })),
      }),
      paymentMethod: method,
      payments: JSON.stringify([{ id: `pay_${Date.now()}`, label: "Remboursement", method, amount: -toEuros(totalCents) }]),
      tip: 0,
      type: "CREDIT_NOTE",
      refTicketNumber: orig.ticketNumber,
      reason: motif,
    });
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

    // Un ticket par convive : encaissement d'une partie des lignes ; une note déjà entamée se solde par la même voie
    if (Array.isArray(data.lines) || order.items.some((i) => i.paidQty > 0)) {
      return this.partialCheckoutInTransaction(tx, order, data);
    }

    // 🔒 Garde anti double encaissement (double clic, rejeu hors-ligne, deux terminaux)
    const claimed = await tx.order.updateMany({
      where: { id: order.id, status: "open" },
      data: { status: "closed" },
    });
    if (claimed.count === 0) throw new ConflictException("Cette commande a déjà été encaissée");

    // Vente comptoir : pas d'envoi en cuisine, les articles saisis sont vendus et servis à l'encaissement
    const soldDirectIds = order.type === "counter" ? order.items.filter((i) => i.status === "draft").map((i) => i.id) : [];
    if (soldDirectIds.length > 0) {
      await tx.orderItem.updateMany({ where: { id: { in: soldDirectIds } }, data: { status: "served" } });
      for (const i of order.items) if (soldDirectIds.includes(i.id)) i.status = "served";
    }

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
    const { paymentList, method: finalMethod } = this.checkPayments(data, totalCents, tipCents);

    const historyRecord = await this.appendTicket(tx, {
      orderId: order.id,
      tableNumber: order.table?.number ?? null,
      orderType: order.type,
      channel: order.channel,
      orderLabel: isOffPremise(order) ? orderLabel(order) : null,
      server: data.serverName || order.server,
      items: JSON.stringify(paidItems),
      subtotal,
      total: finalTotal,
      discount: discountSnapshot ? JSON.stringify(discountSnapshot) : null,
      vatDetails: JSON.stringify(vatDetails),
      paymentMethod: finalMethod,
      payments: JSON.stringify(paymentList),
      tip: toEuros(tipCents),
      covers: order.covers ?? null,
      type: "SALE",
      refTicketNumber: null,
      reason: null,
    });

    return {
      orderId: order.id,
      history: toClientHistory(historyRecord),
      table: await this.resetTable(tx, order),
      soldDirectIds, // à déstocker après validation (vente comptoir)
      closed: true,
    };
  }

  /** Réinitialisation de la table après encaissement complet (aucune pour une commande hors salle) */
  private resetTable(tx: Prisma.TransactionClient, order: { tableId: string | null }) {
    return order.tableId
      ? tx.table.update({
          where: { id: order.tableId },
          data: {
            alert: false,
            reserved: false,
            reservationName: null,
            reservationPeople: null,
            reservationTime: null,
            reservationNote: null,
          },
        })
      : Promise.resolve(null);
  }

  /** Règlements fournis par le client : doivent égaler exactement le montant dû (pourboire compris) */
  private checkPayments(data: CheckoutInput, dueCents: number, tipCents: number) {
    const paymentList =
      data.payments && data.payments.length > 0
        ? data.payments
        : [{ id: `pay_${Date.now()}`, label: "Paiement unique", amount: toEuros(dueCents + tipCents), method: data.paymentMethod || "carte", paidAt: Date.now() }];
    const paidCents = paymentList.reduce((sum: number, p: any) => {
      const amount = Number(p?.amount);
      if (!Number.isFinite(amount) || amount < 0) throw new BadRequestException("Montant de paiement invalide");
      return sum + toCents(amount);
    }, 0);
    if (paidCents !== dueCents + tipCents) {
      throw new BadRequestException(
        `Paiements (${toEuros(paidCents).toFixed(2)} €) différents du total (${toEuros(dueCents + tipCents).toFixed(2)} €)`
      );
    }
    const method = data.paymentMethod || (paymentList.length > 1 ? "partage" : paymentList[0]?.method || "carte");
    return { paymentList, method };
  }

  /**
   * Ticket par convive : encaisse `lines` [{ itemId, qty }] (ou tout le reste) sur un ticket séparé.
   * Remise d'origine au prorata ; le ticket qui solde la note prend exactement le reste et ferme la commande.
   */
  private async partialCheckoutInTransaction(tx: Prisma.TransactionClient, order: any, data: CheckoutInput) {
    if (order.status !== "open") throw new ConflictException("Cette commande a déjà été encaissée");
    const sentItems = order.items.filter((i: any) => i.status !== "draft");
    const remaining = new Map<string, number>(sentItems.map((i: any) => [i.id, i.qty - (i.paidQty || 0)]));

    const requested = new Map<string, number>();
    if (Array.isArray(data.lines)) {
      for (const l of data.lines) {
        const qty = Number(l?.qty);
        if (!remaining.has(l?.itemId)) throw new BadRequestException("Article inconnu ou non envoyé");
        if (!Number.isInteger(qty) || qty < 1) throw new BadRequestException("Quantité à encaisser invalide");
        requested.set(l.itemId, (requested.get(l.itemId) || 0) + qty);
      }
    } else {
      for (const [id, qty] of remaining) if (qty > 0) requested.set(id, qty);
    }
    if (requested.size === 0) throw new BadRequestException("Aucun article à encaisser");

    // 🔒 Incrément conditionnel : deux terminaux ne peuvent pas encaisser deux fois la même part
    for (const [id, qty] of requested) {
      const item = sentItems.find((i: any) => i.id === id);
      const res = await tx.orderItem.updateMany({
        where: { id, paidQty: { lte: item.qty - qty } },
        data: { paidQty: { increment: qty } },
      });
      if (res.count !== 1) throw new ConflictException(`${item.name} : quantité déjà encaissée`);
    }

    const orderDiscount = order.discount ? JSON.parse(order.discount) : null;
    const full = computeVatBreakdown(sentItems, orderDiscount);
    const ticketItems = sentItems
      .filter((i: any) => requested.has(i.id))
      .map((i: any) => ({ ...i, qty: requested.get(i.id), paidQty: undefined }));
    const grossCents = ticketItems.reduce((s: number, i: any) => s + toCents(i.price) * i.qty, 0);
    const completes = [...remaining].every(([id, qty]) => qty === (requested.get(id) || 0));
    const previousParts = await tx.orderHistory.count({ where: { orderId: { startsWith: `${order.id}:p` } } });
    const netCents = partialNetCents({
      grossCents,
      fullSubCents: full.subtotalCents,
      fullTotalCents: full.totalCents,
      alreadyCents: toCents(order.paidTotal || 0),
      completes,
    });
    const discountCents = Math.max(0, grossCents - netCents);
    const { subtotalCents, totalCents, discountCents: _d, ...vatDetails } = computeVatBreakdown(
      ticketItems,
      discountCents > 0 ? { type: "fixed", value: toEuros(discountCents) } : null
    );

    const tipValue = Number(data.tip ?? 0);
    if (!Number.isFinite(tipValue) || tipValue < 0) throw new BadRequestException("Pourboire invalide");
    const tipCents = toCents(tipValue);
    const { paymentList, method } = this.checkPayments(data, totalCents, tipCents);

    const historyRecord = await this.appendTicket(tx, {
      orderId: `${order.id}:p${previousParts + 1}`,
      tableNumber: order.table?.number ?? null,
      orderType: order.type,
      channel: order.channel,
      orderLabel: isOffPremise(order) ? orderLabel(order) : null,
      server: data.serverName || order.server,
      items: JSON.stringify(ticketItems),
      subtotal: toEuros(subtotalCents),
      total: toEuros(totalCents),
      discount: discountCents > 0 ? JSON.stringify({ type: "fixed", value: toEuros(discountCents), amount: toEuros(discountCents) }) : null,
      vatDetails: JSON.stringify(vatDetails),
      paymentMethod: method,
      payments: JSON.stringify(paymentList),
      tip: toEuros(tipCents),
      // 1 couvert par ticket de convive ; le dernier ticket prend le reste des couverts saisis
      covers: order.covers == null ? null : completes ? Math.max(0, order.covers - previousParts) : 1,
      type: "SALE",
      refTicketNumber: null,
      reason: null,
    });

    await tx.order.update({
      where: { id: order.id },
      data: { paidTotal: toEuros(toCents(order.paidTotal || 0) + totalCents), ...(completes && { status: "closed" }) },
    });

    return {
      orderId: order.id,
      history: toClientHistory(historyRecord),
      table: completes ? await this.resetTable(tx, order) : null,
      soldDirectIds: [] as string[],
      closed: completes,
    };
  }
}
