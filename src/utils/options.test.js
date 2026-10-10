import { describe, it, expect } from "vitest";
import { parseOptionsText, formatOptionsText, resolveOptions, resolveMenuOptions } from "./index.js";

const text = "Cuisson* : Bleu, Saignant, À point\nSuppléments (max 2) : Bacon +2, Œuf +1,5 €, Cheddar";

describe("options produit (saisie back-office)", () => {
  it("lit la mini-syntaxe", () => {
    expect(parseOptionsText(text)).toEqual([
      { name: "Cuisson", required: true, max: 1, choices: [{ label: "Bleu", price: 0 }, { label: "Saignant", price: 0 }, { label: "À point", price: 0 }] },
      { name: "Suppléments", required: false, max: 2, choices: [{ label: "Bacon", price: 2 }, { label: "Œuf", price: 1.5 }, { label: "Cheddar", price: 0 }] },
    ]);
  });

  it("relit ce qu'elle écrit et ignore les lignes invalides", () => {
    const groups = parseOptionsText(text + "\nligne sans deux-points\n");
    expect(parseOptionsText(formatOptionsText(groups))).toEqual(groups);
  });

  it("même libellé et supplément que le serveur", () => {
    const r = resolveOptions(parseOptionsText(text), [
      { group: "Suppléments", choice: "Œuf" },
      { group: "Cuisson", choice: "Saignant" },
      { group: "Suppléments", choice: "Bacon" },
    ]);
    expect(r).toEqual({ label: "Saignant · Bacon (+2.00€) · Œuf (+1.50€)", extra: 3.5 });
  });

  it("menu : options par composant, supplément cumulé", () => {
    const products = [{ id: "b", name: "Burger", options: parseOptionsText(text) }, { id: "f", name: "Frites" }];
    const r = resolveMenuOptions(
      [{ title: "Plat", productIds: ["b"], options: [[{ group: "Cuisson", choice: "Bleu" }, { group: "Suppléments", choice: "Bacon" }]] },
       { title: "Accompagnement", productIds: ["f"], options: [[]] }],
      products
    );
    expect(r).toEqual({ label: "Burger : Bleu · Bacon (+2.00€)", extra: 2 });
  });
});

describe("heldToRelease (copie client)", () => {
  it("burger seul : envoi direct ; avec entrée : réclame", async () => {
    const { heldToRelease } = await import("./index.js");
    const plat = { id: "p", course: "plat", status: "draft", courseStatus: "held" };
    expect(heldToRelease([plat], true)).toEqual(["p"]);
    expect(heldToRelease([{ id: "e", course: "entree", status: "draft", courseStatus: "direct" }, plat], true)).toEqual([]);
  });
});
