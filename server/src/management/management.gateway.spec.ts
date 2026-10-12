import { describe, it, expect, vi } from "vitest";
import { ManagementGateway } from "./management.gateway";
import { SESSION_MS } from "../auth/auth.service";

describe("ManagementGateway shift:clock", () => {
  const make = (permissions: string[]) => {
    const management: any = { clock: vi.fn().mockResolvedValue(null), listOpenShifts: vi.fn().mockResolvedValue([]) };
    const gateway = new ManagementGateway(management, { log: vi.fn() } as any, {} as any);
    gateway.server = { to: () => ({ emit: vi.fn() }) } as any;
    const start = Date.now() - 3600000;
    const client: any = { data: { user: { staffId: "s1", name: "Léa", roleId: "serveur", permissions, exp: start + SESSION_MS } } };
    return { management, gateway, client, start };
  };

  it("refuse de pointer un collègue, sauf gestionnaire ou rejeu d'avant la session", async () => {
    const { management, gateway, client, start } = make(["salle.view"]);
    expect(await gateway.clock(client, { staffId: "s2", action: "in", at: Date.now() })).toMatchObject({ ok: false });
    expect(management.clock).not.toHaveBeenCalled();

    expect(await gateway.clock(client, { staffId: "s1", action: "in" })).toMatchObject({ ok: true });
    expect(await gateway.clock(client, { staffId: "s2", action: "out", at: start - 60000 })).toMatchObject({ ok: true });

    const manager = make(["gestion.staff"]);
    expect(await manager.gateway.clock(manager.client, { staffId: "s2", action: "in", at: Date.now() })).toMatchObject({ ok: true });
  });
});
