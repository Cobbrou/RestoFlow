import { describe, it, expect } from "vitest";
import { jsonField } from "./config.service";

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
