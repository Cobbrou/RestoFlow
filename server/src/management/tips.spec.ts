import { describe, it, expect } from "vitest";
import { distributeTips } from "./tips";

const h = (x: number) => new Date(2026, 9, 12, x).getTime();
const staff = [
  { id: "lea", name: "Léa", roleId: "server" },
  { id: "marco", name: "Marco", roleId: "server" },
  { id: "chef", name: "Antoine", roleId: "kitchen" },
  { id: "boss", name: "Sarah", roleId: "admin" },
];
const shifts = [
  { staffId: "lea", startAt: new Date(h(10)), endAt: new Date(h(16)) }, // 6 h
  { staffId: "marco", startAt: new Date(h(12)), endAt: new Date(h(15)) }, // 3 h
  { staffId: "chef", startAt: new Date(h(9)), endAt: null }, // en cours : 3 h à 12 h
  { staffId: "boss", startAt: new Date(h(8)), endAt: new Date(h(18)) },
];
const period = { from: h(0), to: h(24), now: h(12) };
const shares = (r: any) => Object.fromEntries(r.rows.map((x: any) => [x.staffId, x.shareCents]));

describe("distributeTips", () => {
  it("au prorata des heures, rôles exclus, somme exacte au centime", () => {
    const r = distributeTips(10000, shifts, staff, period, { excludedRoleIds: ["admin"] });
    expect(shares(r)).toEqual({ boss: 0, lea: 5000, marco: 2500, chef: 2500 });
    expect(r.undistributedCents).toBe(0);
  });

  it("pondère par rôle et répartit les centimes restants", () => {
    const r = distributeTips(1001, shifts, staff, period, { mode: "weighted", roleWeights: { kitchen: 0.5, admin: 0 } });
    // poids : lea 360, marco 180, chef 90, boss 0
    expect(shares(r)).toEqual({ boss: 0, lea: 572, marco: 286, chef: 143 });
    expect(r.rows.reduce((s, x) => s + x.shareCents, 0)).toBe(1001);
  });

  it("parts égales entre pointés, découpe aux bornes de la période", () => {
    const r = distributeTips(300, shifts, staff, { from: h(14), to: h(24), now: h(20) }, { mode: "equal", excludedStaffIds: ["boss"] });
    expect(shares(r)).toEqual({ lea: 100, marco: 100, chef: 100, boss: 0 });
    expect(r.rows.find((x) => x.staffId === "marco")!.minutes).toBe(60);
  });

  it("rien à répartir sans équipier éligible", () => {
    const r = distributeTips(500, shifts, staff, period, { excludedRoleIds: ["server", "kitchen", "admin"] });
    expect(r.undistributedCents).toBe(500);
  });
});
