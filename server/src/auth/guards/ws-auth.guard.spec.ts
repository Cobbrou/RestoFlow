import { describe, it, expect, vi } from "vitest";
import { authenticateSocket, hasAnyPermission, permRooms, SENSITIVE } from "./ws-auth.guard";

describe("Diffusion selon les permissions", () => {
  const socketFor = (user: any) => {
    const rooms = new Set<string>(["sid", "perm:caisse.close"]);
    const client: any = {
      handshake: { auth: { token: "t" } },
      data: {},
      rooms,
      join: vi.fn((r: string | string[]) => [r].flat().forEach((x) => rooms.add(x))),
      leave: vi.fn((r: string) => rooms.delete(r)),
    };
    const auth: any = { verifyToken: vi.fn(() => user), refreshSession: vi.fn(async (u) => u) };
    return { client, rooms, auth };
  };

  it("un serveur rejoint les rooms de ses permissions, perd les anciennes", async () => {
    const { client, rooms, auth } = socketFor({ staffId: "s", roleId: "serveur", permissions: ["caisse.checkout"] });
    await authenticateSocket(client, auth);
    expect([...rooms].sort()).toEqual(["perm:caisse.checkout", "sid", "staff"]);
    // les tickets lui parviennent, pas les Z
    expect(permRooms(SENSITIVE.history).some((r) => rooms.has(r))).toBe(true);
    expect(permRooms(SENSITIVE.closings).some((r) => rooms.has(r))).toBe(false);
  });

  it("l'admin rejoint la room qui reçoit tout ; sans session, plus aucune room", async () => {
    const admin = socketFor({ staffId: "a", roleId: "admin", permissions: [] });
    await authenticateSocket(admin.client, admin.auth);
    expect(permRooms(SENSITIVE.staffContacts).some((r) => admin.rooms.has(r))).toBe(true);

    const anon = socketFor(null);
    await authenticateSocket(anon.client, anon.auth);
    expect([...anon.rooms]).toEqual(["sid"]);
  });

  it("hasAnyPermission : admin toujours, sinon une des permissions", () => {
    expect(hasAnyPermission({ roleId: "admin", permissions: [] } as any, SENSITIVE.closings)).toBe(true);
    expect(hasAnyPermission({ roleId: "cuisinier", permissions: ["cuisine.view"] } as any, SENSITIVE.history)).toBe(false);
    expect(hasAnyPermission(null, SENSITIVE.history)).toBe(false);
  });
});
