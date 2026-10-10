/**
 * Moteur ESC/POS & Générateur de tickets thermiques (80mm & 58mm)
 * Supporte :
 *  - Ticket de caisse client & duplicata commerçant
 *  - Bon de commande cuisine (KDS ticket papier)
 *  - Bon de commande bar (boissons & cafés)
 *  - Reçu bancaire TPE (carte bancaire)
 */

import { money, isOffPremise, orderLabel, formatPickup } from "./index.js";
import { calculateVatBreakdown } from "./vat.js";

// Constantes ESC/POS standards
export const ESC = 0x1b;
export const GS = 0x1d;

export const COMMANDS = {
  INIT: [ESC, 0x40], // Réinitialisation imprimante
  ALIGN_LEFT: [ESC, 0x61, 0x00],
  ALIGN_CENTER: [ESC, 0x61, 0x01],
  ALIGN_RIGHT: [ESC, 0x61, 0x02],
  BOLD_ON: [ESC, 0x45, 0x01],
  BOLD_OFF: [ESC, 0x45, 0x00],
  DOUBLE_SIZE_ON: [GS, 0x21, 0x11], // 2x hauteur & largeur
  DOUBLE_HEIGHT_ON: [GS, 0x21, 0x01],
  NORMAL_SIZE: [GS, 0x21, 0x00],
  FEED_LINE: [0x0a],
  CUT_FULL: [GS, 0x56, 0x00],
  CUT_PARTIAL: [GS, 0x56, 0x01],
  DRAWER_KICK: [ESC, 0x70, 0x00, 0x19, 0xfa], // Impulsion ouverture tiroir-caisse
  BEEP: [ESC, 0x42, 0x02, 0x02], // 2 bips sonores
};

/**
 * Formate une ligne avec texte à gauche et à droite aligné sur la largeur du rouleau
 */
export function formatRow(left, right, width = 42) {
  const l = String(left || "");
  const r = String(right || "");
  const availableSpace = width - r.length;
  if (l.length >= availableSpace) {
    return l.slice(0, availableSpace - 1) + " " + r;
  }
  const spaces = " ".repeat(width - l.length - r.length);
  return l + spaces + r;
}

export function formatCenter(text, width = 42) {
  const t = String(text || "").trim();
  if (t.length >= width) return t.slice(0, width);
  const leftPadding = Math.floor((width - t.length) / 2);
  const rightPadding = width - t.length - leftPadding;
  return " ".repeat(leftPadding) + t + " ".repeat(rightPadding);
}

export function formatSeparator(char = "-", width = 42) {
  return char.repeat(width);
}

/**
 * 1. GÉNÉRATION DU TICKET DE CAISSE CLIENT & PRO
 */
export function generateCustomerReceiptText(receipt = {}, config = {}, width = 42) {
  const lines = [];
  const brand = config.name || "RESTOFLOW BISTROT";
  const dateObj = new Date(receipt.paidAt || receipt.sentAt || receipt.createdAt || Date.now());

  // En-tête
  lines.push(formatCenter(brand.toUpperCase(), width));
  if (config.legalName && config.legalName !== config.name) {
    lines.push(formatCenter(config.legalName, width));
  }
  if (config.address) lines.push(formatCenter(config.address, width));
  if (config.city) lines.push(formatCenter(config.city, width));
  if (config.phone) lines.push(formatCenter(`Tél : ${config.phone}`, width));
  if (config.siret) lines.push(formatCenter(`SIRET : ${config.siret}`, width));
  if (config.vatNumber) lines.push(formatCenter(`TVA Intra : ${config.vatNumber}`, width));
  lines.push(formatSeparator("=", width));

  // Métadonnées
  const numTicket = receipt.ticketNumber || `FAC-${dateObj.getFullYear()}-${String(receipt.id || "0001").slice(-4).toUpperCase()}`;
  lines.push(formatRow(`FACTURE N° ${numTicket}`, "", width));
  lines.push(formatRow(`Date : ${dateObj.toLocaleDateString("fr-FR")}`, `${dateObj.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`, width));

  const tableDisplay = receipt.tableNumber ?? (receipt.table?.number || (receipt.tableId ? String(receipt.tableId).replace(/\D/g, "") : "Comptoir"));
  lines.push(formatRow(receipt.orderLabel || `Table : ${tableDisplay}`, `Serveur : ${receipt.server || "Service"}`, width));
  lines.push(formatSeparator("-", width));

  // Articles
  lines.push(formatRow("DÉSIGNATION", "TOTAL TTC", width));
  lines.push(formatSeparator("-", width));

  const items = receipt.items || [];
  for (const it of items) {
    const qty = it.qty || 1;
    const name = it.name || "Article";
    const lineTotal = money((it.price || 0) * qty);
    lines.push(formatRow(`${qty} x ${name}`, lineTotal, width));
    for (const opt of it.options ? it.options.split(/ [·|] /) : []) {
      lines.push(formatRow(`    ${opt}`, "", width));
    }
    if (qty > 1) {
      lines.push(formatRow(`    (${money(it.price || 0)} /u)`, "", width));
    }
  }

  lines.push(formatSeparator("-", width));

  // Sous-total et Remises
  const subtotal = receipt.subtotal != null ? receipt.subtotal : items.reduce((s, i) => s + (i.price || 0) * (i.qty || 1), 0);
  lines.push(formatRow("SOUS-TOTAL BRUT", money(subtotal), width));

  let discountAmount = 0;
  if (receipt.discount) {
    const disc = receipt.discount;
    if (disc.amount != null) discountAmount = disc.amount;
    else if (disc.type === "percent") discountAmount = Math.round(subtotal * (disc.value / 100) * 100) / 100;
    else discountAmount = Math.min(subtotal, disc.value || 0);

    const discLabel = disc.code ? `REMISE [${disc.code}]` : `REMISE (${disc.type === "percent" ? `-${disc.value}%` : `-${money(disc.value || 0)}`})`;
    lines.push(formatRow(discLabel, `-${money(discountAmount)}`, width));
    if (disc.reason) {
      lines.push(formatRow(`  Motif : ${disc.reason}`, "", width));
    }
  }

  const tipAmount = receipt.tip || 0;
  if (tipAmount > 0) {
    lines.push(formatRow("POURBOIRE (SERVICE)", money(tipAmount), width));
  }

  const computedTotal = Math.max(0, Math.round((subtotal - discountAmount + tipAmount) * 100) / 100);
  const total = receipt.total != null ? receipt.total : computedTotal;

  lines.push(formatSeparator("=", width));
  lines.push(formatRow("TOTAL TTC À PAYER", money(total), width));
  lines.push(formatSeparator("=", width));

  // Règlement(s)
  lines.push(formatRow("MODES DE RÈGLEMENT", "", width));
  const payments = receipt.payments && receipt.payments.length > 0 ? receipt.payments : [
    { label: receipt.paidAt ? "Règlement" : "À régler", amount: total, method: receipt.paymentMethod || "carte" },
  ];
  for (const p of payments) {
    const methodStr = p.method === "carte" ? "Carte Bancaire" : p.method === "especes" ? "Espèces" : p.method === "autre" ? "Autre" : (p.method || "En attente");
    lines.push(formatRow(`• ${p.label || "Part"} (${methodStr})`, money(p.amount != null ? p.amount : total), width));
  }

  // Ventilation TVA
  lines.push(formatSeparator("-", width));
  lines.push(formatCenter("VENTILATION FISCALE DE LA TVA", width));
  lines.push(formatRow("TAUX", "BASE HT | TVA | TTC", width));
  lines.push(formatSeparator(".", width));

  const vatBreakdown = receipt.vatDetails || calculateVatBreakdown(items, receipt.discount);
  const vatRates = vatBreakdown.rates || [];
  for (const vr of vatRates) {
    const rateLabel = `${vr.rate.toFixed(1)}%`;
    const detailStr = `${money(vr.ht)} | ${money(vr.vat)} | ${money(vr.ttc)}`;
    lines.push(formatRow(rateLabel, detailStr, width));
  }
  lines.push(formatSeparator(".", width));
  lines.push(formatRow("TOTAL HT", money(vatBreakdown.totalHT), width));
  lines.push(formatRow("TOTAL TVA", money(vatBreakdown.totalVAT), width));
  lines.push(formatSeparator("-", width));

  // Pied de ticket
  lines.push(formatCenter(config.footerNote || "Merci de votre visite ! À bientôt.", width));
  lines.push(formatCenter("Service et taxes compris", width));
  if (config.website) lines.push(formatCenter(config.website, width));

  return lines.join("\n");
}

/**
 * 2. GÉNÉRATION DU BON DE CUISINE (Bons chauds / froids)
 */
export function generateKitchenTicketText(order, table, width = 42) {
  const lines = [];
  const dateObj = new Date(order.sentAt || order.createdAt || Date.now());

  lines.push(formatSeparator("*", width));
  lines.push(formatCenter("--- BON CUISINE ---", width));
  lines.push(formatCenter(isOffPremise(order) ? orderLabel(order).toUpperCase() : `TABLE ${table?.number ?? order.tableId ?? "—"}`, width));
  if (order.pickupAt) lines.push(formatCenter(`RETRAIT ${formatPickup(order.pickupAt)}`, width));
  lines.push(formatSeparator("*", width));

  lines.push(formatRow(`Heure : ${dateObj.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`, table ? `Couverts : ${table.seats ?? 2}` : "", width));
  lines.push(formatRow(`Commande : #${(order.id || "").slice(-4).toUpperCase()}`, `Serveur : ${order.server || "Salle"}`, width));
  lines.push(formatSeparator("=", width));

  // Filtrer les articles qui vont en cuisine (hors boissons pures)
  const kitchenItems = (order.items || []).filter(
    (i) => i.cat !== "boissons" && i.status !== "draft"
  );

  if (kitchenItems.length === 0) {
    lines.push(formatCenter("[Aucun article cuisine]", width));
  } else {
    for (const it of kitchenItems) {
      lines.push(formatRow(`[ ] ${it.qty} x ${it.name.toUpperCase()}`, "", width));
      for (const opt of it.options ? it.options.split(/ [·|] /) : []) {
        lines.push(formatRow(`    >> ${opt.toUpperCase()}`, "", width));
      }
      if (it.notes) {
        lines.push(formatRow(`    >>> NOTE: ${it.notes.toUpperCase()}`, "", width));
      }
      if (it.allergens && it.allergens.length > 0) {
        const algs = Array.isArray(it.allergens) ? it.allergens.join(", ") : it.allergens;
        lines.push(formatRow(`    /!\\ ALLERGENES: ${algs}`, "", width));
      }
      if (it.composition && Array.isArray(it.composition)) {
        for (const c of it.composition) {
          lines.push(formatRow(`      + ${c.step}: ${c.name}`, "", width));
        }
      }
      lines.push("");
    }
  }

  lines.push(formatSeparator("-", width));
  lines.push(formatCenter("Fin de bon de préparation", width));

  return lines.join("\n");
}

/**
 * 3. GÉNÉRATION DU BON DE BAR (Boissons & Cafés)
 */
export function generateBarTicketText(order, table, width = 42) {
  const lines = [];
  const dateObj = new Date(order.sentAt || order.createdAt || Date.now());

  lines.push(formatSeparator("~", width));
  lines.push(formatCenter("--- BON BAR ---", width));
  lines.push(formatCenter(isOffPremise(order) ? orderLabel(order).toUpperCase() : `TABLE ${table?.number ?? order.tableId ?? "—"}`, width));
  if (order.pickupAt) lines.push(formatCenter(`RETRAIT ${formatPickup(order.pickupAt)}`, width));
  lines.push(formatSeparator("~", width));

  lines.push(formatRow(`Heure : ${dateObj.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`, `Serveur : ${order.server || "Salle"}`, width));
  lines.push(formatSeparator("-", width));

  const barItems = (order.items || []).filter(
    (i) => i.cat === "boissons" && i.status !== "draft"
  );

  if (barItems.length === 0) {
    lines.push(formatCenter("[Aucune boisson]", width));
  } else {
    for (const it of barItems) {
      lines.push(formatRow(`[ ] ${it.qty} x ${it.name}`, "", width));
      for (const opt of it.options ? it.options.split(/ [·|] /) : []) {
        lines.push(formatRow(`    > ${opt}`, "", width));
      }
      if (it.notes) {
        lines.push(formatRow(`    Note: ${it.notes}`, "", width));
      }
    }
  }

  lines.push(formatSeparator("-", width));
  return lines.join("\n");
}

/**
 * 4. GÉNÉRATION DU TICKET TPE (Reçu Carte Bancaire)
 */
export function generateTpeReceiptText(tpeData = {}, config = {}, width = 42) {
  const lines = [];
  const dateObj = new Date(tpeData?.timestamp || Date.now());
  const brand = config.name || "RESTOFLOW BISTROT";

  lines.push(formatCenter(brand.toUpperCase(), width));
  lines.push(formatCenter("CARTE BANCAIRE", width));
  lines.push(formatSeparator("-", width));

  lines.push(formatRow(`DATE: ${dateObj.toLocaleDateString("fr-FR")}`, `HEURE: ${dateObj.toLocaleTimeString("fr-FR")}`, width));
  lines.push(formatRow(`TPE ID: ${tpeData?.terminalId || "TPE-01"}`, `TRANSACTION: #${tpeData?.txNumber || "00124"}`, width));
  lines.push(formatRow("CONTRAT COMMERCANT:", config.siret ? config.siret.slice(0, 9) : "123456789", width));
  lines.push(formatSeparator("-", width));

  lines.push(formatRow("MODE:", tpeData?.isContactless ? "SANS CONTACT (NFC)" : "CB EMV (PUCE)", width));
  lines.push(formatRow("NUMERO DE CARTE:", tpeData?.maskedPan || "**** **** **** 5482", width));
  lines.push(formatRow("AUTORISATION:", tpeData?.authCode || "A98142", width));
  lines.push(formatRow("STATUT:", "PAIEMENT ACCEPTE", width));
  lines.push(formatSeparator("=", width));

  lines.push(formatRow("MONTANT TOTAL:", money(tpeData?.amount || 0), width));
  lines.push(formatSeparator("=", width));

  lines.push(formatCenter("TICKET CLIENT", width));
  lines.push(formatCenter("A CONSERVER", width));

  return lines.join("\n");
}

/**
 * 5. GÉNÉRATION DU RAPPORT X (Lecture intermédiaire de caisse)
 */
export function generateXReportText(xData = {}, config = {}, width = 42) {
  const lines = [];
  const brand = config.name || "RESTOFLOW BISTROT";
  const now = new Date(xData.generatedAt || Date.now());
  const opened = new Date(xData.openedAt || Date.now());

  lines.push(formatCenter(brand.toUpperCase(), width));
  if (config.siret) lines.push(formatCenter(`SIRET : ${config.siret}`, width));
  lines.push(formatSeparator("=", width));
  lines.push(formatCenter("--- RAPPORT X ---", width));
  lines.push(formatCenter("LECTURE INTERMÉDIAIRE DE CAISSE", width));
  lines.push(formatCenter("(SANS CLÔTURE DE SESSION)", width));
  lines.push(formatSeparator("=", width));

  lines.push(formatRow(`Émis le : ${now.toLocaleDateString("fr-FR")}`, `${now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`, width));
  lines.push(formatRow(`Session depuis :`, `${opened.toLocaleDateString("fr-FR")} ${opened.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`, width));
  if (xData.lastZReportNumber) {
    lines.push(formatRow("Dernier Z :", xData.lastZReportNumber, width));
  }
  lines.push(formatSeparator("-", width));

  // Totaux de session
  lines.push(formatRow("TOTAL BRUT TTC", money(xData.totalGross || 0), width));
  if (xData.totalDiscounts > 0) {
    lines.push(formatRow("TOTAL REMISES ACCORDÉES", `-${money(xData.totalDiscounts)}`, width));
  }
  lines.push(formatSeparator("=", width));
  lines.push(formatRow("TOTAL NET TTC", money(xData.totalNet || 0), width));
  lines.push(formatRow("TOTAL NET HT", money(xData.totalHT || 0), width));
  lines.push(formatRow("TOTAL TVA COLLECTÉE", money(xData.totalVAT || 0), width));
  if (xData.totalTips > 0) {
    lines.push(formatRow("POURBOIRES (NON IMPOSABLES)", money(xData.totalTips), width));
  }
  lines.push(formatSeparator("=", width));

  lines.push(formatRow(`Nombre de tickets émis :`, `${xData.ticketsCount || 0}`, width));
  lines.push(formatRow(`Nombre de couverts :`, `${xData.coversCount || 0}`, width));
  if (xData.ticketsCount > 0) {
    lines.push(formatRow(`Panier moyen / ticket :`, money(xData.averageTicket || 0), width));
  }

  // Règlements
  lines.push(formatSeparator("-", width));
  lines.push(formatCenter("MODES D'ENCAISSEMENT", width));
  const pb = xData.paymentsBreakdown || {};
  lines.push(formatRow("• Carte Bancaire :", money(pb.carte || 0), width));
  lines.push(formatRow("• Espèces :", money(pb.especes || 0), width));
  lines.push(formatRow("• Autre règlement :", money(pb.autre || 0), width));
  if (pb.partage) lines.push(formatRow("• Paiements partagés :", money(pb.partage || 0), width));

  // Ventilation TVA
  lines.push(formatSeparator("-", width));
  lines.push(formatCenter("VENTILATION FISCALE DE LA TVA", width));
  lines.push(formatRow("TAUX", "BASE HT | TVA | TTC", width));
  lines.push(formatSeparator(".", width));
  for (const vr of xData.vatBreakdown || []) {
    const rateLabel = `${Number(vr.rate).toFixed(1)}%`;
    const details = `${money(vr.ht)} | ${money(vr.vat)} | ${money(vr.ttc)}`;
    lines.push(formatRow(rateLabel, details, width));
  }

  // Grand Total
  lines.push(formatSeparator("=", width));
  lines.push(formatRow("GRAND TOTAL CUMULÉ (GT) :", money(xData.currentGrandTotal || 0), width));
  lines.push(formatSeparator("=", width));
  lines.push(formatCenter("FIN DE LECTURE DU RAPPORT X", width));

  return lines.join("\n");
}

/**
 * 6. GÉNÉRATION DU RAPPORT Z CERTIFIÉ (Clôture journalière inaltérable NF525)
 */
export function generateZReportText(zData = {}, config = {}, width = 42) {
  const lines = [];
  const brand = config.name || "RESTOFLOW BISTROT";
  const closed = new Date(zData.closedAt || Date.now());
  const opened = new Date(zData.openedAt || Date.now());

  lines.push(formatSeparator("*", width));
  lines.push(formatCenter(brand.toUpperCase(), width));
  if (config.legalName) lines.push(formatCenter(config.legalName, width));
  if (config.siret) lines.push(formatCenter(`SIRET : ${config.siret}`, width));
  if (config.vatNumber) lines.push(formatCenter(`N° TVA : ${config.vatNumber}`, width));
  lines.push(formatSeparator("=", width));
  lines.push(formatCenter("*** RAPPORT DE CLÔTURE Z ***", width));
  lines.push(formatCenter(`CLÔTURE N° : ${zData.reportNumber || "Z-0001"}`, width));
  lines.push(formatCenter("DOCUMENT FISCAL CERTIFIÉ INALTÉRABLE", width));
  lines.push(formatCenter("NORME NF525 / ART. 286 CGI", width));
  lines.push(formatSeparator("=", width));

  lines.push(formatRow(`Date clôture : ${closed.toLocaleDateString("fr-FR")}`, `${closed.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`, width));
  lines.push(formatRow(`Début session :`, `${opened.toLocaleDateString("fr-FR")} ${opened.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`, width));
  lines.push(formatRow(`Clôturé par :`, `${zData.closedBy || "Gérant"}`, width));
  lines.push(formatRow(`Tickets inclus :`, `${zData.ticketsCount || 0}`, width));
  lines.push(formatSeparator("-", width));

  // Chiffre d'Affaires
  lines.push(formatRow("CHIFFRE D'AFFAIRES BRUT TTC", money(zData.totalGross || 0), width));
  if (zData.totalDiscounts > 0) {
    lines.push(formatRow("TOTAL REMISES ACCORDÉES", `-${money(zData.totalDiscounts)}`, width));
  }
  lines.push(formatSeparator("=", width));
  lines.push(formatRow("CHIFFRE D'AFFAIRES NET TTC", money(zData.totalNet || 0), width));
  lines.push(formatRow("TOTAL NET HT", money(zData.totalHT || 0), width));
  lines.push(formatRow("TOTAL TVA COLLECTÉE", money(zData.totalVAT || 0), width));
  if (zData.totalTips > 0) {
    lines.push(formatRow("POURBOIRES (NON IMPOSABLES)", money(zData.totalTips), width));
  }
  lines.push(formatSeparator("=", width));

  // Grand Total Perpétuel Cumulé (GT)
  lines.push(formatRow("ANCIEN GRAND TOTAL (GT) :", money(zData.grandTotalBefore || 0), width));
  lines.push(formatRow("NOUVEAU GRAND TOTAL (GT) :", money(zData.grandTotal || 0), width));
  lines.push(formatSeparator("-", width));

  // Modes de paiement
  lines.push(formatCenter("VENTILATION DES ENCAISSEMENTS", width));
  const pb = zData.paymentsBreakdown || {};
  lines.push(formatRow("• Carte Bancaire :", money(pb.carte || 0), width));
  lines.push(formatRow("• Espèces en caisse :", money(pb.especes || 0), width));
  lines.push(formatRow("• Autres règlements :", money(pb.autre || 0), width));

  // Contrôle de caisse & écart
  if (zData.countedCash != null) {
    lines.push(formatSeparator("-", width));
    lines.push(formatCenter("CONTRÔLE DE CAISSE PHYSIQUE", width));
    lines.push(formatRow("Fond de caisse départ :", money(zData.openingCash || 0), width));
    const theo = (zData.openingCash || 0) + (pb.especes || 0);
    lines.push(formatRow("Espèces théoriques :", money(theo), width));
    lines.push(formatRow("Espèces réelles comptées :", money(zData.countedCash), width));
    const variance = zData.cashVariance || 0;
    const varLabel = variance === 0 ? "ÉCART NUL (CONFORME)" : variance > 0 ? "EXCÉDENT DE CAISSE" : "DÉFICIT DE CAISSE";
    lines.push(formatRow(`Écart (${varLabel}) :`, money(variance), width));
  }

  // Ventilation TVA
  lines.push(formatSeparator("-", width));
  lines.push(formatCenter("VENTILATION FISCALE DE LA TVA", width));
  lines.push(formatRow("TAUX", "BASE HT | TVA | TTC", width));
  lines.push(formatSeparator(".", width));
  for (const vr of zData.vatBreakdown || []) {
    const rateLabel = `${Number(vr.rate).toFixed(1)}%`;
    const details = `${money(vr.ht)} | ${money(vr.vat)} | ${money(vr.ttc)}`;
    lines.push(formatRow(rateLabel, details, width));
  }

  // Empreinte de scellement cryptographique
  lines.push(formatSeparator("=", width));
  lines.push(formatCenter("SCELLEMENT NUMÉRIQUE NF525", width));
  if (zData.signature) {
    lines.push(formatRow("SIGNATURE SHA-256 :", "", width));
    lines.push(formatCenter(zData.signature.slice(0, 32), width));
    if (zData.signature.length > 32) {
      lines.push(formatCenter(zData.signature.slice(32), width));
    }
  }
  if (zData.previousHash) {
    lines.push(formatRow("HASH PRÉCÉDENT :", `${zData.previousHash.slice(0, 16)}...`, width));
  }
  lines.push(formatSeparator("*", width));
  lines.push(formatCenter("*** FIN DE RAPPORT Z - ARCHIVÉ ***", width));

  return lines.join("\n");
}

/**
 * Crée un Blob binaire ESC/POS téléchargeable ou injectable vers un port d'imprimante
 */
export function buildEscPosBinary(text, options = {}) {
  const encoder = new TextEncoder();
  const chunks = [];

  // Init
  chunks.push(new Uint8Array(COMMANDS.INIT));

  if (options.beep) {
    chunks.push(new Uint8Array(COMMANDS.BEEP));
  }

  if (options.openDrawer) {
    chunks.push(new Uint8Array(COMMANDS.DRAWER_KICK));
  }

  // Encodage du texte brut
  const textBytes = encoder.encode(text + "\n\n\n");
  chunks.push(textBytes);

  // Coupe
  if (options.autoCut !== false) {
    chunks.push(new Uint8Array(COMMANDS.CUT_PARTIAL));
  }

  // Fusionner les tableaux
  const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return new Blob([result], { type: "application/octet-stream" });
}
