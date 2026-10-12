/**
 * Utilitaire de calcul et de ventilation fiscale de la TVA (Norme Restauration France)
 * 
 * - TVA 10% : Restauration immédiate (plats, entrées, desserts, formules, softs, café).
 * - TVA 20% : Boissons alcoolisées (vins, bières, spiritueux, cocktails).
 * - TVA 5.5% : Produits alimentaires sous emballage scellé conservable (si applicable).
 */

/**
 * Ventilation d'un menu au prorata des prix de ses composants (copie de menuVatSplit, server/src/billing/pricing.ts).
 * @returns {Array|null} [{ rate, weight }] (poids en centimes), null si un seul taux
 */
export function menuVatSplit(components = []) {
  const byRate = new Map();
  for (const c of components) {
    const rate = c?.vatRate != null ? Number(c.vatRate) : 10;
    byRate.set(rate, (byRate.get(rate) || 0) + Math.max(0, Math.round((Number(c?.price) || 0) * 100)));
  }
  const shares = [...byRate].map(([rate, weight]) => ({ rate, weight })).filter((s) => s.weight > 0);
  return shares.length > 1 ? shares : null;
}

/**
 * Net (centimes) d'une partie de note, remise au prorata ; la partie qui solde la note prend le reste.
 * Copie de partialNetCents (server/src/billing/pricing.ts) : le serveur refuse tout écart.
 */
export function partialNetCents({ grossCents, fullSubCents, fullTotalCents, alreadyCents, completes }) {
  if (completes) return fullTotalCents - alreadyCents;
  return fullSubCents > 0 ? Math.round((grossCents * fullTotalCents) / fullSubCents) : 0;
}

// Montant d'une ligne (en euros) réparti par taux, au centime près (reste sur le dernier taux)
function splitLine(amount, rate, vatSplit) {
  let shares = vatSplit;
  if (typeof shares === "string") {
    try {
      shares = JSON.parse(shares);
    } catch {
      shares = [];
    }
  }
  if (!Array.isArray(shares)) shares = [];
  const totalWeight = shares.reduce((s, x) => s + (Number(x.weight) || 0), 0);
  if (totalWeight <= 0) return [[rate, amount]];
  const cents = Math.round(amount * 100);
  let left = cents;
  return shares.map((s, i) => {
    const part = i === shares.length - 1 ? left : Math.round((cents * (Number(s.weight) || 0)) / totalWeight);
    left -= part;
    return [Number(s.rate), part / 100];
  });
}

/**
 * Calcule la ventilation complète de la TVA pour une liste d'articles avec prise en compte
 * de la remise globale au prorata des assiettes fiscales.
 *
 * @param {Array} items - Liste des articles [{ price, qty, vatRate, ... }]
 * @param {Object|null} discount - Objet remise { type: "percent"|"fixed", value: number, amount?: number }
 * @returns {Object} Résumé fiscal : { rates, totalHT, totalVAT, totalTTC, subtotal, discountAmount }
 */
export function calculateVatBreakdown(items = [], discount = null) {
  const validItems = items.filter((i) => i.status !== "draft");
  // En centimes entiers, comme computeVatBreakdown / computeDiscountCents (server/src/billing/pricing.ts) :
  // le serveur refuse des règlements qui s'écartent d'un centime de son total
  const subtotalCents = validItems.reduce((acc, it) => acc + Math.round((it.price || 0) * 100) * (it.qty || 1), 0);
  const subtotal = subtotalCents / 100;

  let discountCents = 0;
  if (discount) {
    const value = Math.max(0, Number(discount.value) || 0);
    if (discount.type === "percent") discountCents = Math.round((subtotalCents * Math.min(100, value)) / 100);
    else if (discount.type === "fixed") discountCents = Math.round(value * 100);
  }
  discountCents = Math.min(subtotalCents, discountCents);
  const discountAmount = discountCents / 100;
  const finalTotalTTC = (subtotalCents - discountCents) / 100;

  // Regroupement par taux de TVA
  const byRate = {};

  for (const item of validItems) {
    // Par défaut : 20% si vin/bière/alcool ou cat boissons avec indication alcool, sinon 10%
    let rate = 10;
    if (item.vatRate != null) {
      rate = Number(item.vatRate);
    } else if (
      item.cat === "boissons" &&
      (item.name?.toLowerCase().includes("vin") ||
       item.name?.toLowerCase().includes("bière") ||
       item.name?.toLowerCase().includes("rhône") ||
       item.name?.toLowerCase().includes("alcool"))
    ) {
      rate = 20;
    }

    const itemTotal = (item.price || 0) * (item.qty || 1);
    for (const [r, amount] of splitLine(itemTotal, rate, item.vatSplit)) {
      if (!byRate[r]) byRate[r] = { rawTtc: 0 };
      byRate[r].rawTtc += amount;
    }
  }

  // Si aucun article
  const ratesList = Object.keys(byRate).map(Number).sort((a, b) => a - b);
  if (ratesList.length === 0) {
    return {
      rates: [],
      totalHT: 0,
      totalVAT: 0,
      totalTTC: 0,
      subtotal: 0,
      discountAmount: 0,
    };
  }

  // Répartition de la remise au prorata de chaque taux pour respecter la fiscalité
  let accumulatedTtc = 0;
  const ratesResult = ratesList.map((rate, idx) => {
    const raw = byRate[rate].rawTtc;
    let netTtc;

    if (idx === ratesList.length - 1) {
      // Ajustement au centime sur le dernier taux
      netTtc = Math.max(0, Math.round((finalTotalTTC - accumulatedTtc) * 100) / 100);
    } else {
      const ratio = subtotal > 0 ? raw / subtotal : 0;
      netTtc = Math.round(finalTotalTTC * ratio * 100) / 100;
      accumulatedTtc += netTtc;
    }

    const divisor = 1 + rate / 100;
    const ht = Math.round((netTtc / divisor) * 100) / 100;
    const vat = Math.round((netTtc - ht) * 100) / 100;

    return {
      rate,
      rawTtc: Math.round(raw * 100) / 100,
      ttc: netTtc,
      ht,
      vat,
    };
  });

  const totalHT = Math.round(ratesResult.reduce((sum, r) => sum + r.ht, 0) * 100) / 100;
  const totalVAT = Math.round(ratesResult.reduce((sum, r) => sum + r.vat, 0) * 100) / 100;

  return {
    rates: ratesResult,
    totalHT,
    totalVAT,
    totalTTC: finalTotalTTC,
    subtotal: Math.round(subtotal * 100) / 100,
    discountAmount,
  };
}
