/**
 * Suggestion de commande fournisseur : tout ingrédient actif au seuil d'alerte ou dessous
 * est recommandé jusqu'au stock idéal, regroupé par fournisseur.
 */
export function reorderBySupplier(ingredients = []) {
  const groups = new Map();
  for (const ing of ingredients) {
    if (ing.archived || ing.currentStock > ing.minThreshold) continue;
    const missing = ing.idealStock - Math.max(0, ing.currentStock);
    // Les pièces se commandent à l'unité, le reste au centième
    const qty = ing.unit === "piece" ? Math.ceil(missing) : Math.round(missing * 100) / 100;
    if (!(qty > 0)) continue;
    const supplier = ing.supplier?.trim() || "Sans fournisseur";
    const cents = Math.round(qty * (ing.costPerUnit || 0) * 100);
    const group = groups.get(supplier) || { supplier, lines: [], totalCents: 0 };
    group.lines.push({ ingredient: ing, qty, totalCents: cents });
    group.totalCents += cents;
    groups.set(supplier, group);
  }
  return [...groups.values()].sort((a, b) =>
    a.supplier === "Sans fournisseur" ? 1 : b.supplier === "Sans fournisseur" ? -1 : a.supplier.localeCompare(b.supplier, "fr")
  );
}

/** Export CSV (séparateur « ; », décimales à virgule pour Excel FR) */
export function reorderCsv(groups) {
  const num = (n) => String(n).replace(".", ",");
  const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = [["Fournisseur", "Référence", "Ingrédient", "Quantité", "Unité", "Prix unitaire HT", "Total HT"]];
  for (const g of groups) {
    for (const l of g.lines) {
      const i = l.ingredient;
      rows.push([g.supplier, i.supplierRef || "", i.name, num(l.qty), i.unit, num(i.costPerUnit || 0), num((l.totalCents / 100).toFixed(2))]);
    }
  }
  return rows.map((r) => r.map(cell).join(";")).join("\r\n");
}
