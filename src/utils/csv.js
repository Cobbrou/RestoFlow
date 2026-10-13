const FORMULA_START = /^[=+\-@\t\r]/;
const NUMBER = /^-?\d+([.,]\d+)?$/;

/**
 * Cellule CSV pour Excel : guillemets doublés, et apostrophe devant un texte qui commencerait une formule
 * (=, +, -, @), sinon un nom saisi comme « =HYPERLINK(...) » s'exécuterait à l'ouverture du fichier
 */
export function csvCell(value) {
  const text = String(value ?? "");
  const safe = FORMULA_START.test(text) && !NUMBER.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** Lignes CSV séparées par « ; » (Excel FR) */
export const csvRows = (rows) => rows.map((r) => r.map(csvCell).join(";")).join("\r\n");
