/**
 * Module de chaînage cryptographique & conformité fiscale (Loi anti-fraude TVA / NF525)
 * Utilise la Web Crypto API native du navigateur (SHA-256).
 */

/**
 * Calcule une empreinte SHA-256 hexadécimale à partir d'une chaîne de caractères.
 */
export async function sha256Hex(text) {
  const msgUint8 = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Calcule la signature d'un ticket de caisse selon les spécifications d'intégrité NF525
 */
export async function calculateTicketSignature(ticket, previousHash = "GENESIS_TICKET_RESTOFLOW") {
  const isoDate = new Date(ticket.createdAt || Date.now()).toISOString();
  const payload = [
    ticket.sequenceNumber || 1,
    ticket.ticketNumber || ticket.id,
    isoDate,
    Number(ticket.total || 0).toFixed(2),
    Number(ticket.subtotal || ticket.total || 0).toFixed(2),
    ticket.paymentMethod || "carte",
    previousHash,
  ].join("|");

  return await sha256Hex(payload);
}

/**
 * Calcule la signature d'un rapport Z de clôture journalière
 */
export async function calculateClosingSignature(closing, previousHash = "GENESIS_Z_RESTOFLOW") {
  const payload = [
    closing.sequenceNumber || 1,
    closing.reportNumber || "Z-0001",
    new Date(closing.openedAt || Date.now()).toISOString(),
    new Date(closing.closedAt || Date.now()).toISOString(),
    closing.closedBy || "Admin",
    Number(closing.totalGross || 0).toFixed(2),
    Number(closing.totalDiscounts || 0).toFixed(2),
    Number(closing.totalNet || 0).toFixed(2),
    Number(closing.totalHT || 0).toFixed(2),
    Number(closing.totalVAT || 0).toFixed(2),
    closing.ticketsCount || 0,
    Number(closing.grandTotalBefore || 0).toFixed(2),
    Number(closing.grandTotal || 0).toFixed(2),
    previousHash,
  ].join("|");

  return await sha256Hex(payload);
}

/**
 * Diagnostic local d'intégrité de la chaîne fiscale des encaissements
 */
export async function verifyLocalHistoryChain(historyList = []) {
  const sorted = [...historyList].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const anomalies = [];
  let previousHash = "GENESIS_TICKET_RESTOFLOW";

  for (let i = 0; i < sorted.length; i++) {
    const item = sorted[i];
    if (item.sequenceNumber != null) {
      if (item.previousHash && item.previousHash !== previousHash) {
        anomalies.push({
          type: "HASH_BREAK",
          ticket: item.ticketNumber || item.id,
          message: `Rupture de chaînage au ticket #${item.ticketNumber || item.id}`,
        });
      }
      previousHash = item.signature || (await calculateTicketSignature(item, previousHash));
    }
  }

  return {
    valid: anomalies.length === 0,
    anomalies,
    count: sorted.length,
    lastHash: previousHash,
  };
}
