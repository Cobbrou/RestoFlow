import * as crypto from "crypto";

export const GENESIS_TICKET = "GENESIS_TICKET_RESTOFLOW";

/** Champs d'un ticket tels que stockés en base (les JSON sont signés tels quels, sans re-sérialisation) */
export interface SignedTicketFields {
  sequenceNumber: number;
  ticketNumber: string | null;
  createdAt: Date | string;
  total: number;
  subtotal: number | null;
  paymentMethod: string;
  previousHash: string | null;
  type: string;
  refTicketNumber: string | null;
  items: string;
  vatDetails: string | null;
  payments: string;
  discount: string | null;
}

/**
 * Signature HMAC NF525 d'un ticket : en-tête fiscal + empreinte SHA-256 du contenu
 * (lignes, ventilation TVA, règlements, remise). Toute altération d'un de ces champs casse la signature.
 */
export function signTicket(t: SignedTicketFields, secretKey: string): string {
  const contentHash = crypto
    .createHash("sha256")
    .update([t.items, t.vatDetails || "", t.payments, t.discount || ""].join("\u001f"))
    .digest("hex");
  const payload = [
    "v2",
    t.sequenceNumber,
    t.ticketNumber || "",
    new Date(t.createdAt).toISOString(),
    Number(t.total).toFixed(2),
    Number(t.subtotal ?? t.total).toFixed(2),
    t.paymentMethod || "",
    t.type,
    t.refTicketNumber || "",
    contentHash,
    t.previousHash || GENESIS_TICKET,
  ].join("|");
  return crypto.createHmac("sha256", secretKey).update(payload).digest("hex");
}
