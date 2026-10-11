import { describe, it, expect } from "vitest";
import { assertCanGrant } from "./management.service";

describe("Équipe et rôles : pas d'escalade de droits", () => {
  const manager = { staffId: "s1", roleId: "manager", permissions: ["gestion.staff", "salle.order"] };

  it("un non-admin ne touche ni au rôle admin ni à des droits qu'il n'a pas", () => {
    expect(() => assertCanGrant(manager, "admin")).toThrow("administrateur");
    expect(() => assertCanGrant(manager, null, ["salle.order", "caisse.fec"])).toThrow("caisse.fec");
    expect(() => assertCanGrant(manager, "serveur", ["salle.order"])).not.toThrow();
  });

  it("l'admin peut tout attribuer", () => {
    expect(() => assertCanGrant({ staffId: "a", roleId: "admin", permissions: [] }, "admin", ["caisse.fec"])).not.toThrow();
  });
});
