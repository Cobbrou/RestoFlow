/** Statistiques du tableau de bord, cumulées en centimes (avoirs négatifs inclus) */
const cents = (n) => Math.round((Number(n) || 0) * 100);

/** CA et tickets par heure de la journée, de la première à la dernière heure active */
export function salesByHour(history = []) {
  const hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, cents: 0, tickets: 0 }));
  for (const h of history) {
    const slot = hours[new Date(h.createdAt).getHours()];
    slot.cents += cents(h.total);
    if (h.type !== "CREDIT_NOTE") slot.tickets++;
  }
  const active = hours.filter((s) => s.tickets > 0 || s.cents !== 0);
  if (active.length === 0) return [];
  return hours
    .slice(active[0].hour, active[active.length - 1].hour + 1)
    .map((s) => ({ name: `${s.hour}h`, ca: s.cents / 100, tickets: s.tickets }));
}

/** CA, tickets, panier moyen et pourboires par serveur, du plus gros CA au plus petit */
export function salesByServer(history = []) {
  const map = new Map();
  for (const h of history) {
    const name = h.server || "—";
    const s = map.get(name) || { name, cents: 0, tickets: 0, tipCents: 0 };
    s.cents += cents(h.total);
    s.tipCents += cents(h.tip);
    if (h.type !== "CREDIT_NOTE") s.tickets++;
    map.set(name, s);
  }
  return [...map.values()]
    .sort((a, b) => b.cents - a.cents)
    .map((s) => ({
      name: s.name,
      ca: s.cents / 100,
      tickets: s.tickets,
      average: s.tickets ? Math.round(s.cents / s.tickets) / 100 : 0,
      tips: s.tipCents / 100,
    }));
}
