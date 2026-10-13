import { useState, useMemo } from "react";
import {
  Printer,
  Download,
  Copy,
  Check,
  X,
  FileText,
  UtensilsCrossed,
  Coffee,
  CreditCard,
  Wifi,
  Loader2,
} from "lucide-react";
import { Dialog } from "./Modal.jsx";
import {
  generateCustomerReceiptText,
  generateKitchenTicketText,
  generateBarTicketText,
  generateTpeReceiptText,
  buildEscPosBinary,
} from "../utils/escpos.js";
import { isOffPremise, orderLabel } from "../utils/index.js";
import { getSocket } from "../services/socket.js";

/**
 * ThermalReceiptPreview — Simulateur d'impression thermique professionnel ESC/POS
 * 
 * Permet de visualiser le ticket physique comme sur une imprimante thermique
 * de caisse (80mm) ou bar (58mm), avec impression directe et export binaire ESC/POS.
 */
export default function ThermalReceiptPreview({
  receipt,
  order,
  table,
  tpeData,
  config = {},
  defaultTab = "caisse",
  onClose,
}) {
  const [activeTab, setActiveTab] = useState(defaultTab); // "caisse" | "cuisine" | "bar" | "tpe"
  const [paperWidth, setPaperWidth] = useState("80mm"); // "80mm" (42 col) | "58mm" (32 col)
  const [copied, setCopied] = useState(false);
  const [directPrinting, setDirectPrinting] = useState(false);
  const [directPrintStatus, setDirectPrintStatus] = useState(null);

  const columnWidth = paperWidth === "80mm" ? 42 : 32;

  // Données de commande pour cuisine / bar
  const activeOrder = order || {
    id: receipt?.orderId || "ord_preview",
    tableId: receipt?.tableNumber ? `tbl_${receipt.tableNumber}` : "tbl_1",
    server: receipt?.server || "Salle",
    sentAt: receipt?.paidAt || Date.now(),
    items: receipt?.items || [],
    discount: receipt?.discount || null,
  };

  // Hors salle : aucune table, le libellé (Emporter #12…) la remplace
  const offPremise = isOffPremise(order) || !!receipt?.orderLabel;
  const activeTable = table || (offPremise ? null : {
    number: receipt?.tableNumber ?? (activeOrder.tableId ? String(activeOrder.tableId).replace(/\D/g, "") : 1),
    seats: 2,
  });

  // Données prêtes pour le ticket de caisse (facture) même si la commande est en cours
  const customerReceiptData = useMemo(() => {
    if (receipt) return receipt;
    const items = activeOrder.items || [];
    const subtotal = items.reduce((s, i) => s + (i.price || 0) * (i.qty || 1), 0);
    let discountAmount = 0;
    if (activeOrder.discount) {
      const disc = activeOrder.discount;
      if (disc.amount != null) discountAmount = disc.amount;
      else if (disc.type === "percent") discountAmount = Math.round(subtotal * (disc.value / 100) * 100) / 100;
      else discountAmount = Math.min(subtotal, disc.value || 0);
    }
    const tipAmount = receipt?.tip || activeOrder.tip || 0;
    const total = Math.max(0, Math.round((subtotal - discountAmount + tipAmount) * 100) / 100);

    return {
      ...activeOrder,
      tableNumber: activeTable?.number ?? null,
      orderLabel: offPremise ? orderLabel(activeOrder) : null,
      subtotal,
      total,
      tip: tipAmount,
      discount: activeOrder.discount,
      paidAt: null,
    };
  }, [receipt, activeOrder, activeTable]);

  // Contenu texte formatté selon l'onglet
  const currentTicketText = useMemo(() => {
    try {
      switch (activeTab) {
        case "caisse":
          return generateCustomerReceiptText(customerReceiptData, config, columnWidth);
        case "cuisine":
          return generateKitchenTicketText(activeOrder, activeTable, columnWidth);
        case "bar":
          return generateBarTicketText(activeOrder, activeTable, columnWidth);
        case "tpe":
          return generateTpeReceiptText(
            tpeData || {
              amount: customerReceiptData.total || 25,
              maskedPan: "**** **** **** 8812",
              authCode: "AUTH9921",
              txNumber: "00045",
              isContactless: true,
              timestamp: receipt?.paidAt || Date.now(),
            },
            config,
            columnWidth
          );
        default:
          return "";
      }
    } catch (err) {
      console.error("Erreur génération ticket thermique:", err);
      return `[Erreur lors de la génération du ticket : ${err?.message || "inconnue"}]`;
    }
  }, [activeTab, customerReceiptData, activeOrder, activeTable, tpeData, config, columnWidth]);

  const handleCopy = () => {
    navigator.clipboard.writeText(currentTicketText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadBinary = () => {
    const blob = buildEscPosBinary(currentTicketText, {
      autoCut: true,
      beep: activeTab === "cuisine",
      openDrawer: activeTab === "caisse",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ticket_${activeTab}_${Date.now()}.bin`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDirectNetworkPrint = async () => {
    const printer =
      config?.printers?.find(
        (p) => p.type === activeTab && p.interface === "network" && p.enabled && p.ip
      ) ||
      config?.printers?.find((p) => p.interface === "network" && p.enabled && p.ip);

    if (!printer) {
      setDirectPrintStatus({
        ok: false,
        msg: "Aucune imprimante réseau IP configurée",
      });
      setTimeout(() => setDirectPrintStatus(null), 3500);
      return;
    }

    setDirectPrinting(true);
    setDirectPrintStatus(null);

    try {
      const socket = getSocket();
      if (socket && socket.connected) {
        // Sans ack (droits refusés via "exception", coupure) : on débloque le bouton au bout de 10 s
        socket.timeout(10000).emit(
          "printer:print_text",
          { ip: printer.ip, text: currentTicketText, beep: activeTab === "cuisine" },
          (err, res) => {
            setDirectPrinting(false);
            if (err) {
              setDirectPrintStatus({ ok: false, msg: "Pas de réponse du serveur (droits ou connexion)" });
            } else if (res?.success) {
              setDirectPrintStatus({
                ok: true,
                msg: `Envoyé à ${printer.name || printer.ip} (${res.bytesWritten} o) !`,
              });
            } else {
              setDirectPrintStatus({
                ok: false,
                msg: res?.error || "Erreur de connexion imprimante TCP",
              });
            }
            setTimeout(() => setDirectPrintStatus(null), 4000);
          }
        );
      } else {
        setDirectPrinting(false);
        setDirectPrintStatus({ ok: false, msg: "Socket serveur non connecté" });
        setTimeout(() => setDirectPrintStatus(null), 3500);
      }
    } catch (e) {
      setDirectPrinting(false);
      setDirectPrintStatus({ ok: false, msg: e?.message || "Erreur d'encodage" });
      setTimeout(() => setDirectPrintStatus(null), 3500);
    }
  };

  return (
    <Dialog
      onClose={onClose}
      label="Aperçu du ticket"
      overlayClassName="bg-black/70 p-3 sm:p-5"
      className="rf-anim-pop bg-[#1F1C18] text-white rounded-3xl w-full max-w-xl max-h-[92vh] flex flex-col shadow-2xl border border-white/10 overflow-hidden"
    >
      {/* En-tête */}
      <div className="px-5 py-3.5 bg-black/30 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#C1440E] flex items-center justify-center font-bold">
            <Printer size={16} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">
              Centre d'Impression Thermique ESC/POS
            </h3>
            <p className="text-[11px] text-white/50">
              Spooler & Simulateur de rouleau papier physique
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Sélecteur de largeur rouleau */}
          <div className="flex bg-white/10 rounded-lg p-0.5 text-xs font-bold">
            <button
              onClick={() => setPaperWidth("80mm")}
              className={`px-2.5 py-1 rounded-md transition-all ${
                paperWidth === "80mm" ? "bg-white text-[#2B2622]" : "text-white/70"
              }`}
              title="Format standard caisse et cuisine (80 mm)"
            >
              80mm
            </button>
            <button
              onClick={() => setPaperWidth("58mm")}
              className={`px-2.5 py-1 rounded-md transition-all ${
                paperWidth === "58mm" ? "bg-white text-[#2B2622]" : "text-white/70"
              }`}
              title="Format compact bar (58 mm)"
            >
              58mm
            </button>
          </div>

          <button
            onClick={onClose}
            aria-label="Fermer"
            className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Onglets de sélection du type de ticket */}
      <div className="px-5 py-2.5 bg-black/20 border-b border-white/10 flex gap-1.5 overflow-x-auto rf-scrollbar">
        <button
          onClick={() => setActiveTab("caisse")}
          className={`rf-tap flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            activeTab === "caisse"
              ? "bg-[#C1440E] text-white shadow-sm"
              : "bg-white/5 text-white/70 hover:bg-white/10"
          }`}
        >
          <FileText size={13} />
          <span>Ticket Caisse (Facture)</span>
        </button>

        <button
          onClick={() => setActiveTab("cuisine")}
          className={`rf-tap flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            activeTab === "cuisine"
              ? "bg-[#C1440E] text-white shadow-sm"
              : "bg-white/5 text-white/70 hover:bg-white/10"
          }`}
        >
          <UtensilsCrossed size={13} />
          <span>Bon Cuisine</span>
        </button>

        <button
          onClick={() => setActiveTab("bar")}
          className={`rf-tap flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            activeTab === "bar"
              ? "bg-[#C1440E] text-white shadow-sm"
              : "bg-white/5 text-white/70 hover:bg-white/10"
          }`}
        >
          <Coffee size={13} />
          <span>Bon Bar</span>
        </button>

        {(tpeData || activeTab === "tpe") && (
          <button
            onClick={() => setActiveTab("tpe")}
            className={`rf-tap flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              activeTab === "tpe"
                ? "bg-[#C1440E] text-white shadow-sm"
                : "bg-white/5 text-white/70 hover:bg-white/10"
            }`}
          >
            <CreditCard size={13} />
            <span>Ticket TPE CB</span>
          </button>
        )}
      </div>

      {/* Zone de prévisualisation du rouleau thermique */}
      <div className="flex-1 overflow-y-auto rf-scrollbar p-5 sm:p-8 flex justify-center items-start bg-[#141210]">
        <div
          id="rf-printable-area"
          className="bg-[#FAF8F5] text-[#141210] py-7 px-6 sm:px-8 shadow-2xl relative select-all flex justify-center transition-all mx-auto"
          style={{
            width: "fit-content",
            minWidth: paperWidth === "80mm" ? "320px" : "250px",
            boxShadow: "0 12px 36px rgba(0,0,0,0.55)",
            borderTop: "3px dashed #CBD5E1",
            borderBottom: "3px dashed #CBD5E1",
          }}
        >
          <pre
            className="whitespace-pre font-mono text-[12px] sm:text-[12.5px] leading-relaxed tracking-normal select-all mx-auto text-left block"
            style={{
              width: `${columnWidth}ch`,
            }}
          >
            {currentTicketText}
          </pre>
        </div>
      </div>

      {/* Barre d'outils d'impression et export */}
      <div className="px-5 py-3.5 bg-black/40 border-t border-white/10 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="rf-tap px-3 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/15 text-white flex items-center gap-1.5 border border-white/10"
          >
            {copied ? <Check size={13} className="text-[#2E9E5B]" /> : <Copy size={13} />}
            <span>{copied ? "Copié !" : "Copier Texte"}</span>
          </button>

          <button
            onClick={handleDownloadBinary}
            className="rf-tap px-3 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/15 text-white flex items-center gap-1.5 border border-white/10"
            title="Télécharger la trame binaire ESC/POS prête pour imprimante USB/Réseau"
          >
            <Download size={13} />
            <span>ESC/POS (.bin)</span>
          </button>

          <button
            onClick={handleDirectNetworkPrint}
            disabled={directPrinting}
            className="rf-tap px-3 py-2 rounded-xl text-xs font-bold bg-[#3E7CB1]/20 hover:bg-[#3E7CB1]/30 text-[#60A5FA] flex items-center gap-1.5 border border-[#3E7CB1]/40"
            title="Envoyer directement sur le port TCP 9100 de l'imprimante réseau (impression silencieuse)"
          >
            {directPrinting ? (
              <Loader2 size={13} className="animate-spin text-[#60A5FA]" />
            ) : (
              <Wifi size={13} />
            )}
            <span>{directPrinting ? "Envoi..." : "Imprimer Réseau (TCP 9100)"}</span>
          </button>
        </div>

        {directPrintStatus && (
          <div
            className={`w-full sm:w-auto text-xs px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 ${
              directPrintStatus.ok
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
            }`}
          >
            {directPrintStatus.msg}
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="rf-tap px-4 py-2 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-white/70"
          >
            Fermer
          </button>

          <button
            onClick={handlePrint}
            className="rf-tap px-5 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 shadow-lg"
            style={{ background: "#C1440E" }}
          >
            <Printer size={15} />
            <span>Imprimer</span>
          </button>
        </div>
      </div>
    </Dialog>
  );
}
