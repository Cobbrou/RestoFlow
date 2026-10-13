import { describe, it, expect } from "vitest";
import * as bcrypt from "bcryptjs";
import { AuthService } from "./auth.service";

describe("Connexion par PIN", () => {
  const make = (ids: string[]) => {
    const pin = bcrypt.hashSync("1234", 4);
    const queries: any[] = [];
    const prisma: any = {
      staff: {
        findFirst: async ({ where }: any) => {
          queries.push(where);
          return ids.includes(where.id) ? { id: where.id, name: "Équipier", roleId: "serveur", pin, role: { permissions: "[]" } } : null;
        },
      },
    };
    const journal: any = { log: async () => {} };
    return { queries, service: new AuthService(prisma, journal) };
  };

  it("refuse un identifiant ou un PIN qui n'est pas une chaîne, sans interroger la base", async () => {
    const { queries, service } = make(["s1"]);
    await expect(service.verifyPin("1234", { not: "x" })).rejects.toThrow(/Sélectionnez un équipier/);
    await expect(service.verifyPin(["1", "2", "3", "4"], "s1")).rejects.toThrow(/PIN invalide/);
    await expect(service.verifyPin("12a4", "s1")).rejects.toThrow(/PIN invalide/);
    expect(queries).toHaveLength(0);
  });

  it("des essais simultanés ne contournent pas le verrouillage", async () => {
    const { service } = make(["s-burst"]);
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, (_, i) => service.verifyPin(String(5000 + i), "s-burst"))
    );
    const wrong = results.filter((r) => r.status === "rejected" && /incorrect/.test(r.reason.message));
    expect(wrong).toHaveLength(5);
    await expect(service.verifyPin("1234", "s-burst")).rejects.toThrow(/Trop de tentatives/);
  });

  it("un profil sensible n'ouvre une session qu'avec un PIN à 6 chiffres", async () => {
    const weak = bcrypt.hashSync("1234", 4);
    const strong = bcrypt.hashSync("123456", 4);
    const accounts: Record<string, any> = {
      admin4: { roleId: "admin", pin: weak, role: { permissions: "[]" } },
      chef6: { roleId: "chef", pin: strong, role: { permissions: '["caisse.close"]' } },
      serveur6: { roleId: "serveur", pin: strong, role: { permissions: '["salle.order"]' } },
    };
    const prisma: any = { staff: { findFirst: async ({ where }: any) => ({ id: where.id, name: where.id, ...accounts[where.id] }) } };
    const service = new AuthService(prisma, { log: async () => {} } as any);

    await expect(service.verifyPin("1234", "admin4")).rejects.toThrow("6 chiffres");
    await expect(service.verifyPin("123456", "serveur6")).rejects.toThrow("4 chiffres");
    expect((await service.verifyPin("123456", "chef6")).ok).toBe(true);
  });

  it("un bon PIN remet le compteur à zéro", async () => {
    const { service } = make(["s-ok"]);
    for (let i = 0; i < 4; i++) await expect(service.verifyPin("0000", "s-ok")).rejects.toThrow(/incorrect/);
    expect((await service.verifyPin("1234", "s-ok")).ok).toBe(true);
    await expect(service.verifyPin("0000", "s-ok")).rejects.toThrow(/incorrect/);
  });
});
