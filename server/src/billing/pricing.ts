/**
 * Calculs monétaires de référence côté serveur (prix, remise, ventilation TVA).
 * Tous les calculs internes sont faits en centimes entiers pour éviter les dérives flottantes.
 */

export const toCents = (euros: number) => Math.round((Number(euros) || 0) * 100);
export const toEuros = (cents: number) => cents / 100;

export interface DiscountInput {
  type?: string;
  value?: number;
}

/**
 * Montant de remise en centimes, borné au sous-total.
 * "percent" : pourcentage borné à [0, 100] ; "fixed" : montant en euros.
 */
export function computeDiscountCents(subtotalCents: number, discount?: DiscountInput | null): number {
  if (!discount) return 0;
  const value = Math.max(0, Number(discount.value) || 0);
  const cents =
    discount.type === "percent"
      ? Math.round((subtotalCents * Math.min(100, value)) / 100)
      : discount.type === "fixed"
        ? toCents(value)
        : 0;
  return Math.min(subtotalCents, cents);
}

export interface PricedItem {
  price: number;
  qty: number;
  vatRate?: number | null;
}

/**
 * Ventilation TVA (même format que src/utils/vat.js côté front) :
 * remise répartie au prorata de chaque taux, ajustement au centime sur le dernier taux.
 */
export function computeVatBreakdown(items: PricedItem[], discount?: DiscountInput | null) {
  const byRate = new Map<number, number>();
  let subtotalCents = 0;
  for (const it of items) {
    const lineCents = toCents(it.price) * (it.qty || 1);
    const rate = it.vatRate != null ? Number(it.vatRate) : 10;
    byRate.set(rate, (byRate.get(rate) || 0) + lineCents);
    subtotalCents += lineCents;
  }

  const discountCents = computeDiscountCents(subtotalCents, discount);
  const totalCents = subtotalCents - discountCents;
  const rates = [...byRate.keys()].sort((a, b) => a - b);

  let accumulated = 0;
  const ratesResult = rates.map((rate, idx) => {
    const rawCents = byRate.get(rate)!;
    const ttcCents =
      idx === rates.length - 1
        ? totalCents - accumulated
        : subtotalCents > 0
          ? Math.round((totalCents * rawCents) / subtotalCents)
          : 0;
    accumulated += ttcCents;
    const htCents = Math.round((ttcCents * 100) / (100 + rate));
    return {
      rate,
      rawTtc: toEuros(rawCents),
      ttc: toEuros(ttcCents),
      ht: toEuros(htCents),
      vat: toEuros(ttcCents - htCents),
    };
  });

  const htCentsTotal = ratesResult.reduce((s, r) => s + toCents(r.ht), 0);
  return {
    rates: ratesResult,
    totalHT: toEuros(htCentsTotal),
    totalVAT: toEuros(totalCents - htCentsTotal),
    totalTTC: toEuros(totalCents),
    subtotal: toEuros(subtotalCents),
    discountAmount: toEuros(discountCents),
    // Valeurs entières de référence pour les contrôles serveur
    subtotalCents,
    discountCents,
    totalCents,
  };
}

export interface HappyHourConfig {
  enabled?: boolean;
  startTime?: string;
  endTime?: string;
  days?: number[];
  discountPercent?: number;
  categories?: string[];
}

/** Copie serveur de isHappyHourActive (src/utils/index.js) */
export function isHappyHourActive(hh: HappyHourConfig | null | undefined, date: Date): boolean {
  if (!hh?.enabled) return false;
  if (Array.isArray(hh.days) && !hh.days.includes(date.getDay())) return false;
  const minutes = date.getHours() * 60 + date.getMinutes();
  const [sh, sm] = (hh.startTime || "17:00").split(":").map(Number);
  const [eh, em] = (hh.endTime || "20:00").split(":").map(Number);
  return minutes >= sh * 60 + sm && minutes < eh * 60 + em;
}

/** Copie serveur de getProductEffectivePrice (src/utils/index.js) */
export function effectivePrice(
  product: { price: number; cat?: string; happyHourPrice?: number | null },
  hh: HappyHourConfig | null | undefined,
  date: Date
): number {
  if (!isHappyHourActive(hh, date)) return product.price || 0;
  if (product.happyHourPrice != null && product.happyHourPrice > 0) return product.happyHourPrice;
  const targetCats = hh?.categories || ["boissons"];
  if (product.cat && targetCats.includes(product.cat)) {
    const rate = (hh?.discountPercent || 20) / 100;
    return Math.max(0, Math.round(product.price * (1 - rate) * 100) / 100);
  }
  return product.price || 0;
}

export interface OptionChoice {
  label: string;
  price: number;
}

export interface OptionGroup {
  name: string;
  required: boolean;
  max: number;
  choices: OptionChoice[];
}

export interface OptionPick {
  group: string;
  choice: string;
}

/** Nettoie les groupes d'options saisis au back-office (frontière de confiance) */
export function normalizeOptionGroups(raw: unknown): OptionGroup[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .flatMap((g: any) => {
      const name = String(g?.name ?? "").trim().slice(0, 40);
      const choices: OptionChoice[] = (Array.isArray(g?.choices) ? g.choices : [])
        .map((c: any) => ({
          label: String(c?.label ?? "").trim().slice(0, 40),
          price: toEuros(Math.max(0, toCents(c?.price))),
        }))
        .filter((c: OptionChoice, i: number, all: OptionChoice[]) => c.label && all.findIndex((o) => o.label === c.label) === i);
      if (!name || choices.length === 0) return [];
      const max = Math.min(choices.length, Math.max(1, Math.floor(Number(g?.max)) || choices.length));
      return [{ name, required: !!g?.required, max, choices }];
    })
    .filter((g, i, all) => all.findIndex((o) => o.name === g.name) === i)
    .slice(0, 10);
}

/**
 * Libellé figé (copie de resolveOptions dans src/utils/index.js) et supplément en centimes
 * d'une sélection d'options. Lève si la sélection ne respecte pas les groupes du produit.
 */
export function resolveOptions(groups: OptionGroup[], picks: OptionPick[] | undefined | null) {
  const list = Array.isArray(picks) ? picks : [];
  if (list.some((p) => !groups.some((g) => g.name === p?.group))) throw new Error("Groupe d'options inconnu");

  const parts: string[] = [];
  let extraCents = 0;
  for (const g of groups) {
    const labels = list.filter((p) => p.group === g.name).map((p) => p.choice);
    const chosen = g.choices.filter((c) => labels.includes(c.label));
    if (chosen.length !== labels.length) throw new Error(`Option inconnue ou en double pour « ${g.name} »`);
    if (g.required && chosen.length === 0) throw new Error(`Choix obligatoire : ${g.name}`);
    if (chosen.length > g.max) throw new Error(`${g.name} : ${g.max} choix maximum`);
    for (const c of chosen) {
      extraCents += toCents(c.price);
      parts.push(c.price > 0 ? `${c.label} (+${c.price.toFixed(2)}€)` : c.label);
    }
  }
  return { label: parts.join(" · "), extraCents };
}
