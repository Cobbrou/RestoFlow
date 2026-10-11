import { describe, it, expect } from "vitest";
import { refundableLines } from "./refund.js";

describe("refundableLines", () => {
  it("déduit les avoirs déjà émis, ligne par ligne", () => {
    const ticket = { items: [{ id: "a", name: "Plat", price: 20, qty: 2 }, { id: "b", name: "Vin", price: 6, qty: 1 }] };
    const notes = [{ items: [{ refKey: "a", qty: -1 }] }, { items: [{ id: "b", qty: -1 }] }];
    expect(refundableLines(ticket, notes).map((l) => [l.key, l.remaining])).toEqual([["a", 1], ["b", 0]]);
  });
});
