import { describe, it, expect } from "vitest";
import { sha256Hex, calculateTicketSignature, verifyLocalHistoryChain } from "./securityChain.js";

describe("Conformité NF525 & Intégrité - securityChain", () => {
  it("calcule un hash SHA-256 standard de 64 caractères hexadécimaux", async () => {
    const hash = await sha256Hex("RESTOFLOW_TEST_DATA");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).toBe("f7051b847e658f451b4dda527f90c470a10a6d8d5aed85dd7ff79357648122d7");
  });

  it("génère une signature déterministe pour un ticket de caisse", async () => {
    const ticket = {
      sequenceNumber: 1,
      ticketNumber: "TK-20260927-001",
      createdAt: "2026-09-27T12:00:00.000Z",
      total: 35.5,
      subtotal: 35.5,
      paymentMethod: "carte",
    };
    const sig1 = await calculateTicketSignature(ticket, "GENESIS");
    const sig2 = await calculateTicketSignature(ticket, "GENESIS");

    expect(sig1).toBe(sig2);
    expect(sig1).toHaveLength(64);
  });

  it("détecte avec succès la rupture de chaînage en cas d'altération frauduleuse", async () => {
    const ticket1 = {
      sequenceNumber: 1,
      ticketNumber: "TK-001",
      createdAt: "2026-09-27T12:00:00.000Z",
      total: 20,
      paymentMethod: "especes",
      previousHash: "GENESIS_TICKET_RESTOFLOW",
    };
    const sig1 = await calculateTicketSignature(ticket1, "GENESIS_TICKET_RESTOFLOW");
    ticket1.signature = sig1;

    const ticket2 = {
      sequenceNumber: 2,
      ticketNumber: "TK-002",
      createdAt: "2026-09-27T12:05:00.000Z",
      total: 30,
      paymentMethod: "carte",
      previousHash: "FAUX_HASH_ALTERE", // Simulation de tentative d'insertion frauduleuse
    };
    const sig2 = await calculateTicketSignature(ticket2, "FAUX_HASH_ALTERE");
    ticket2.signature = sig2;

    const audit = await verifyLocalHistoryChain([ticket1, ticket2]);
    expect(audit.valid).toBe(false);
    expect(audit.anomalies).toHaveLength(1);
    expect(audit.anomalies[0].type).toBe("HASH_BREAK");
  });

  it("valide une chaîne intacte de tickets sans anomalies", async () => {
    const t1 = {
      sequenceNumber: 1,
      ticketNumber: "TK-001",
      createdAt: "2026-09-27T12:00:00.000Z",
      total: 20,
      paymentMethod: "carte",
      previousHash: "GENESIS_TICKET_RESTOFLOW",
    };
    t1.signature = await calculateTicketSignature(t1, "GENESIS_TICKET_RESTOFLOW");

    const t2 = {
      sequenceNumber: 2,
      ticketNumber: "TK-002",
      createdAt: "2026-09-27T12:05:00.000Z",
      total: 45,
      paymentMethod: "especes",
      previousHash: t1.signature,
    };
    t2.signature = await calculateTicketSignature(t2, t1.signature);

    const audit = await verifyLocalHistoryChain([t1, t2]);
    expect(audit.valid).toBe(true);
    expect(audit.anomalies).toHaveLength(0);
  });
});
