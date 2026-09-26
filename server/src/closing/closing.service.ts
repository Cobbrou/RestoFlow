import { Injectable, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ConfigService } from "../config/config.service";
import * as crypto from "crypto";

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

@Injectable()
export class ClosingService {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService
  ) {}

  /**
   * Clé secrète de scellement NF525 issue de la configuration du restaurant
   */
  private async getNf525Key(): Promise<string> {
    const cfg = await this.configService.getConfig();
    return cfg.nf525Key || "RESTOFLOW_NF525_SECRET_KEY";
  }

  /**
   * Calcul du hash d'intégrité SHA-256 pour un ticket de vente
   */
  calculateTicketSignature(
    ticket: {
      ticketNumber?: string | null;
      sequenceNumber: number;
      createdAt: Date | string;
      total: number;
      subtotal?: number | null;
      vatDetails?: string | null;
      paymentMethod: string;
      payments: string;
      previousHash?: string | null;
    },
    secretKey: string
  ): string {
    const isoDate = new Date(ticket.createdAt).toISOString();
    const payload = [
      ticket.sequenceNumber,
      ticket.ticketNumber || "",
      isoDate,
      Number(ticket.total).toFixed(2),
      Number(ticket.subtotal || ticket.total).toFixed(2),
      ticket.paymentMethod || "",
      ticket.previousHash || "GENESIS_TICKET_RESTOFLOW",
    ].join("|");

    return crypto.createHmac("sha256", secretKey).update(payload).digest("hex");
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
    const sessionNow = new Date();

    let totalGross = 0;
    let totalDiscounts = 0;
    let totalNet = 0;
    let totalHT = 0;
    let totalVAT = 0;
    let coversCount = 0;

    const paymentsBreakdown: Record<string, number> = {
      carte: 0,
      especes: 0,
      autre: 0,
      partage: 0,
    };

    const vatMap: Record<number, { ht: number; vat: number; ttc: number }> = {};
    const itemSalesMap: Record<string, { name: string; qty: number; total: number; cat?: string }> = {};
    const serverSalesMap: Record<string, { tickets: number; total: number }> = {};

    for (const ticket of unclosedTickets) {
      totalNet += ticket.total;
      const sub = ticket.subtotal != null ? ticket.subtotal : ticket.total;
      totalGross += sub;

      if (ticket.discount) {
        try {
          const disc = typeof ticket.discount === "string" ? JSON.parse(ticket.discount) : ticket.discount;
          totalDiscounts += Number(disc.amount || 0);
        } catch {
          // ignore parsing error
        }
      }

      // Ventilation TVA
      if (ticket.vatDetails) {
        try {
          const vatData = typeof ticket.vatDetails === "string" ? JSON.parse(ticket.vatDetails) : ticket.vatDetails;
          const rates = vatData.rates || [];
          for (const r of rates) {
            const rate = Number(r.rate);
            if (!vatMap[rate]) vatMap[rate] = { ht: 0, vat: 0, ttc: 0 };
            vatMap[rate].ht += Number(r.ht || 0);
            vatMap[rate].vat += Number(r.vat || 0);
            vatMap[rate].ttc += Number(r.ttc || 0);
            totalHT += Number(r.ht || 0);
            totalVAT += Number(r.vat || 0);
          }
        } catch {
          // fallback
          const defaultHT = Math.round((ticket.total / 1.1) * 100) / 100;
          totalHT += defaultHT;
          totalVAT += ticket.total - defaultHT;
        }
      } else {
        const defaultHT = Math.round((ticket.total / 1.1) * 100) / 100;
        totalHT += defaultHT;
        totalVAT += ticket.total - defaultHT;
      }

      // Modes de règlements
      if (ticket.payments) {
        try {
          const pays = typeof ticket.payments === "string" ? JSON.parse(ticket.payments) : ticket.payments;
          for (const p of pays) {
            const method = p.method || "carte";
            paymentsBreakdown[method] = (paymentsBreakdown[method] || 0) + Number(p.amount || 0);
          }
        } catch {
          const method = ticket.paymentMethod || "carte";
          paymentsBreakdown[method] = (paymentsBreakdown[method] || 0) + ticket.total;
        }
      } else {
        const method = ticket.paymentMethod || "carte";
        paymentsBreakdown[method] = (paymentsBreakdown[method] || 0) + ticket.total;
      }

      // Articles vendus
      if (ticket.items) {
        try {
          const items = typeof ticket.items === "string" ? JSON.parse(ticket.items) : ticket.items;
          for (const it of items) {
            const key = it.productId || it.name;
            if (!itemSalesMap[key]) {
              itemSalesMap[key] = { name: it.name, qty: 0, total: 0, cat: it.cat };
            }
            itemSalesMap[key].qty += Number(it.qty || 1);
            itemSalesMap[key].total += Number(it.price || 0) * Number(it.qty || 1);
          }
        } catch {}
      }

      // Serveurs
      const srv = ticket.server || "Salle";
      if (!serverSalesMap[srv]) serverSalesMap[srv] = { tickets: 0, total: 0 };
      serverSalesMap[srv].tickets += 1;
      serverSalesMap[srv].total += ticket.total;

      coversCount += 2; // Estimation moyenne par ticket ou tableNumber
    }

    const vatBreakdown = Object.keys(vatMap).map((k) => ({
      rate: Number(k),
      ht: Math.round(vatMap[Number(k)].ht * 100) / 100,
      vat: Math.round(vatMap[Number(k)].vat * 100) / 100,
      ttc: Math.round(vatMap[Number(k)].ttc * 100) / 100,
    }));

    const topItems = Object.values(itemSalesMap)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10);

    const ticketsCount = unclosedTickets.length;
    const averageTicket = ticketsCount > 0 ? Math.round((totalNet / ticketsCount) * 100) / 100 : 0;

    return {
      type: "X",
      title: "RAPPORT X — LECTURE DE CAISSE EN DIRECT",
      isInterim: true,
      openedAt: sessionOpenedAt,
      generatedAt: sessionNow,
      ticketsCount,
      coversCount,
      totalGross: Math.round(totalGross * 100) / 100,
      totalDiscounts: Math.round(totalDiscounts * 100) / 100,
      totalNet: Math.round(totalNet * 100) / 100,
      totalHT: Math.round(totalHT * 100) / 100,
      totalVAT: Math.round(totalVAT * 100) / 100,
      averageTicket,
      paymentsBreakdown: {
        carte: Math.round((paymentsBreakdown.carte || 0) * 100) / 100,
        especes: Math.round((paymentsBreakdown.especes || 0) * 100) / 100,
        autre: Math.round((paymentsBreakdown.autre || 0) * 100) / 100,
        partage: Math.round((paymentsBreakdown.partage || 0) * 100) / 100,
      },
      vatBreakdown,
      topItems,
      serverSales: serverSalesMap,
      lastZReportNumber: lastZ?.reportNumber || null,
      lastZDate: lastZ?.closedAt || null,
      currentGrandTotal: Math.round(((lastZ?.grandTotal || cfg.grandTotal || 0) + totalNet) * 100) / 100,
    };
  }

  /**
   * 2. RAPPORT Z (Clôture journalière certifiée et irréversible)
   */
  async processZClosing(input: ZClosingInput) {
    if (!input.closedBy) {
      throw new BadRequestException("L'identité du collaborateur effectuant la clôture est obligatoire.");
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

    // Calculs financiers
    let totalGross = 0;
    let totalDiscounts = 0;
    let totalNet = 0;
    let totalHT = 0;
    let totalVAT = 0;
    let coversCount = 0;

    const paymentsBreakdown: Record<string, number> = {
      carte: 0,
      especes: 0,
      autre: 0,
    };

    const vatMap: Record<number, { ht: number; vat: number; ttc: number }> = {};

    for (const ticket of unclosedTickets) {
      totalNet += ticket.total;
      const sub = ticket.subtotal != null ? ticket.subtotal : ticket.total;
      totalGross += sub;

      if (ticket.discount) {
        try {
          const disc = typeof ticket.discount === "string" ? JSON.parse(ticket.discount) : ticket.discount;
          totalDiscounts += Number(disc.amount || 0);
        } catch {}
      }

      if (ticket.vatDetails) {
        try {
          const vatData = typeof ticket.vatDetails === "string" ? JSON.parse(ticket.vatDetails) : ticket.vatDetails;
          for (const r of vatData.rates || []) {
            const rate = Number(r.rate);
            if (!vatMap[rate]) vatMap[rate] = { ht: 0, vat: 0, ttc: 0 };
            vatMap[rate].ht += Number(r.ht || 0);
            vatMap[rate].vat += Number(r.vat || 0);
            vatMap[rate].ttc += Number(r.ttc || 0);
            totalHT += Number(r.ht || 0);
            totalVAT += Number(r.vat || 0);
          }
        } catch {
          const defaultHT = Math.round((ticket.total / 1.1) * 100) / 100;
          totalHT += defaultHT;
          totalVAT += ticket.total - defaultHT;
        }
      } else {
        const defaultHT = Math.round((ticket.total / 1.1) * 100) / 100;
        totalHT += defaultHT;
        totalVAT += ticket.total - defaultHT;
      }

      if (ticket.payments) {
        try {
          const pays = typeof ticket.payments === "string" ? JSON.parse(ticket.payments) : ticket.payments;
          for (const p of pays) {
            const method = p.method || "carte";
            paymentsBreakdown[method] = (paymentsBreakdown[method] || 0) + Number(p.amount || 0);
          }
        } catch {
          const method = ticket.paymentMethod || "carte";
          paymentsBreakdown[method] = (paymentsBreakdown[method] || 0) + ticket.total;
        }
      } else {
        const method = ticket.paymentMethod || "carte";
        paymentsBreakdown[method] = (paymentsBreakdown[method] || 0) + ticket.total;
      }

      coversCount += 2;
    }

    const round2 = (n: number) => Math.round(n * 100) / 100;
    const finalGross = round2(totalGross);
    const finalDiscounts = round2(totalDiscounts);
    const finalNet = round2(totalNet);
    const finalHT = round2(totalHT);
    const finalVAT = round2(totalVAT);
    const grandTotal = round2(grandTotalBefore + finalNet);

    const vatBreakdown = Object.keys(vatMap).map((k) => ({
      rate: Number(k),
      ht: round2(vatMap[Number(k)].ht),
      vat: round2(vatMap[Number(k)].vat),
      ttc: round2(vatMap[Number(k)].ttc),
    }));

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
   * 4. VÉRIFICATION D'INTÉGRITÉ DE LA CHAÎNE FISCALE (Audit NF525)
   */
  async verifyFiscalChainIntegrity() {
    const secretKey = await this.getNf525Key();
    const errors: string[] = [];

    // 1. Vérification de la chaîne des tickets OrderHistory
    const allTickets = await this.prisma.orderHistory.findMany({
      orderBy: { createdAt: "asc" },
    });

    let previousTicketHash = "GENESIS_TICKET_RESTOFLOW";
    let ticketsVerified = 0;

    for (let i = 0; i < allTickets.length; i++) {
      const ticket = allTickets[i];
      if (ticket.sequenceNumber != null && ticket.signature) {
        // Vérification du chaînage
        if (ticket.previousHash && ticket.previousHash !== previousTicketHash) {
          errors.push(
            `Rupture de chaînage ticket #${ticket.ticketNumber || ticket.id} : previousHash invalide (${ticket.previousHash.slice(0, 8)} vs attendu ${previousTicketHash.slice(0, 8)})`
          );
        }

        // Vérification recalcul signature
        const expectedSig = this.calculateTicketSignature(
          {
            ticketNumber: ticket.ticketNumber,
            sequenceNumber: ticket.sequenceNumber,
            createdAt: ticket.createdAt,
            total: ticket.total,
            subtotal: ticket.subtotal,
            vatDetails: ticket.vatDetails,
            paymentMethod: ticket.paymentMethod,
            payments: ticket.payments,
            previousHash: ticket.previousHash,
          },
          secretKey
        );

        if (expectedSig !== ticket.signature) {
          errors.push(
            `Altération détectée sur le ticket #${ticket.ticketNumber || ticket.id} : signature cryptographique compromise`
          );
        }

        previousTicketHash = ticket.signature;
        ticketsVerified++;
      }
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

    const isValid = errors.length === 0;

    return {
      isChainValid: isValid,
      status: isValid ? "CONFORME_NF525" : "ANOMALIE_DETECTEE",
      ticketsVerified,
      closingsVerified,
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
    let accounts = {
      journalCode: "VT",
      accountVente10: "706000",
      accountVente20: "707000",
      accountVat10: "445710",
      accountVat20: "445720",
      accountCard: "512000",
      accountCash: "530000",
      accountOther: "580000",
    };

    if (cfg.fecExportConfig) {
      try {
        accounts = { ...accounts, ...JSON.parse(cfg.fecExportConfig) };
      } catch {}
    }

    const whereClause: any = {};

    if (options.closingId) {
      whereClause.closedInZId = options.closingId;
    } else if (options.startDate || options.endDate) {
      whereClause.createdAt = {};
      if (options.startDate) whereClause.createdAt.gte = new Date(options.startDate);
      if (options.endDate) whereClause.createdAt.lte = new Date(options.endDate);
    }

    const tickets = await this.prisma.orderHistory.findMany({
      where: whereClause,
      orderBy: { createdAt: "asc" },
    });

    const lines: string[] = [];
    // Entête réglementaire 18 colonnes
    const header = [
      "JournalCode",
      "JournalLib",
      "EcritureNum",
      "EcritureDate",
      "CompteNum",
      "CompteLib",
      "CompAuxNum",
      "CompAuxLib",
      "PieceRef",
      "PieceDate",
      "EcritureLib",
      "Debit",
      "Credit",
      "EcritureLet",
      "DateLet",
      "ValidDate",
      "Montantdevise",
      "Idevise",
    ].join("|");

    lines.push(header);

    let ecritureIndex = 1;
    let totalDebitSum = 0;
    let totalCreditSum = 0;

    const formatAmount = (num: number) => num.toFixed(2).replace(".", ",");
    const formatDate = (date: Date) => {
      const d = new Date(date);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}${m}${day}`;
    };

    for (const ticket of tickets) {
      const ecritureNum = `ECR${String(ecritureIndex).padStart(6, "0")}`;
      const ecritureDate = formatDate(ticket.createdAt);
      const pieceRef = ticket.ticketNumber || `FAC-${ticket.id.slice(-6).toUpperCase()}`;
      const pieceDate = ecritureDate;
      const validDate = ecritureDate;

      // 1. Débit des comptes de règlement (trésorerie / créances)
      let paymentsList: any[] = [];
      try {
        paymentsList = ticket.payments ? JSON.parse(ticket.payments) : [];
      } catch {}

      if (paymentsList.length === 0) {
        paymentsList = [{ method: ticket.paymentMethod || "carte", amount: ticket.total }];
      }

      for (const p of paymentsList) {
        const amt = Number(p.amount || 0);
        if (amt <= 0) continue;

        let compteNum = accounts.accountCard;
        let compteLib = "Banque Carte Bancaire";

        if (p.method === "especes") {
          compteNum = accounts.accountCash;
          compteLib = "Caisse Espèces";
        } else if (p.method === "autre") {
          compteNum = accounts.accountOther;
          compteLib = "Autres règlements";
        }

        lines.push(
          [
            accounts.journalCode,
            "Journal des Ventes",
            ecritureNum,
            ecritureDate,
            compteNum,
            compteLib,
            "",
            "",
            pieceRef,
            pieceDate,
            `Encaissement ${pieceRef} (${p.method})`,
            formatAmount(amt),
            "0,00",
            "",
            "",
            validDate,
            "",
            "",
          ].join("|")
        );

        totalDebitSum += amt;
      }

      // 2. Crédit des comptes de TVA et Produit HT
      let vatRates: any[] = [];
      try {
        const vatData = ticket.vatDetails ? JSON.parse(ticket.vatDetails) : null;
        vatRates = vatData?.rates || [];
      } catch {}

      if (vatRates.length === 0) {
        // Ventilation par défaut : 10%
        const ht = Math.round((ticket.total / 1.1) * 100) / 100;
        const vat = Math.round((ticket.total - ht) * 100) / 100;
        vatRates = [{ rate: 10, ht, vat, ttc: ticket.total }];
      }

      for (const vr of vatRates) {
        const rate = Number(vr.rate);
        const ht = Number(vr.ht || 0);
        const vat = Number(vr.vat || 0);

        // Compte Vente HT (706000 pour 10% nourriture, 707000 pour 20% alcools)
        const compteVente = rate === 20 ? accounts.accountVente20 : accounts.accountVente10;
        const libVente = rate === 20 ? "Ventes de boissons alcools (20%)" : "Prestations restauration (10%)";

        if (ht > 0) {
          lines.push(
            [
              accounts.journalCode,
              "Journal des Ventes",
              ecritureNum,
              ecritureDate,
              compteVente,
              libVente,
              "",
              "",
              pieceRef,
              pieceDate,
              `Vente ${pieceRef} HT (${rate}%)`,
              "0,00",
              formatAmount(ht),
              "",
              "",
              validDate,
              "",
              "",
            ].join("|")
          );
          totalCreditSum += ht;
        }

        // Compte TVA collectée
        const compteTva = rate === 20 ? accounts.accountVat20 : accounts.accountVat10;
        const libTva = `TVA collectée (${rate}%)`;

        if (vat > 0) {
          lines.push(
            [
              accounts.journalCode,
              "Journal des Ventes",
              ecritureNum,
              ecritureDate,
              compteTva,
              libTva,
              "",
              "",
              pieceRef,
              pieceDate,
              `TVA ${pieceRef} (${rate}%)`,
              "0,00",
              formatAmount(vat),
              "",
              "",
              validDate,
              "",
              "",
            ].join("|")
          );
          totalCreditSum += vat;
        }
      }

      ecritureIndex++;
    }

    const cleanSiret = (cfg.siret || "98765432100012").replace(/\s+/g, "");
    const todayStr = formatDate(new Date());
    const fileName = `${cleanSiret}FEC${todayStr}.txt`;

    return {
      fileName,
      totalDebit: Math.round(totalDebitSum * 100) / 100,
      totalCredit: Math.round(totalCreditSum * 100) / 100,
      isBalanced: Math.abs(totalDebitSum - totalCreditSum) < 0.05,
      recordsCount: lines.length - 1,
      ticketsCount: tickets.length,
      content: lines.join("\r\n"),
    };
  }
}
