import { describe, it, expect } from "vitest";
import { encodeCp1252, printerAddressError, PrinterService } from "./printer.service";

describe("Impression : encodage Windows-1252", () => {
  it("encode accents, œ et € sur un octet, remplace l'inimprimable", () => {
    expect([...encodeCp1252("é à Bœuf 5€ 🍔")]).toEqual([0xe9, 0x20, 0xe0, 0x20, 0x42, 0x9c, 0x75, 0x66, 0x20, 0x35, 0x80, 0x20, 0x3f]);
    expect([...encodeCp1252("\x1b\x40")]).toEqual([0x1b, 0x40]);
  });
});

describe("Impression : adresses joignables", () => {
  it("accepte une IP littérale du LAN et un port TCP valide", () => {
    expect(printerAddressError("192.168.1.50")).toBeNull();
    expect(printerAddressError("10.0.0.5", "9100")).toBeNull();
    expect(printerAddressError("fd00::12", 9101)).toBeNull();
  });

  it("refuse la machine elle-même, le lien local, un nom d'hôte et un port invalide", () => {
    for (const ip of ["127.0.0.1", "127.1.2.3", "0.0.0.0", "169.254.169.254", "::1", "0:0:0:0:0:0:0:1", "::", "fe80::1", "::ffff:127.0.0.1"]) {
      expect(printerAddressError(ip), ip).toMatch(/non autorisée/);
    }
    for (const ip of ["localhost", "imprimante.local", "", null, { not: "" }]) {
      expect(printerAddressError(ip), String(ip)).toMatch(/invalide/);
    }
    expect(printerAddressError("192.168.1.50", 2019.5)).toMatch(/Port/);
    expect(printerAddressError("192.168.1.50", 70000)).toMatch(/Port/);
  });

  it("n'ouvre aucune connexion vers une adresse refusée", async () => {
    const service = new PrinterService();
    expect(await service.sendRaw("127.0.0.1", 2019, Buffer.from("POST /load"))).toMatchObject({ success: false });
    expect(await service.testPrinter("localhost", 9100)).toMatchObject({ success: false });
  });
});
