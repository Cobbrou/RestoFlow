import { describe, it, expect } from "vitest";
import { encodeCp1252 } from "./printer.service";

describe("Impression : encodage Windows-1252", () => {
  it("encode accents, œ et € sur un octet, remplace l'inimprimable", () => {
    expect([...encodeCp1252("é à Bœuf 5€ 🍔")]).toEqual([0xe9, 0x20, 0xe0, 0x20, 0x42, 0x9c, 0x75, 0x66, 0x20, 0x35, 0x80, 0x20, 0x3f]);
    expect([...encodeCp1252("\x1b\x40")]).toEqual([0x1b, 0x40]);
  });
});
