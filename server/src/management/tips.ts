/**
 * Répartition des pourboires d'une période entre les équipiers ayant pointé.
 * Calcul en centimes ; la somme des parts égale toujours le montant réparti (plus forts restes).
 */
export type TipsMode = "hours" | "weighted" | "equal";

export interface TipsOptions {
  mode?: TipsMode; // hours : au prorata des heures ; weighted : heures × coefficient du rôle ; equal : parts égales
  roleWeights?: Record<string, number>; // coefficient par rôle (mode weighted, 1 par défaut)
  excludedRoleIds?: string[]; // rôles exclus (ex. direction)
  excludedStaffIds?: string[];
}

interface Shift { staffId: string; startAt: Date | string; endAt: Date | string | null }
interface Member { id: string; name: string; roleId: string }

export function distributeTips(
  tipCents: number,
  shifts: Shift[],
  staff: Member[],
  period: { from: number; to: number; now?: number },
  options: TipsOptions = {}
) {
  const mode = options.mode ?? "hours";
  const now = period.now ?? Date.now();
  const excludedRoles = new Set(options.excludedRoleIds ?? []);
  const excludedStaff = new Set(options.excludedStaffIds ?? []);

  // Minutes pointées dans la période (service en cours compté jusqu'à maintenant, découpé aux bornes)
  const minutes = new Map<string, number>();
  for (const s of shifts) {
    const start = Math.max(new Date(s.startAt).getTime(), period.from);
    const end = Math.min(s.endAt ? new Date(s.endAt).getTime() : now, period.to);
    if (end > start) minutes.set(s.staffId, (minutes.get(s.staffId) ?? 0) + Math.round((end - start) / 60000));
  }

  const rows = staff
    .filter((m) => minutes.get(m.id))
    .map((m) => {
      const eligible = !excludedRoles.has(m.roleId) && !excludedStaff.has(m.id);
      const mins = minutes.get(m.id)!;
      const coef = Math.max(0, Number(options.roleWeights?.[m.roleId] ?? 1)) || 0;
      const weight = !eligible ? 0 : mode === "equal" ? 1 : mode === "weighted" ? mins * coef : mins;
      return { staffId: m.id, name: m.name, roleId: m.roleId, minutes: mins, eligible, weight, shareCents: 0 };
    })
    .sort((a, b) => b.minutes - a.minutes);

  const totalWeight = rows.reduce((s, r) => s + r.weight, 0);
  if (tipCents <= 0 || totalWeight <= 0) return { tipCents, distributedCents: 0, undistributedCents: tipCents, rows };

  // Plus forts restes : chaque centime non attribué par l'arrondi inférieur va aux plus gros reliquats
  const exact = rows.map((r) => (tipCents * r.weight) / totalWeight);
  rows.forEach((r, i) => (r.shareCents = Math.floor(exact[i])));
  let left = tipCents - rows.reduce((s, r) => s + r.shareCents, 0);
  const byRemainder = rows.map((_, i) => i).sort((a, b) => exact[b] - Math.floor(exact[b]) - (exact[a] - Math.floor(exact[a])));
  for (const i of byRemainder) {
    if (left <= 0) break;
    if (rows[i].weight > 0) {
      rows[i].shareCents++;
      left--;
    }
  }
  return { tipCents, distributedCents: tipCents, undistributedCents: 0, rows };
}
