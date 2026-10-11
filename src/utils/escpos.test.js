import { describe, it, expect } from "vitest";
import { encodeCp1252, buildEscPosBinary } from "./escpos.js";

describe("Impression : encodage Windows-1252 (copie du serveur)", () => {
  it("encode accents, œ et € sur un octet, remplace l'inimprimable", () => {
    expect([...encodeCp1252("é à Bœuf 5€ 🍔")]).toEqual([0xe9, 0x20, 0xe0, 0x20, 0x42, 0x9c, 0x75, 0x66, 0x20, 0x35, 0x80, 0x20, 0x3f]);
  });

  it("sélectionne la table WPC1252 juste après l'initialisation", async () => {
    const bytes = new Uint8Array(await buildEscPosBinary("é", { autoCut: false }).arrayBuffer());
    expect(Array.from(bytes.subarray(0, 6))).toEqual([0x1b, 0x40, 0x1b, 0x74, 0x10, 0xe9]);
  });
});
