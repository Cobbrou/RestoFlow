import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./db.js", () => ({
  getOfflineActionsFromDB: vi.fn().mockResolvedValue([]),
  saveOfflineActionToDB: vi.fn().mockResolvedValue(),
  removeOfflineActionFromDB: vi.fn().mockResolvedValue(),
  updateOfflineActionInDB: vi.fn().mockResolvedValue(),
  clearOfflineActionsFromDB: vi.fn().mockResolvedValue(),
}));

const q = await import("./actionQueue.js");

/** Faux socket : `reply(type, payload)` décide de la réponse (objet = ack, "exception:<msg>", "silence") */
function fakeSocket(reply) {
  const listeners = {};
  const sent = [];
  return {
    connected: true,
    sent,
    on: (ev, cb) => (listeners[ev] = cb),
    off: (ev) => delete listeners[ev],
    emit(type, payload, ack) {
      sent.push({ type, payload });
      const r = reply(type, payload);
      if (r === "silence") return;
      if (typeof r === "string" && r.startsWith("exception:")) return listeners.exception?.({ message: r.slice(10) });
      ack(r);
    },
  };
}

describe("actionQueue (file hors-ligne)", () => {
  beforeEach(async () => {
    await q.clearQueue();
  });

  it("rejoue dans l'ordre avec clientActionId et vide la file", async () => {
    q.enqueueAction("order:create_or_ensure", { orderId: "o1" });
    q.enqueueAction("order:add_item", { orderId: "o1" });
    const socket = fakeSocket(() => ({ ok: true }));
    const res = await q.flushQueue(socket);
    expect(res).toEqual({ flushed: 2, rejected: 0, remaining: 0 });
    expect(socket.sent.map((s) => s.type)).toEqual(["order:create_or_ensure", "order:add_item"]);
    expect(socket.sent[0].payload.clientActionId).toMatch(/^act_/);
  });

  it("conserve une action refusée et continue avec les suivantes", async () => {
    q.enqueueAction("order:checkout", { orderId: "o1" });
    q.enqueueAction("reservation:create", {});
    const socket = fakeSocket((type) => (type === "order:checkout" ? { ok: false, error: "déjà encaissée" } : { ok: true }));
    const res = await q.flushQueue(socket);
    expect(res).toEqual({ flushed: 1, rejected: 1, remaining: 1 });
    expect(q.hasPendingActions()).toBe(false);
  });

  it("droits insuffisants = refus ; session expirée = action gardée en attente", async () => {
    q.enqueueAction("closing:process_z", {});
    let res = await q.flushQueue(fakeSocket(() => "exception:Droits insuffisants"));
    expect(res.rejected).toBe(1);

    await q.clearQueue();
    q.enqueueAction("order:add_item", {});
    res = await q.flushQueue(fakeSocket(() => "exception:Session invalide ou expirée"));
    expect(res).toEqual({ flushed: 0, rejected: 0, remaining: 1 });
    expect(q.hasPendingActions()).toBe(true);
  });

  it("sans acquittement : s'arrête sans rien perdre, puis rejoue avec le même id", async () => {
    vi.useFakeTimers();
    const id = q.enqueueAction("order:add_item", {}).id;
    q.enqueueAction("order:send_kitchen", {});
    const pending = q.flushQueue(fakeSocket(() => "silence"));
    await vi.advanceTimersByTimeAsync(9000);
    expect(await pending).toEqual({ flushed: 0, rejected: 0, remaining: 2 });
    vi.useRealTimers();

    const socket = fakeSocket(() => ({ ok: true }));
    await q.flushQueue(socket);
    expect(socket.sent[0].payload.clientActionId).toBe(id);
  });

  it("n'enfile pas deux fois le même id", () => {
    q.enqueueAction("order:add_item", {}, "act_same_id_1");
    expect(q.enqueueAction("order:add_item", {}, "act_same_id_1")).toBeNull();
  });
});
