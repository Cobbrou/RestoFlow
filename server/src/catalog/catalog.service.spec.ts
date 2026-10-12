import { describe, it, expect } from "vitest";
import { normalizeHours } from "./catalog.service";

describe("normalizeHours", () => {
  it("normalise les créneaux et accepte une fin après minuit", () => {
    expect(normalizeHours(" 11h30-14:30 ; 9:00-10:00,22:00-02:00 ")).toBe("11:30-14:30, 09:00-10:00, 22:00-02:00");
    expect(normalizeHours("")).toBeNull();
    expect(normalizeHours(null)).toBeNull();
  });

  it("refuse un format invalide", () => {
    for (const bad of ["midi", "11:30", "11:30-25:00", "12:00-12:00", "8-9-10"]) {
      expect(() => normalizeHours(bad)).toThrow(/Créneau horaire invalide/);
    }
  });
});
