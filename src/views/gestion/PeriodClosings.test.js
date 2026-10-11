import { describe, it, expect } from "vitest";
import { periodLabel, previousPeriods } from "./PeriodClosings.jsx";

describe("clôtures périodiques (client)", () => {
  it("mois écoulé en janvier = décembre de l'année précédente", () => {
    expect(previousPeriods(new Date(2027, 0, 15))).toEqual({ month: "2026-12", year: "2026" });
    expect(previousPeriods(new Date(2026, 9, 11))).toEqual({ month: "2026-09", year: "2025" });
    expect(periodLabel("MONTH", "2026-10")).toBe("octobre 2026");
  });
});
