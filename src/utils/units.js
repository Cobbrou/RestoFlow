/**
 * Conversion des dosages de fiche technique vers l'unité de stock
 * (copie de server/src/recipes/units.ts). Ex. 150 g pour un stock en kg → 0,15.
 */
const UNITS = {
  g: { group: "masse", factor: 1 },
  kg: { group: "masse", factor: 1000 },
  ml: { group: "volume", factor: 1 },
  cl: { group: "volume", factor: 10 },
  l: { group: "volume", factor: 1000 },
  piece: { group: "piece", factor: 1 },
  u: { group: "piece", factor: 1 },
};

/** Unités de dosage proposées pour un stock donné (même famille) */
export function compatibleUnits(stockUnit) {
  const group = UNITS[stockUnit?.toLowerCase()]?.group;
  return group ? Object.keys(UNITS).filter((u) => UNITS[u].group === group) : [stockUnit].filter(Boolean);
}

/** Facteur dosage → stock ; null si incompatibles (g contre l) ou inconnues */
export function conversionFactor(fromUnit, toUnit) {
  if (!fromUnit || !toUnit || fromUnit === toUnit) return 1;
  const from = UNITS[fromUnit.toLowerCase()];
  const to = UNITS[toUnit.toLowerCase()];
  if (!from || !to || from.group !== to.group) return null;
  return from.factor / to.factor;
}

/** Quantité dans l'unité de stock (unités incompatibles d'anciennes fiches : quantité inchangée) */
export function toStockQty(quantity, unit, stockUnit) {
  return (Number(quantity) || 0) * (conversionFactor(unit, stockUnit) ?? 1);
}
