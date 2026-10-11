import { describe, it, expect, vi } from "vitest";
import { ClosingService, ticketCovers } from "./closing.service";

describe("ticketCovers", () => {
  it("prend les couverts saisis, 1 par défaut, 0 pour un avoir", () => {
    expect(ticketCovers({ type: "SALE", covers: 4 })).toBe(4);
    expect(ticketCovers({ type: "SALE", covers: null })).toBe(1);
    expect(ticketCovers({ type: "CREDIT_NOTE", covers: 4 })).toBe(0);
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
