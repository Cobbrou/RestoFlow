import { Injectable, BadRequestException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ConfigService } from "../config/config.service";
import * as crypto from "crypto";
import { GENESIS_TICKET, signTicket } from "../billing/fiscal";
import { JournalService } from "../journal/journal.service";
import { orderLabel } from "../orders/orders.service";
import { toCents, toEuros } from "../billing/pricing";
import { GENESIS_PERIOD, PeriodType, aggregateClosings, monthOf, periodBounds, signPeriodClosing } from "./period";

export interface ZClosingInput {
  closedBy: string;
  openingCash?: number;
  countedCash?: number;
  notes?: string;
}

export interface FecExportOptions {
  startDate?: string;
  endDate?: string;
  closingId?: string;
}

/**
 * Couverts d'un ticket : saisis à l'ouverture de la table (répartis entre tickets de convive) ;
 * à défaut (vente à emporter, ancien ticket), 1. Un avoir ne retire pas de couverts : les clients sont bien venus.
 */
export function ticketCovers(ticket: { type?: string | null; covers?: number | null }): number {
  if (ticket.type === "CREDIT_NOTE") return 0;
  return ticket.covers != null && ticket.covers >= 0 ? ticket.covers : 1;
}

const parseOr = (v: unknown, fallback: any) => {
  if (!v) return fallback;
  try {
    return typeof v === "string" ? JSON.parse(v) : v;
  } catch {
    return fallback;
  }
};

/**
 * Cumul des tickets d'une session de caisse, commun aux rapports X et Z.
 * Calculé en centimes entiers ; un ticket sans ventilation TVA (ancien format) est compté à 10 %.
 */
export function aggregateTickets(tickets: any[]) {
  let gross = 0, discounts = 0, net = 0, ht = 0, vat = 0, tips = 0, coversCount = 0;
  const payments: Record<string, number> = { carte: 0, especes: 0, autre: 0 };
  const vatMap = new Map<number, { ht: number; vat: number; ttc: number }>();

  for (const t of tickets) {
    const total = toCents(t.total);
    net += total;
    tips += toCents(t.tip);
    gross += toCents(t.subtotal ?? t.total);
    discounts += toCents(parseOr(t.discount, null)?.amount);

    const rates = parseOr(t.vatDetails, null)?.rates;
    if (Array.isArray(rates)) {
      for (const r of rates) {
        const acc = vatMap.get(Number(r.rate)) || { ht: 0, vat: 0, ttc: 0 };
        acc.ht += toCents(r.ht);
        acc.vat += toCents(r.vat);
        acc.ttc += toCents(r.ttc);
        vatMap.set(Number(r.rate), acc);
        ht += toCents(r.ht);
        vat += toCents(r.vat);
      }
    } else {
      const defaultHT = Math.round((total * 100) / 110);
      ht += defaultHT;
      vat += total - defaultHT;
    }

    const pays = parseOr(t.payments, null);
    for (const pay of Array.isArray(pays) ? pays : [{ method: t.paymentMethod, amount: t.total }]) {
      const method = pay.method || "carte";
      payments[method] = (payments[method] || 0) + toCents(pay.amount);
    }
    coversCount += ticketCovers(t);
  }

  return {
    totalGross: toEuros(gross),
    totalDiscounts: toEuros(discounts),
    totalNet: toEuros(net),
    totalHT: toEuros(ht),
    totalVAT: toEuros(vat),
    totalTips: toEuros(tips),
    coversCount,
    paymentsBreakdown: Object.fromEntries(Object.entries(payments).map(([k, c]) => [k, toEuros(c)])) as Record<string, number>,
    vatBreakdown: [...vatMap.entries()]
      .sort(([a], [b]) => a - b)
      .map(([rate, c]) => ({ rate, ht: toEuros(c.ht), vat: toEuros(c.vat), ttc: toEuros(c.ttc) })),
  };
}

@Injectable()
export class ClosingService {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private journal: JournalService
  ) {}

  /**
   * Clé secrète de scellement NF525 issue de la configuration du restaurant
   */
  private async getNf525Key(): Promise<string> {
    return this.configService.getNf525Key();
  }

  /**
   * Calcul du hash d'intégrité SHA-256 pour une clôture Z
   */
  calculateClosingSignature(
    closing: {
      sequenceNumber: number;
      reportNumber: string;
      openedAt: Date | string;
      closedAt: Date | string;
      closedBy: string;
      totalGross: number;
      totalDiscounts: number;
      totalNet: number;
      totalHT: number;
      totalVAT: number;
      ticketsCount: number;
      grandTotalBefore: number;
      grandTotal: number;
      previousHash?: string | null;
    },
    secretKey: string
  ): string {
    const payload = [
      closing.sequenceNumber,
      closing.reportNumber,
      new Date(closing.openedAt).toISOString(),
      new Date(closing.closedAt).toISOString(),
      closing.closedBy,
      closing.totalGross.toFixed(2),
      closing.totalDiscounts.toFixed(2),
      closing.totalNet.toFixed(2),
      closing.totalHT.toFixed(2),
      closing.totalVAT.toFixed(2),
      closing.ticketsCount,
      closing.grandTotalBefore.toFixed(2),
      closing.grandTotal.toFixed(2),
      closing.previousHash || "GENESIS_Z_RESTOFLOW",
    ].join("|");

    return crypto.createHmac("sha256", secretKey).update(payload).digest("hex");
  }

  /**
   * 1. RAPPORT X (Lecture intermédiaire non destructive de la caisse)
   */
  async getXReport() {
    const cfg = await this.configService.getConfig();

    // Trouver le dernier Z pour borner la session
    const lastZ = await this.prisma.dailyClosing.findFirst({
      orderBy: { sequenceNumber: "desc" },
    });

    const unclosedTickets = await this.prisma.orderHistory.findMany({
      where: {
        closedInZId: null,
      },
      orderBy: { createdAt: "asc" },
    });

    const sessionOpenedAt = lastZ ? lastZ.closedAt : (unclosedTickets[0]?.createdAt || new Date());
    const totals = aggregateTickets(unclosedTickets);

    // Propre au X : articles vendus et ventes par serveur
    const itemSalesMap: Record<string, { name: string; qty: number; total: number; cat?: string }> = {};
    const serverSalesMap: Record<string, { tickets: number; total: number }> = {};
    for (const ticket of unclosedTickets) {
      for (const it of parseOr(ticket.items, [])) {
        const key = it.productId || it.name;
        if (!itemSalesMap[key]) itemSalesMap[key] = { name: it.name, qty: 0, total: 0, cat: it.cat };
        itemSalesMap[key].qty += Number(it.qty || 1);
        itemSalesMap[key].total += Number(it.price || 0) * Number(it.qty || 1);
      }
      const srv = ticket.server || "Salle";
      if (!serverSalesMap[srv]) serverSalesMap[srv] = { tickets: 0, total: 0 };
      serverSalesMap[srv].tickets += 1;
      serverSalesMap[srv].total += ticket.total;
    }

    const topItems = Object.values(itemSalesMap)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10);

    const ticketsCount = unclosedTickets.length;
    const { paymentsBreakdown: pb, ...rest } = totals;

    return {
      type: "X",
      title: "RAPPORT X — LECTURE DE CAISSE EN DIRECT",
      isInterim: true,
      openedAt: sessionOpenedAt,
      generatedAt: new Date(),
      ticketsCount,
      ...rest,
      averageTicket: ticketsCount > 0 ? Math.round((totals.totalNet / ticketsCount) * 100) / 100 : 0,
      paymentsBreakdown: { ...pb, partage: pb.partage || 0 },
      topItems,
      serverSales: serverSalesMap,
      lastZReportNumber: lastZ?.reportNumber || null,
      lastZDate: lastZ?.closedAt || null,
      currentGrandTotal: toEuros(toCents(lastZ?.grandTotal || cfg.grandTotal || 0) + toCents(totals.totalNet)),
    };
  }

  /**
   * 2. RAPPORT Z (Clôture journalière certifiée et irréversible)
   */
  async processZClosing(input: ZClosingInput) {
    if (!input.closedBy) {
      throw new BadRequestException("L'identité du collaborateur effectuant la clôture est obligatoire.");
    }

    // 0. Pas de Z tant que des articles envoyés restent à encaisser (sinon leur vente glisse sur le Z suivant)
    const openOrders = await this.prisma.order.findMany({
      where: { status: "open", items: { some: { status: { not: "draft" } } } },
      include: { table: true },
    });
    if (openOrders.length > 0) {
      throw new BadRequestException(
        `Encaissez ou soldez d'abord les commandes ouvertes : ${openOrders.map((o) => orderLabel(o)).join(", ")}`
      );
    }

    const secretKey = await this.getNf525Key();
    const cfg = await this.configService.getConfig();

    // 1. Récupérer les tickets en attente
    const unclosedTickets = await this.prisma.orderHistory.findMany({
      where: { closedInZId: null },
      orderBy: { createdAt: "asc" },
    });

    // 2. Récupérer la dernière clôture Z
    const lastZ = await this.prisma.dailyClosing.findFirst({
      orderBy: { sequenceNumber: "desc" },
    });

    const now = new Date();
    const nextSeq = (lastZ?.sequenceNumber || 0) + 1;
    const currentYear = now.getFullYear();
    const reportNumber = `Z-${currentYear}-${String(nextSeq).padStart(4, "0")}`;
    const previousHash = lastZ?.signature || "GENESIS_Z_RESTOFLOW";
    const grandTotalBefore = lastZ?.grandTotal || cfg.grandTotal || 0;
    const openedAt = lastZ ? lastZ.closedAt : (unclosedTickets[0]?.createdAt || now);

    // Calculs financiers (communs avec le rapport X)
    const round2 = (n: number) => Math.round(n * 100) / 100;
    const {
      totalGross: finalGross,
      totalDiscounts: finalDiscounts,
      totalNet: finalNet,
      totalHT: finalHT,
      totalVAT: finalVAT,
      totalTips: finalTips,
      coversCount,
      paymentsBreakdown,
      vatBreakdown,
    } = aggregateTickets(unclosedTickets);
    const grandTotal = toEuros(toCents(grandTotalBefore) + toCents(finalNet));

    const openingCash = round2(input.openingCash || 0);
    const theoreticalCash = round2(openingCash + (paymentsBreakdown.especes || 0));
    const countedCash = input.countedCash != null ? round2(input.countedCash) : theoreticalCash;
    const cashVariance = round2(countedCash - theoreticalCash);

    const zId = `z_${now.getTime()}_${Math.random().toString(36).slice(2, 6)}`;
    const ticketIds = unclosedTickets.map((t) => t.id);

    // Calcul de la signature numérique du rapport Z (NF525)
    const signature = this.calculateClosingSignature(
      {
        sequenceNumber: nextSeq,
        reportNumber,
        openedAt,
        closedAt: now,
        closedBy: input.closedBy,
        totalGross: finalGross,
        totalDiscounts: finalDiscounts,
        totalNet: finalNet,
        totalHT: finalHT,
        totalVAT: finalVAT,
        ticketsCount: unclosedTickets.length,
        grandTotalBefore,
        grandTotal,
        previousHash,
      },
      secretKey
    );

    // Transaction atomique Prisma
    const [createdClosing] = await this.prisma.$transaction([
      this.prisma.dailyClosing.create({
        data: {
          id: zId,
          sequenceNumber: nextSeq,
          reportNumber,
          openedAt,
          closedAt: now,
          closedBy: input.closedBy,
          totalGross: finalGross,
          totalDiscounts: finalDiscounts,
          totalNet: finalNet,
          totalHT: finalHT,
          totalVAT: finalVAT,
          totalTips: finalTips,
          ticketsCount: unclosedTickets.length,
          coversCount,
          paymentsBreakdown: JSON.stringify(paymentsBreakdown),
          vatBreakdown: JSON.stringify(vatBreakdown),
          openingCash,
          countedCash,
          cashVariance,
          grandTotalBefore,
          grandTotal,
          previousHash,
          signature,
          orderHistoryIds: JSON.stringify(ticketIds),
        },
      }),
      // Marquer tous les tickets rattachés avec l'identifiant Z
      this.prisma.orderHistory.updateMany({
        where: { id: { in: ticketIds } },
        data: { closedInZId: zId },
      }),
      // Mettre à jour le Grand Total de configuration
      this.prisma.restaurantConfig.update({
        where: { id: "default" },
        data: {
          grandTotal,
          lastClosingDate: now,
        },
      }),
    ]);

    return {
      ...createdClosing,
      paymentsBreakdown,
      vatBreakdown,
      orderHistoryIds: ticketIds,
    };
  }

  /**
   * 3. HISTORIQUE DES RAPPORTS Z
   */
  async getClosingsHistory(limit = 50) {
    const list = await this.prisma.dailyClosing.findMany({
      orderBy: { sequenceNumber: "desc" },
      take: limit,
    });

    return list.map((z) => ({
      ...z,
      paymentsBreakdown: JSON.parse(z.paymentsBreakdown || "{}"),
      vatBreakdown: JSON.parse(z.vatBreakdown || "[]"),
      orderHistoryIds: JSON.parse(z.orderHistoryIds || "[]"),
    }));
  }

  /**
   * 3 bis. CLÔTURES MENSUELLES ET ANNUELLES (NF525)
   * Mois : cumul des Z ouverts dans le mois, une fois le mois terminé et tous ses tickets passés en Z.
   * Année : cumul des clôtures mensuelles, une fois chaque mois actif de l'année clôturé.
   */
  async closePeriod(input: { type: PeriodType; period: string; closedBy: string }) {
    const { type, period, closedBy } = input;
    if (!closedBy) throw new BadRequestException("L'identité du collaborateur effectuant la clôture est obligatoire.");
    const bounds = periodBounds(type, period);
    if (!bounds) throw new BadRequestException("Période invalide (AAAA-MM pour un mois, AAAA pour une année)");
    const now = new Date();
    if (now < bounds.end) throw new BadRequestException("La période n'est pas terminée");
    if (await this.prisma.periodClosing.findUnique({ where: { type_period: { type, period } } })) {
      throw new ConflictException(`La période ${period} est déjà clôturée`);
    }

    const zInPeriod = await this.prisma.dailyClosing.findMany({
      where: { openedAt: { gte: bounds.start, lt: bounds.end } },
      orderBy: { sequenceNumber: "asc" },
    });

    let rows: any[];
    let first: string | null;
    let last: string | null;
    if (type === "MONTH") {
      const pending = await this.prisma.orderHistory.count({ where: { closedInZId: null, createdAt: { lt: bounds.end } } });
      if (pending > 0) throw new BadRequestException(`${pending} ticket(s) de la période sans Z : effectuez d'abord le Z`);
      rows = zInPeriod;
      first = zInPeriod[0]?.reportNumber ?? null;
      last = zInPeriod[zInPeriod.length - 1]?.reportNumber ?? null;
    } else {
      const months = await this.prisma.periodClosing.findMany({
        where: { type: "MONTH", period: { startsWith: `${period}-` } },
        orderBy: { period: "asc" },
      });
      const closedMonths = new Set(months.map((m) => m.period));
      const missing = [...new Set(zInPeriod.map((z) => monthOf(z.openedAt)))].filter((m) => !closedMonths.has(m));
      if (missing.length > 0) throw new BadRequestException(`Clôturez d'abord les mois : ${missing.join(", ")}`);
      rows = months;
      first = months[0]?.reportNumber ?? null;
      last = months[months.length - 1]?.reportNumber ?? null;
    }

    const totals = aggregateClosings(rows);
    // Grand Total perpétuel à la fin de la période : celui du dernier Z ouvert avant la fin
    const lastZ = await this.prisma.dailyClosing.findFirst({
      where: { openedAt: { lt: bounds.end } },
      orderBy: { sequenceNumber: "desc" },
    });
    const previous = await this.prisma.periodClosing.findFirst({ orderBy: { sequenceNumber: "desc" } });

    const fields = {
      sequenceNumber: (previous?.sequenceNumber || 0) + 1,
      reportNumber: `${type === "MONTH" ? "M" : "A"}-${period}`,
      type,
      period,
      closedAt: now,
      closedBy,
      closingsCount: rows.length,
      ...totals,
      grandTotal: lastZ?.grandTotal ?? 0,
      previousHash: previous?.signature || GENESIS_PERIOD,
    };
    const created = await this.prisma.periodClosing.create({
      data: {
        ...fields,
        id: `per_${now.getTime()}_${Math.random().toString(36).slice(2, 6)}`,
        periodStart: bounds.start,
        periodEnd: bounds.end,
        firstReport: first,
        lastReport: last,
        paymentsBreakdown: JSON.stringify(totals.paymentsBreakdown),
        vatBreakdown: JSON.stringify(totals.vatBreakdown),
        signature: signPeriodClosing(fields, await this.getNf525Key()),
      },
    });
    return this.formatPeriod(created);
  }

  async getPeriodClosings(limit = 60) {
    const list = await this.prisma.periodClosing.findMany({ orderBy: { sequenceNumber: "desc" }, take: limit });
    return list.map((p) => this.formatPeriod(p));
  }

  private formatPeriod(p: any) {
    return { ...p, paymentsBreakdown: JSON.parse(p.paymentsBreakdown || "{}"), vatBreakdown: JSON.parse(p.vatBreakdown || "[]") };
  }

  /**
   * 4. VÉRIFICATION D'INTÉGRITÉ DE LA CHAÎNE FISCALE (Audit NF525)
   */
  async verifyFiscalChainIntegrity() {
    const secretKey = await this.getNf525Key();
    const errors: string[] = [];

    // 1. Vérification de la chaîne des tickets OrderHistory (ordre de séquence, sans trou, tous signés)
    const allTickets = await this.prisma.orderHistory.findMany({
      orderBy: [{ sequenceNumber: "asc" }, { createdAt: "asc" }],
    });

    let previousTicketHash = GENESIS_TICKET;
    let ticketsVerified = 0;
    let expectedSeq = 1;

    for (const ticket of allTickets) {
      const label = ticket.ticketNumber || ticket.id;
      if (ticket.sequenceNumber == null || !ticket.signature) {
        errors.push(`Ticket #${label} hors chaîne fiscale (non numéroté ou non signé)`);
        continue;
      }
      if (ticket.sequenceNumber !== expectedSeq) {
        errors.push(`Trou dans la séquence des tickets : n°${expectedSeq} attendu, n°${ticket.sequenceNumber} trouvé`);
      }
      expectedSeq = ticket.sequenceNumber + 1;

      if (ticket.previousHash !== previousTicketHash) {
        errors.push(`Rupture de chaînage ticket #${label} : previousHash invalide`);
      }
      if (signTicket(ticket as any, secretKey) !== ticket.signature) {
        errors.push(`Altération détectée sur le ticket #${label} : signature cryptographique compromise`);
      }

      previousTicketHash = ticket.signature;
      ticketsVerified++;
    }

    // 2. Vérification de la chaîne des rapports DailyClosing
    const allClosings = await this.prisma.dailyClosing.findMany({
      orderBy: { sequenceNumber: "asc" },
    });

    let previousClosingHash = "GENESIS_Z_RESTOFLOW";
    let closingsVerified = 0;

    for (let i = 0; i < allClosings.length; i++) {
      const z = allClosings[i];
      if (i > 0 && z.sequenceNumber !== allClosings[i - 1].sequenceNumber + 1) {
        errors.push(
          `Trou dans la numérotation séquentielle des rapports Z : passage de Z n°${allClosings[i - 1].sequenceNumber} à n°${z.sequenceNumber}`
        );
      }

      if (z.previousHash && z.previousHash !== previousClosingHash) {
        errors.push(
          `Rupture de chaînage rapport ${z.reportNumber} : previousHash invalide (${z.previousHash.slice(0, 8)} vs attendu ${previousClosingHash.slice(0, 8)})`
        );
      }

      const expectedZSig = this.calculateClosingSignature(
        {
          sequenceNumber: z.sequenceNumber,
          reportNumber: z.reportNumber,
          openedAt: z.openedAt,
          closedAt: z.closedAt,
          closedBy: z.closedBy,
          totalGross: z.totalGross,
          totalDiscounts: z.totalDiscounts,
          totalNet: z.totalNet,
          totalHT: z.totalHT,
          totalVAT: z.totalVAT,
          ticketsCount: z.ticketsCount,
          grandTotalBefore: z.grandTotalBefore,
          grandTotal: z.grandTotal,
          previousHash: z.previousHash,
        },
        secretKey
      );

      if (expectedZSig !== z.signature) {
        errors.push(
          `Altération détectée sur le rapport ${z.reportNumber} : empreinte numérique corrompue`
        );
      }

      previousClosingHash = z.signature;
      closingsVerified++;
    }

    // 2 bis. Chaîne des clôtures mensuelles et annuelles
    const allPeriods = await this.prisma.periodClosing.findMany({ orderBy: { sequenceNumber: "asc" } });
    let previousPeriodHash = GENESIS_PERIOD;
    allPeriods.forEach((p, i) => {
      if (p.sequenceNumber !== i + 1) errors.push(`Trou dans la numérotation des clôtures périodiques : n°${i + 1} attendu, n°${p.sequenceNumber} trouvé`);
      if (p.previousHash !== previousPeriodHash) errors.push(`Rupture de chaînage de la clôture ${p.reportNumber} : previousHash invalide`);
      if (signPeriodClosing(p, secretKey) !== p.signature) errors.push(`Altération détectée sur la clôture ${p.reportNumber} : empreinte numérique corrompue`);
      previousPeriodHash = p.signature;
    });

    // 3. Journal des événements techniques (JET)
    const jet = await this.journal.verify();
    errors.push(...jet.errors);

    const isValid = errors.length === 0;

    return {
      isChainValid: isValid,
      status: isValid ? "CONFORME_NF525" : "ANOMALIE_DETECTEE",
      ticketsVerified,
      closingsVerified,
      periodsVerified: allPeriods.length,
      eventsVerified: jet.eventsVerified,
      totalTickets: allTickets.length,
      totalClosings: allClosings.length,
      lastClosingHash: allClosings.length > 0 ? allClosings[allClosings.length - 1].signature : null,
      verifiedAt: new Date().toISOString(),
      errors,
    };
  }

  /**
   * 5. GÉNÉRATION DE L'EXPORT COMPTABLE FEC (Fichier des Écritures Comptables)
   * Norme DGFiP : Article A.47 A-1 du Livre des Procédures Fiscales (18 colonnes délimitées par |)
   */
  async generateFecExport(options: FecExportOptions = {}) {
    const cfg = await this.configService.getConfig();
    // getConfig() renvoie déjà fecExportConfig désérialisé
    const accounts = {
      journalCode: "VT",
      accountVente55: "706500",
      accountVente10: "706000",
      accountVente20: "707000",
      accountVat55: "445705",
      accountVat10: "445710",
      accountVat20: "445720",
      accountCard: "512000",
      accountCash: "530000",
      accountCheque: "511200",
      accountMealVoucher: "511300",
      accountOther: "580000",
      accountTips: "468600",
      ...cfg.fecExportConfig,
    };

    // Dates "AAAA-MM-JJ" interprétées en heure locale ; la date de fin est incluse en entier
    const dayStart = (d: string) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T00:00:00`) : new Date(d));
    const whereClause: any = {};
    if (options.closingId) {
      whereClause.closedInZId = options.closingId;
    } else if (options.startDate || options.endDate) {
      whereClause.createdAt = {};
      if (options.startDate) whereClause.createdAt.gte = dayStart(options.startDate);
      if (options.endDate) {
        const end = dayStart(options.endDate);
        if (/^\d{4}-\d{2}-\d{2}$/.test(options.endDate)) end.setDate(end.getDate() + 1);
        whereClause.createdAt.lt = end;
      }
    }

    const tickets = await this.prisma.orderHistory.findMany({
      where: whereClause,
      orderBy: [{ sequenceNumber: "asc" }, { createdAt: "asc" }],
    });

    const formatDate = (date: Date) => {
      const d = new Date(date);
      return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
    };
    const formatCents = (c: number) => (c / 100).toFixed(2).replace(".", ",");
    const cents = (n: any) => Math.round((Number(n) || 0) * 100);

    const rateAccounts = (rate: number) =>
      rate === 20
        ? { vente: accounts.accountVente20, tva: accounts.accountVat20, lib: "Ventes de boissons alcoolisées (20%)" }
        : rate === 5.5
          ? { vente: accounts.accountVente55, tva: accounts.accountVat55, lib: "Ventes à emporter (5,5%)" }
          : { vente: accounts.accountVente10, tva: accounts.accountVat10, lib: `Prestations restauration (${rate}%)` };

    const lines: string[] = [
      [
        "JournalCode", "JournalLib", "EcritureNum", "EcritureDate", "CompteNum", "CompteLib", "CompAuxNum",
        "CompAuxLib", "PieceRef", "PieceDate", "EcritureLib", "Debit", "Credit", "EcritureLet", "DateLet",
        "ValidDate", "Montantdevise", "Idevise",
      ].join("|"),
    ];

    let totalDebitCents = 0;
    let totalCreditCents = 0;
    let unbalancedEntries = 0;

    tickets.forEach((ticket, idx) => {
      // Numéro de séquence fiscal : stable d'un export à l'autre (deux exports successifs ne réutilisent jamais un numéro)
      const ecritureNum = `ECR${String(ticket.sequenceNumber ?? idx + 1).padStart(6, "0")}`;
      const date = formatDate(ticket.createdAt);
      const pieceRef = ticket.ticketNumber || ticket.id;
      const isCreditNote = ticket.type === "CREDIT_NOTE";

      // Montants signés : débit si positif ; un avoir (négatif) inverse le sens
      const entries: { compte: string; lib: string; texte: string; debit: number }[] = [];

      let payments: any[] = [];
      try {
        payments = ticket.payments ? JSON.parse(ticket.payments) : [];
      } catch {}
      if (payments.length === 0) payments = [{ method: ticket.paymentMethod, amount: ticket.total }];
      for (const p of payments) {
        const amount = cents(p.amount);
        if (amount === 0) continue;
        const [compte, lib] =
          p.method === "especes"
            ? [accounts.accountCash, "Caisse Espèces"]
            : p.method === "carte"
              ? [accounts.accountCard, "Banque Carte Bancaire"]
              : p.method === "cheque"
                ? [accounts.accountCheque, "Chèques à encaisser"]
                : p.method === "titre_resto"
                  ? [accounts.accountMealVoucher, "Titres-restaurant à encaisser"]
                  : [accounts.accountOther, "Autres règlements"];
        entries.push({ compte, lib, texte: `${isCreditNote ? "Remboursement" : "Encaissement"} ${pieceRef} (${p.method})`, debit: amount });
      }

      let rates: any[] = [];
      try {
        rates = ticket.vatDetails ? JSON.parse(ticket.vatDetails)?.rates || [] : [];
      } catch {}
      if (rates.length === 0) {
        // Ticket antérieur à la ventilation TVA : 10 % par défaut
        const ttc = cents(ticket.total);
        const ht = Math.round((ttc * 100) / 110);
        rates = [{ rate: 10, ht: ht / 100, vat: (ttc - ht) / 100 }];
      }
      for (const r of rates) {
        const rate = Number(r.rate);
        const acc = rateAccounts(rate);
        if (cents(r.ht) !== 0) entries.push({ compte: acc.vente, lib: acc.lib, texte: `${isCreditNote ? "Avoir" : "Vente"} ${pieceRef} HT (${rate}%)`, debit: -cents(r.ht) });
        if (cents(r.vat) !== 0) entries.push({ compte: acc.tva, lib: `TVA collectée (${rate}%)`, texte: `TVA ${pieceRef} (${rate}%)`, debit: -cents(r.vat) });
      }

      // Pourboire encaissé avec le règlement : dû au personnel, hors CA
      if (cents(ticket.tip) !== 0) {
        entries.push({ compte: accounts.accountTips, lib: "Pourboires à reverser", texte: `Pourboire ${pieceRef}`, debit: -cents(ticket.tip) });
      }

      let entryDebit = 0;
      let entryCredit = 0;
      for (const e of entries) {
        const debit = e.debit > 0 ? e.debit : 0;
        const credit = e.debit < 0 ? -e.debit : 0;
        entryDebit += debit;
        entryCredit += credit;
        lines.push(
          [
            accounts.journalCode, "Journal des Ventes", ecritureNum, date, e.compte, e.lib, "", "", pieceRef, date,
            e.texte, formatCents(debit), formatCents(credit), "", "", date, "", "",
          ].join("|")
        );
      }
      if (entryDebit !== entryCredit) unbalancedEntries++;
      totalDebitCents += entryDebit;
      totalCreditCents += entryCredit;
    });

    // Nom réglementaire : SIREN (9 premiers chiffres du SIRET) + "FEC" + date de clôture de la période
    const siren = String(cfg.siret || "").replace(/\D/g, "").slice(0, 9) || "000000000";
    const periodEnd = options.endDate ? dayStart(options.endDate) : new Date();

    return {
      fileName: `${siren}FEC${formatDate(periodEnd)}.txt`,
      totalDebit: totalDebitCents / 100,
      totalCredit: totalCreditCents / 100,
      isBalanced: totalDebitCents === totalCreditCents && unbalancedEntries === 0,
      unbalancedEntries,
      recordsCount: lines.length - 1,
      ticketsCount: tickets.length,
      content: lines.join("\r\n"),
    };
  }
}
