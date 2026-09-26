/**
 * Utilitaire de génération et d'export du Fichier des Écritures Comptables (FEC)
 * Norme légale française : Article A.47 A-1 du Livre des Procédures Fiscales (DGFiP)
 * Format : Délimiteur '|', encodage UTF-8 avec BOM optionnel, 18 champs obligatoires.
 */

export const DEFAULT_FEC_ACCOUNTS = {
  journalCode: "VT",
  accountVente10: "706000", // Prestations restauration (TVA 10%)
  accountVente20: "707000", // Ventes de boissons alcools (TVA 20%)
  accountVat10: "445710",   // TVA collectée 10%
  accountVat20: "445720",   // TVA collectée 20%
  accountCard: "512000",    // Banque Carte Bancaire
  accountCash: "530000",    // Caisse Espèces
  accountOther: "580000",   // Autres règlements / Virements internes
};

/**
 * Formate un nombre au format monétaire FEC (virgule décimale, 2 chiffres)
 */
export function formatFecAmount(num) {
  return Number(num || 0).toFixed(2).replace(".", ",");
}

/**
 * Formate une date au format FEC AAAAMMJJ
 */
export function formatFecDate(date) {
  const d = new Date(date || Date.now());
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

/**
 * Génère le contenu complet du FEC à partir d'une liste de tickets d'historique et des comptes configurés
 */
export function generateFecString(tickets = [], config = {}, customAccounts = {}) {
  const accounts = { ...DEFAULT_FEC_ACCOUNTS, ...customAccounts };
  const lines = [];

  // En-tête réglementaire 18 colonnes
  lines.push([
    "JournalCode",
    "JournalLib",
    "EcritureNum",
    "EcritureDate",
    "CompteNum",
    "CompteLib",
    "CompAuxNum",
    "CompAuxLib",
    "PieceRef",
    "PieceDate",
    "EcritureLib",
    "Debit",
    "Credit",
    "EcritureLet",
    "DateLet",
    "ValidDate",
    "Montantdevise",
    "Idevise",
  ].join("|"));

  let ecritureIndex = 1;
  let totalDebit = 0;
  let totalCredit = 0;

  for (const ticket of tickets) {
    const ecritureNum = `ECR${String(ecritureIndex).padStart(6, "0")}`;
    const dateFormatted = formatFecDate(ticket.createdAt);
    const pieceRef = ticket.ticketNumber || `FAC-${String(ticket.id).slice(-6).toUpperCase()}`;

    // 1. Débit des comptes de trésorerie (Règlements)
    let payments = [];
    if (ticket.payments) {
      payments = typeof ticket.payments === "string" ? JSON.parse(ticket.payments) : ticket.payments;
    }
    if (!payments || payments.length === 0) {
      payments = [{ method: ticket.paymentMethod || "carte", amount: ticket.total }];
    }

    for (const p of payments) {
      const amt = Number(p.amount || 0);
      if (amt <= 0) continue;

      let compteNum = accounts.accountCard;
      let compteLib = "Banque Carte Bancaire";
      if (p.method === "especes") {
        compteNum = accounts.accountCash;
        compteLib = "Caisse Espèces";
      } else if (p.method === "autre") {
        compteNum = accounts.accountOther;
        compteLib = "Autres règlements";
      }

      lines.push([
        accounts.journalCode,
        "Journal des Ventes",
        ecritureNum,
        dateFormatted,
        compteNum,
        compteLib,
        "",
        "",
        pieceRef,
        dateFormatted,
        `Encaissement ${pieceRef} (${p.method})`,
        formatFecAmount(amt),
        "0,00",
        "",
        "",
        dateFormatted,
        "",
        "",
      ].join("|"));

      totalDebit += amt;
    }

    // 2. Crédit Ventes HT & TVA collectée
    let vatRates = [];
    if (ticket.vatDetails) {
      const vatObj = typeof ticket.vatDetails === "string" ? JSON.parse(ticket.vatDetails) : ticket.vatDetails;
      vatRates = vatObj?.rates || [];
    }

    if (vatRates.length === 0) {
      const ht = Math.round((ticket.total / 1.1) * 100) / 100;
      const vat = Math.round((ticket.total - ht) * 100) / 100;
      vatRates = [{ rate: 10, ht, vat, ttc: ticket.total }];
    }

    for (const vr of vatRates) {
      const rate = Number(vr.rate);
      const ht = Number(vr.ht || 0);
      const vat = Number(vr.vat || 0);

      const compteVente = rate === 20 ? accounts.accountVente20 : accounts.accountVente10;
      const libVente = rate === 20 ? "Ventes boissons alcoolisées (20%)" : "Prestations de restauration (10%)";

      if (ht > 0) {
        lines.push([
          accounts.journalCode,
          "Journal des Ventes",
          ecritureNum,
          dateFormatted,
          compteVente,
          libVente,
          "",
          "",
          pieceRef,
          dateFormatted,
          `Vente ${pieceRef} HT (${rate}%)`,
          "0,00",
          formatFecAmount(ht),
          "",
          "",
          dateFormatted,
          "",
          "",
        ].join("|"));
        totalCredit += ht;
      }

      const compteTva = rate === 20 ? accounts.accountVat20 : accounts.accountVat10;
      const libTva = `TVA collectée (${rate}%)`;

      if (vat > 0) {
        lines.push([
          accounts.journalCode,
          "Journal des Ventes",
          ecritureNum,
          dateFormatted,
          compteTva,
          libTva,
          "",
          "",
          pieceRef,
          dateFormatted,
          `TVA ${pieceRef} (${rate}%)`,
          "0,00",
          formatFecAmount(vat),
          "",
          "",
          dateFormatted,
          "",
          "",
        ].join("|"));
        totalCredit += vat;
      }
    }

    ecritureIndex++;
  }

  const siret = (config.siret || "98765432100012").replace(/\s+/g, "");
  const today = formatFecDate(new Date());
  const fileName = `${siret}FEC${today}.txt`;

  return {
    fileName,
    content: lines.join("\r\n"),
    totalDebit: Math.round(totalDebit * 100) / 100,
    totalCredit: Math.round(totalCredit * 100) / 100,
    isBalanced: Math.abs(totalDebit - totalCredit) < 0.05,
    recordsCount: lines.length - 1,
    ticketsCount: tickets.length,
  };
}

/**
 * Télécharge un fichier texte (ex: FEC) dans le navigateur
 */
export function triggerFileDownload(content, fileName = "FEC.txt") {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
