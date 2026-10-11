/**
 * Conversion des dosages de fiche technique vers l'unité de stock (copie dans src/utils/units.js).
 * Ex. 150 g pour un stock en kg → 0,15 ; 4 cl pour un stock en l → 0,04.
 */
const UNITS: Record<string, { group: string; factor: number }> = {
  g: { group: "masse", factor: 1 },
  kg: { group: "masse", factor: 1000 },
  ml: { group: "volume", factor: 1 },
  cl: { group: "volume", factor: 10 },
  l: { group: "volume", factor: 1000 },
  piece: { group: "piece", factor: 1 },
  u: { group: "piece", factor: 1 },
};

/** Facteur dosage → stock ; null si les unités sont incompatibles (g contre l) ou inconnues */
export function conversionFactor(fromUnit?: string | null, toUnit?: string | null): number | null {
  if (!fromUnit || !toUnit || fromUnit === toUnit) return 1;
  const from = UNITS[fromUnit.toLowerCase()];
  const to = UNITS[toUnit.toLowerCase()];
  if (!from || !to || from.group !== to.group) return null;
  return from.factor / to.factor;
}

/** Quantité dans l'unité de stock (unités incompatibles d'anciennes fiches : quantité inchangée) */
export function toStockQty(quantity: number, unit?: string | null, stockUnit?: string | null): number {
  return quantity * (conversionFactor(unit, stockUnit) ?? 1);
}
