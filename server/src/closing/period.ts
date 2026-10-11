import * as crypto from "crypto";
import { toCents, toEuros } from "../billing/pricing";

/**
 * Clôtures périodiques NF525 : un mois cumule ses Z, une année cumule ses mois.
 * Fonctions pures (bornes, cumul, signature), la persistance est dans ClosingService.
 */

export type PeriodType = "MONTH" | "YEAR";
export const GENESIS_PERIOD = "GENESIS_PERIOD_RESTOFLOW";

const FORMATS: Record<PeriodType, RegExp> = { MONTH: /^\d{4}-(0[1-9]|1[0-2])$/, YEAR: /^\d{4}$/ };

/** Bornes locales [début, fin[ d'une période "2026-10" ou "2026" ; null si le format est invalide */
export function periodBounds(type: PeriodType, period: string): { start: Date; end: Date } | null {
  if (!FORMATS[type]?.test(period)) return null;
  const year = Number(period.slice(0, 4));
  if (type === "YEAR") return { start: new Date(year, 0, 1), end: new Date(year + 1, 0, 1) };
  const month = Number(period.slice(5, 7)) - 1;
  return { start: new Date(year, month, 1), end: new Date(year, month + 1, 1) };
}

/** Mois "AAAA-MM" (heure locale) d'une date */
export function monthOf(date: Date | string): string {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export interface ClosingTotals {
  totalGross: number;
  totalDiscounts: number;
  totalNet: number;
  totalHT: number;
  totalVAT: number;
  totalTips?: number | null;
  ticketsCount: number;
  coversCount: number;
  paymentsBreakdown: string | Record<string, number>;
  vatBreakdown: string | { rate: number; ht: number; vat: number; ttc: number }[];
}

const parse = <T>(v: string | T, fallback: T): T => {
  if (typeof v !== "string") return v ?? fallback;
  try {
    return JSON.parse(v);
  } catch {
    return fallback;
  }
};

/** Cumul de Z (ou de mois) en centimes entiers, pour ne pas accumuler d'erreurs d'arrondi */
export function aggregateClosings(rows: ClosingTotals[]) {
  const sum = (pick: (r: ClosingTotals) => number | null | undefined) =>
    toEuros(rows.reduce((s, r) => s + toCents(pick(r) || 0), 0));

  const payments: Record<string, number> = {};
  const vat = new Map<number, { ht: number; vat: number; ttc: number }>();
  for (const r of rows) {
    for (const [method, amount] of Object.entries(parse(r.paymentsBreakdown, {} as Record<string, number>))) {
      payments[method] = (payments[method] || 0) + toCents(amount);
    }
    for (const v of parse(r.vatBreakdown, [] as any[])) {
      const acc = vat.get(Number(v.rate)) || { ht: 0, vat: 0, ttc: 0 };
      acc.ht += toCents(v.ht);
      acc.vat += toCents(v.vat);
      acc.ttc += toCents(v.ttc);
      vat.set(Number(v.rate), acc);
    }
  }

  return {
    totalGross: sum((r) => r.totalGross),
    totalDiscounts: sum((r) => r.totalDiscounts),
    totalNet: sum((r) => r.totalNet),
    totalHT: sum((r) => r.totalHT),
    totalVAT: sum((r) => r.totalVAT),
    totalTips: sum((r) => r.totalTips),
    ticketsCount: rows.reduce((s, r) => s + (r.ticketsCount || 0), 0),
    coversCount: rows.reduce((s, r) => s + (r.coversCount || 0), 0),
    paymentsBreakdown: Object.fromEntries(Object.entries(payments).map(([k, c]) => [k, toEuros(c)])),
    vatBreakdown: [...vat.entries()]
      .sort(([a], [b]) => a - b)
      .map(([rate, c]) => ({ rate, ht: toEuros(c.ht), vat: toEuros(c.vat), ttc: toEuros(c.ttc) })),
  };
}

export interface SignedPeriodFields {
  sequenceNumber: number;
  reportNumber: string;
  type: string;
  period: string;
  closedAt: Date | string;
  closedBy: string;
  closingsCount: number;
  totalNet: number;
  totalHT: number;
  totalVAT: number;
  ticketsCount: number;
  grandTotal: number;
  previousHash: string | null;
}

export function signPeriodClosing(p: SignedPeriodFields, secretKey: string): string {
  const payload = [
    "p1",
    p.sequenceNumber,
    p.reportNumber,
    p.type,
    p.period,
    new Date(p.closedAt).toISOString(),
    p.closedBy,
    p.closingsCount,
    Number(p.totalNet).toFixed(2),
    Number(p.totalHT).toFixed(2),
    Number(p.totalVAT).toFixed(2),
    p.ticketsCount,
    Number(p.grandTotal).toFixed(2),
    p.previousHash || GENESIS_PERIOD,
  ].join("|");
  return crypto.createHmac("sha256", secretKey).update(payload).digest("hex");
}
