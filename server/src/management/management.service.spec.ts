import { describe, it, expect } from "vitest";
import { assertCanGrant, ManagementService } from "./management.service";

describe("Équipe et rôles : pas d'escalade de droits", () => {
  const manager = { staffId: "s1", roleId: "manager", permissions: ["gestion.staff", "salle.order"] };

  it("un non-admin ne touche ni au rôle admin ni à des droits qu'il n'a pas", () => {
    expect(() => assertCanGrant(manager, "admin")).toThrow("administrateur");
    expect(() => assertCanGrant(manager, null, ["salle.order", "caisse.fec"])).toThrow("caisse.fec");
    expect(() => assertCanGrant(manager, "serveur", ["salle.order"])).not.toThrow();
  });

  it("l'admin peut tout attribuer", () => {
    expect(() => assertCanGrant({ staffId: "a", roleId: "admin", permissions: [] }, "admin", ["caisse.fec"])).not.toThrow();
  });
});

describe("Pointage", () => {
  const make = () => {
    const shifts: any[] = [];
    const prisma: any = {
      staff: { findUnique: async ({ where }: any) => (where.id === "s1" ? { id: "s1", active: true } : null) },
      shift: {
        findFirst: async ({ where }: any) => shifts.find((s) => s.staffId === where.staffId && s.endAt === null) ?? null,
        findUnique: async ({ where }: any) => shifts.find((s) => s.id === where.id) ?? null,
        create: async ({ data }: any) => (shifts.push({ ...data, endAt: null }), shifts[shifts.length - 1]),
        update: async ({ where, data }: any) => Object.assign(shifts.find((s) => s.id === where.id), data),
      },
    };
    return { shifts, service: new ManagementService(prisma) };
  };

  it("arrivée puis départ, rejouables sans doublon", async () => {
    const { shifts, service } = make();
    const t = Date.now() - 3600000;
    await service.clock({ id: "sh1", staffId: "s1", action: "in", at: t });
    await service.clock({ id: "sh1", staffId: "s1", action: "in", at: t }); // rejeu
    expect(shifts).toHaveLength(1);
    expect(shifts[0].startAt.getTime()).toBe(t);
    await service.clock({ staffId: "s1", action: "out", at: t + 1800000 });
    expect(shifts[0].endAt.getTime()).toBe(t + 1800000);
    expect(await service.clock({ staffId: "s1", action: "out" })).toBeNull(); // rejeu du départ
  });

  it("refuse un équipier inconnu et borne l'heure de la tablette", async () => {
    const { shifts, service } = make();
    await expect(service.clock({ staffId: "zz", action: "in" })).rejects.toThrow(/introuvable/);
    await service.clock({ staffId: "s1", action: "in", at: Date.now() + 3600000 }); // futur : heure serveur
    expect(shifts[0].startAt.getTime()).toBeLessThanOrEqual(Date.now());
  });
});
