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

/**
 * Heures pointées par équipier sur une liste de services ; un service en cours compte jusqu'à `now`.
 * @returns [{ staffId, minutes, shifts, open }] du plus grand nombre d'heures au plus petit
 */
export function hoursByStaff(shifts = [], now = Date.now()) {
  const map = new Map();
  for (const s of shifts) {
    const start = new Date(s.startAt).getTime();
    const end = s.endAt ? new Date(s.endAt).getTime() : now;
    const row = map.get(s.staffId) || { staffId: s.staffId, minutes: 0, shifts: 0, open: false };
    row.minutes += Math.max(0, Math.round((end - start) / 60000));
    row.shifts++;
    row.open ||= !s.endAt;
    map.set(s.staffId, row);
  }
  return [...map.values()].sort((a, b) => b.minutes - a.minutes);
}

/** 125 → « 2 h 05 » */
export const formatMinutes = (m) => `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`;
