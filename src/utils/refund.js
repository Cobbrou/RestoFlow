/**
 * Lignes d'un ticket encore remboursables, déduction faite des avoirs déjà émis
 * (même règle que appendPartialRefund, server/src/billing/billing.service.ts).
 * @returns {Array} [{ key, name, price, qty (vendue), remaining }]
 */
export function refundableLines(ticket, creditNotes = []) {
  const keyOf = (it, idx) => it.refKey ?? it.id ?? `#${idx}`;
  const refunded = new Map();
  for (const cn of creditNotes) {
    (cn.items || []).forEach((it, idx) => {
      const key = keyOf(it, idx);
      refunded.set(key, (refunded.get(key) || 0) + Math.abs(Number(it.qty) || 0));
    });
  }
  return (ticket?.items || []).map((it, idx) => {
    const key = keyOf(it, idx);
    return { key, name: it.name, price: it.price, qty: it.qty, remaining: Math.max(0, (Number(it.qty) || 0) - (refunded.get(key) || 0)) };
  });
}
