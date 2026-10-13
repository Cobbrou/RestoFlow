import { describe, it, expect, vi, afterEach } from "vitest";
import { ManagementGateway } from "./management.gateway";
import { AuthService, REPLAY_GRACE_MS, SESSION_MS } from "../auth/auth.service";

describe("ManagementGateway shift:clock", () => {
  const auth = new AuthService({} as any, {} as any);
  const tokenOf = (staffId: string, issuedAt = Date.now()) => {
    vi.spyOn(Date, "now").mockReturnValueOnce(issuedAt);
    return auth.generateToken({ id: staffId, name: staffId, roleId: "serveur", permissions: [] });
  };
  const make = (permissions: string[]) => {
    const management: any = { clock: vi.fn().mockResolvedValue(null), listOpenShifts: vi.fn().mockResolvedValue([]) };
    const gateway = new ManagementGateway(management, { log: vi.fn() } as any, auth);
    gateway.server = { to: () => ({ emit: vi.fn() }) } as any;
    const client: any = { data: { user: { staffId: "s1", name: "Léa", roleId: "serveur", permissions, exp: Date.now() + SESSION_MS } } };
    return { management, gateway, client };
  };

  afterEach(() => vi.restoreAllMocks());

  it("chacun pointe pour soi, le gestionnaire pour tous", async () => {
    const { management, gateway, client } = make(["salle.view"]);
    expect(await gateway.clock(client, { staffId: "s1", action: "in" })).toMatchObject({ ok: true });
    expect(management.clock).toHaveBeenCalledWith({ staffId: "s1", action: "in" });

    const manager = make(["gestion.staff"]);
    expect(await manager.gateway.clock(manager.client, { staffId: "s2", action: "in", at: Date.now() })).toMatchObject({ ok: true });
  });

  it("refuse de pointer un collègue sans son jeton, quelle que soit l'heure annoncée", async () => {
    const { management, gateway, client } = make(["salle.view"]);
    for (const at of [Date.now(), 1, Date.now() - SESSION_MS - 60000]) {
      expect(await gateway.clock(client, { staffId: "s2", action: "out", at })).toMatchObject({ ok: false });
    }
    expect(await gateway.clock(client, { staffId: "s2", action: "out", operatorToken: tokenOf("s1") })).toMatchObject({ ok: false });
    expect(await gateway.clock(client, { staffId: "s2", action: "out", operatorToken: `${tokenOf("s2")}x` })).toMatchObject({ ok: false });
    const tooOld = tokenOf("s2", Date.now() - SESSION_MS - REPLAY_GRACE_MS - 60000);
    expect(await gateway.clock(client, { staffId: "s2", action: "out", operatorToken: tooOld })).toMatchObject({ ok: false });
    expect(management.clock).not.toHaveBeenCalled();
  });

  it("accepte le rejeu d'un pointage portant le jeton du collègue, même expiré depuis peu", async () => {
    const { management, gateway, client } = make(["salle.view"]);
    const expired = tokenOf("s2", Date.now() - SESSION_MS - 3600000);
    expect(await gateway.clock(client, { staffId: "s2", action: "out", at: 5, operatorToken: expired })).toMatchObject({ ok: true });
    expect(management.clock).toHaveBeenCalledWith({ staffId: "s2", action: "out", at: 5 });
  });
});
