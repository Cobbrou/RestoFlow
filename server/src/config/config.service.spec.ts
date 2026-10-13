import { describe, it, expect, vi } from "vitest";
import { assertPrinters, ConfigService, jsonField } from "./config.service";

describe("Configuration : champs JSON validés avant écriture", () => {
  it("accepte objet, liste ou texte JSON de la bonne forme", () => {
    expect(jsonField("printers", [{ ip: "10.0.0.5" }], "array")).toBe('[{"ip":"10.0.0.5"}]');
    expect(jsonField("modulesConfig", '{"enableTips":true}', "object")).toBe('{"enableTips":true}');
  });

  it("refuse un texte illisible ou une mauvaise forme (sinon getConfig planterait pour tous les postes)", () => {
    expect(() => jsonField("printers", "[{oups", "array")).toThrow("JSON invalide");
    expect(() => jsonField("printers", { ip: "x" }, "array")).toThrow("liste");
    expect(() => jsonField("happyHourConfig", null, "object")).toThrow("objet");
  });
});

describe("Configuration : imprimantes réseau", () => {
  it("refuse une imprimante pointant vers la machine elle-même ou un nom d'hôte", () => {
    expect(() => assertPrinters([{ ip: "127.0.0.1", port: 2019 }])).toThrow(/non autorisée/);
    expect(() => assertPrinters([{ ip: "localhost" }])).toThrow(/invalide/);
    expect(() => assertPrinters([{ ip: "192.168.1.50", port: 0 }])).toThrow(/Port/);
  });

  it("accepte les imprimantes du LAN et celles sans IP (USB)", () => {
    expect(() => assertPrinters([{ ip: "192.168.1.50" }, { ip: "192.168.1.51", port: 9101 }, { name: "USB" }, { ip: "" }])).not.toThrow();
  });

  it("valide les imprimantes avant toute écriture", async () => {
    const prisma: any = {
      restaurantConfig: { findUnique: async () => ({ id: "default", printers: "[]", promoCodes: "[]" }), update: vi.fn() },
    };
    await expect(new ConfigService(prisma).updateConfig({ printers: [{ ip: "127.0.0.1" }] })).rejects.toThrow(/non autorisée/);
    expect(prisma.restaurantConfig.update).not.toHaveBeenCalled();
  });
});
