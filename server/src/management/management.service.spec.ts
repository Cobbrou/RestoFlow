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

  describe("un compte ou un rôle mieux doté reste hors de portée", () => {
    const make = () => {
      const roles: Record<string, string[]> = { gerant: ["gestion.staff", "caisse.fec"], serveur: ["salle.order"] };
      const staff: Record<string, any> = { s2: { id: "s2", roleId: "gerant" }, s3: { id: "s3", roleId: "serveur" } };
      const writes: string[] = [];
      const prisma: any = {
        staff: {
          findUnique: async ({ where }: any) => staff[where.id] ?? null,
          update: async ({ where }: any) => writes.push(`staff:${where.id}`),
          delete: async ({ where }: any) => writes.push(`delete:${where.id}`),
          findMany: async () => [],
          count: async () => 0,
        },
        role: {
          findUnique: async ({ where }: any) =>
            roles[where.id] ? { id: where.id, isSystem: false, permissions: JSON.stringify(roles[where.id]) } : null,
          update: async ({ where }: any) => writes.push(`role:${where.id}`),
          delete: async ({ where }: any) => writes.push(`role-delete:${where.id}`),
          findMany: async () => [],
        },
      };
      return { writes, service: new ManagementService(prisma) };
    };

    it("refuse de changer le PIN, de supprimer ou de modifier le rôle d'un collègue aux droits supérieurs", async () => {
      const { writes, service } = make();
      await expect(service.updateStaff("s2", { pin: "9999" }, manager)).rejects.toThrow("caisse.fec");
      await expect(service.deleteStaff("s2", manager)).rejects.toThrow("caisse.fec");
      await expect(service.updateRole("gerant", { permissions: ["gestion.staff"] }, manager)).rejects.toThrow("caisse.fec");
      await expect(service.deleteRole("gerant", manager)).rejects.toThrow("caisse.fec");
      expect(writes).toEqual([]);
    });

    it("autorise la gestion d'un compte dont il détient tous les droits", async () => {
      const { writes, service } = make();
      await service.updateStaff("s3", { pin: "9999" }, manager);
      await service.updateRole("serveur", { name: "Serveur" }, manager);
      expect(writes).toEqual(["staff:s3", "role:serveur"]);
    });
  });
});

describe("Équipe : longueur du PIN selon le rôle", () => {
  const admin = { staffId: "a", roleId: "admin", permissions: [] };
  const make = () => {
    const roles: Record<string, string[]> = { admin: [], gerant: ["caisse.close"], serveur: ["salle.order"] };
    const staff: Record<string, any> = { s3: { id: "s3", roleId: "serveur" }, s4: { id: "s4", roleId: "gerant" } };
    const writes: any[] = [];
    const prisma: any = {
      staff: {
        findUnique: async ({ where }: any) => staff[where.id] ?? null,
        create: async ({ data }: any) => writes.push(data),
        update: async ({ data }: any) => writes.push(data),
        findMany: async () => [],
      },
      role: {
        findUnique: async ({ where }: any) => (roles[where.id] ? { id: where.id, permissions: JSON.stringify(roles[where.id]) } : null),
      },
    };
    return { writes, service: new ManagementService(prisma) };
  };

  it("exige 6 chiffres pour un rôle sensible, 4 pour les autres", async () => {
    const { writes, service } = make();
    await expect(service.createStaff({ name: "Gérant", roleId: "admin", pin: "1234" }, admin)).rejects.toThrow("6 chiffres");
    await expect(service.createStaff({ name: "Chef", roleId: "gerant", pin: "1234" }, admin)).rejects.toThrow("6 chiffres");
    await expect(service.createStaff({ name: "Léa", roleId: "serveur", pin: "123456" }, admin)).rejects.toThrow("4 chiffres");
    await service.createStaff({ name: "Chef", roleId: "gerant", pin: "123456" }, admin);
    await service.createStaff({ name: "Léa", roleId: "serveur", pin: "1234" }, admin);
    expect(writes).toHaveLength(2);
  });

  it("un changement de rôle qui change la longueur exige un nouveau PIN", async () => {
    const { writes, service } = make();
    await expect(service.updateStaff("s3", { roleId: "gerant" }, admin)).rejects.toThrow("saisissez un nouveau PIN");
    await expect(service.updateStaff("s4", { roleId: "serveur" }, admin)).rejects.toThrow("saisissez un nouveau PIN");
    await expect(service.updateStaff("s4", { pin: "1234" }, admin)).rejects.toThrow("6 chiffres");
    await service.updateStaff("s3", { roleId: "gerant", pin: "654321" }, admin);
    await service.updateStaff("s3", { roleId: "serveur", pin: "4321" }, admin);
    await service.updateStaff("s4", { name: "Inès" }, admin);
    expect(writes.map((w) => w.roleId ?? w.name)).toEqual(["gerant", "serveur", "Inès"]);
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
