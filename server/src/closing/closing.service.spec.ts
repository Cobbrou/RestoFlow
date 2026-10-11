import { describe, it, expect, vi } from "vitest";
import { ClosingService, ticketCovers } from "./closing.service";

describe("ticketCovers", () => {
  it("prend les couverts saisis, 1 par défaut, 0 pour un avoir", () => {
    expect(ticketCovers({ type: "SALE", covers: 4 })).toBe(4);
    expect(ticketCovers({ type: "SALE", covers: null })).toBe(1);
    expect(ticketCovers({ type: "SALE", covers: 0 })).toBe(0); // dernier ticket de convive, couverts déjà comptés
    expect(ticketCovers({ type: "CREDIT_NOTE", covers: 4 })).toBe(0);
  });
});

describe("ClosingService : garde-fous des clôtures", () => {
  const config: any = { getConfig: vi.fn().mockResolvedValue({}), getNf525Key: vi.fn().mockResolvedValue("k") };

  it("refuse le Z tant qu'une commande ouverte a des articles envoyés", async () => {
    const prisma: any = { order: { findMany: vi.fn().mockResolvedValue([{ table: { number: 7 } }]) } };
    const service = new ClosingService(prisma, config, {} as any);
    await expect(service.processZClosing({ closedBy: "Admin" })).rejects.toThrow("Table 7");
  });

  it("refuse un mois non terminé, puis un mois dont des tickets n'ont pas de Z", async () => {
    const prisma: any = {
      periodClosing: { findUnique: vi.fn().mockResolvedValue(null) },
      dailyClosing: { findMany: vi.fn().mockResolvedValue([]) },
      orderHistory: { count: vi.fn().mockResolvedValue(2) },
    };
    const service = new ClosingService(prisma, config, {} as any);
    const thisMonth = new Date().toISOString().slice(0, 7);
    await expect(service.closePeriod({ type: "MONTH", period: thisMonth, closedBy: "Admin" })).rejects.toThrow("pas terminée");
    await expect(service.closePeriod({ type: "MONTH", period: "2020-01", closedBy: "Admin" })).rejects.toThrow("sans Z");
  });

  it("refuse l'année tant qu'un mois actif n'est pas clôturé", async () => {
    const prisma: any = {
      periodClosing: { findUnique: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([{ period: "2020-01" }]) },
      dailyClosing: { findMany: vi.fn().mockResolvedValue([{ openedAt: new Date(2020, 0, 5) }, { openedAt: new Date(2020, 2, 5) }]) },
    };
    const service = new ClosingService(prisma, config, {} as any);
    await expect(service.closePeriod({ type: "YEAR", period: "2020", closedBy: "Admin" })).rejects.toThrow("2020-03");
  });
});

describe("ClosingService.generateFecExport", () => {
  it("équilibre l'écriture quand le règlement inclut un pourboire", async () => {
    const prisma: any = {
      orderHistory: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "h1",
            ticketNumber: "T-0001",
            type: "SALE",
            createdAt: new Date("2026-10-10T12:00:00"),
            total: 22,
            tip: 3,
            paymentMethod: "carte",
            payments: JSON.stringify([{ method: "carte", amount: 25 }]),
            vatDetails: JSON.stringify({ rates: [{ rate: 10, ht: 20, vat: 2 }] }),
          },
        ]),
      },
    };
    const config: any = { getConfig: vi.fn().mockResolvedValue({ siret: "98765432100012", fecExportConfig: null }) };
    const service = new ClosingService(prisma, config, {} as any);

    const fec = await service.generateFecExport();

    expect(fec.isBalanced).toBe(true);
    expect(fec.totalDebit).toBe(25);
    expect(fec.content).toContain("|468600|Pourboires à reverser|");
  });
});
