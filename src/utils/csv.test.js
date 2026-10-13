import { describe, it, expect } from "vitest";
import { csvCell, csvRows } from "./csv.js";

describe("Export CSV", () => {
  it("neutralise un texte qui démarrerait une formule à l'ouverture dans Excel", () => {
    for (const text of ['=HYPERLINK("http://x","clic")', "+33 cmd", "-2+3", "@SUM(A1)", "\t=1", "\r=1"]) {
      expect(csvCell(text).startsWith(`"'`), text).toBe(true);
    }
  });

  it("garde les nombres négatifs, les guillemets doublés et les valeurs vides", () => {
    expect(csvCell("-3,50")).toBe('"-3,50"');
    expect(csvCell('Crème "fluide"')).toBe('"Crème ""fluide"""');
    expect(csvCell(undefined)).toBe('""');
    expect(csvRows([["a", 1], ["=b", null]])).toBe('"a";"1"\r\n"\'=b";""');
  });
});
