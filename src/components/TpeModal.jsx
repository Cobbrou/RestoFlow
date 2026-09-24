import { useState, useEffect } from "react";
import {
  CreditCard,
  Wifi,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RotateCcw,
  Receipt,
  X,
  ShieldCheck,
} from "lucide-react";
import { money } from "../utils/index.js";

/**
 * TpeModal — Simulateur interactif de Terminal de Paiement Électronique (Smart POS)
 * 
 * Permet d'effectuer un règlement par carte bancaire avec simulation réaliste :
 * - Mode sans contact (NFC) ou avec puce (EMV)
 * - Traitement bancaire et demande d'autorisation
 * - Ticket de transaction CB
 */
export default function TpeModal({ amount, onCancel, onSuccess, restaurantName = "RestoFlow Bistrot" }) {
  // Statut : "idle" | "reading" | "authorizing" | "approved" | "declined"
  const [status, setStatus] = useState("idle");
  const [methodType, setMethodType] = useState("contactless"); // "contactless" | "chip"
  const [errorReason, setErrorReason] = useState("");
  const [tpeData, setTpeData] = useState(null);

  const startTransaction = (type = "contactless", shouldSucceed = true) => {
    setMethodType(type);
    setStatus("reading");

    setTimeout(() => {
      setStatus("authorizing");
      setTimeout(() => {
        if (shouldSucceed) {
          const generatedData = {
            terminalId: "TPE-POS-01",
            txNumber: String(Math.floor(10000 + Math.random() * 90000)),
            authCode: `AUTH${Math.floor(1000 + Math.random() * 9000)}`,
            maskedPan: `**** **** **** ${Math.floor(1000 + Math.random() * 9000)}`,
            amount,
            isContactless: type === "contactless",
            timestamp: Date.now(),
          };
          setTpeData(generatedData);
          setStatus("approved");
        } else {
          setErrorReason("Plafond dépassé / Refus banque émettrice");
          setStatus("declined");
        }
      }, 1200);
    }, 1000);
  };

  const handleFinish = () => {
    if (tpeData && onSuccess) {
      onSuccess(tpeData);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 sm:p-6"
      onClick={onCancel}
    >
      <div
        className="rf-anim-pop bg-[#1A1816] border-2 border-white/10 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête TPE */}
        <div className="px-5 py-3.5 bg-black/40 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-[#2E9E5B] animate-pulse" />
            <span className="text-xs font-mono tracking-wider uppercase text-white/70">
              Terminal Bancaire · TPE-01
            </span>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        {/* Écran LCD du terminal */}
        <div className="p-5">
          <div className="bg-[#122216] border-2 border-[#2E9E5B]/40 rounded-2xl p-4 min-h-[220px] flex flex-col justify-between text-[#85E3A0] font-mono shadow-inner">
            {/* Ligne haute LCD */}
            <div className="flex items-center justify-between text-[11px] text-[#85E3A0]/70 border-b border-[#2E9E5B]/20 pb-1.5">
              <span>{restaurantName.slice(0, 18)}</span>
              <div className="flex items-center gap-1.5">
                <Wifi size={12} className={status !== "idle" ? "animate-pulse" : ""} />
                <span>4G/IP</span>
              </div>
            </div>

            {/* Corps central LCD selon statut */}
            <div className="my-auto py-3 text-center">
              {status === "idle" && (
                <div className="space-y-2">
                  <p className="text-xs text-[#85E3A0]/80">MONTANT À RÉGLER</p>
                  <div className="text-3xl font-extrabold text-white tracking-tight">
                    {money(amount)}
                  </div>
                  <p className="text-[11px] text-[#85E3A0]/60 animate-pulse mt-1">
                    Présentez carte ou insérez
                  </p>
                </div>
              )}

              {status === "reading" && (
                <div className="space-y-2">
                  <div className="w-8 h-8 rounded-full border-2 border-t-[#85E3A0] border-r-transparent border-b-transparent border-l-transparent animate-spin mx-auto" />
                  <p className="text-xs font-bold text-white">
                    {methodType === "contactless" ? "LECTURE SANS CONTACT..." : "LECTURE PUCE..."}
                  </p>
                  <p className="text-[10px] text-[#85E3A0]/60">Ne pas retirer la carte</p>
                </div>
              )}

              {status === "authorizing" && (
                <div className="space-y-2">
                  <div className="w-8 h-8 rounded-full border-2 border-t-white border-r-transparent border-b-transparent border-l-transparent animate-spin mx-auto" />
                  <p className="text-xs font-bold text-white">AUTORISATION BANCAIRE...</p>
                  <p className="text-[10px] text-[#85E3A0]/60">Connexion au serveur...</p>
                </div>
              )}

              {status === "approved" && (
                <div className="space-y-2">
                  <CheckCircle2 size={36} className="text-[#2E9E5B] mx-auto animate-bounce" />
                  <p className="text-sm font-black text-white tracking-wider">PAIEMENT ACCEPTÉ</p>
                  <div className="text-xl font-bold text-[#85E3A0]">{money(amount)}</div>
                  <p className="text-[10px] text-white/50">
                    N° Auto : {tpeData?.authCode} · Retirez la carte
                  </p>
                </div>
              )}

              {status === "declined" && (
                <div className="space-y-2">
                  <XCircle size={36} className="text-[#E04B4B] mx-auto animate-bounce" />
                  <p className="text-sm font-black text-[#E04B4B] tracking-wider">PAIEMENT REFUSÉ</p>
                  <p className="text-[11px] text-white/70">{errorReason}</p>
                </div>
              )}
            </div>

            {/* Ligne basse LCD */}
            <div className="text-[10px] text-[#85E3A0]/50 flex justify-between border-t border-[#2E9E5B]/20 pt-1.5">
              <span>CB EMV / NFC</span>
              <span>CERTIFIÉ CB</span>
            </div>
          </div>
        </div>

        {/* Panneau de simulation des actions physiques */}
        <div className="px-5 pb-5 space-y-3">
          {status === "idle" && (
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/50 block">
                Simuler l'action client :
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => startTransaction("contactless", true)}
                  className="rf-tap py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                >
                  <Wifi size={14} className="text-[#85E3A0]" />
                  <span>Sans Contact (NFC)</span>
                </button>
                <button
                  onClick={() => startTransaction("chip", true)}
                  className="rf-tap py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                >
                  <CreditCard size={14} className="text-[#D9A441]" />
                  <span>Insérer Puce (EMV)</span>
                </button>
              </div>

              {/* Bouton de simulation de refus (pour tester la robustesse) */}
              <button
                onClick={() => startTransaction("chip", false)}
                className="w-full py-1.5 text-[11px] text-white/40 hover:text-white/70 text-center flex items-center justify-center gap-1"
              >
                <AlertCircle size={11} />
                <span>Tester une simulation de refus bancaire</span>
              </button>
            </div>
          )}

          {status === "approved" && (
            <button
              onClick={handleFinish}
              className="rf-tap w-full py-3 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-2 shadow-lg"
              style={{ background: "#2E9E5B" }}
            >
              <CheckCircle2 size={16} />
              <span>Valider le règlement & Clôturer TPE</span>
            </button>
          )}

          {status === "declined" && (
            <div className="flex gap-2">
              <button
                onClick={() => setStatus("idle")}
                className="rf-tap flex-1 py-2.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/15 text-white flex items-center justify-center gap-1"
              >
                <RotateCcw size={13} />
                <span>Réessayer</span>
              </button>
              <button
                onClick={onCancel}
                className="rf-tap flex-1 py-2.5 rounded-xl text-xs font-bold bg-[#E04B4B]/20 hover:bg-[#E04B4B]/30 text-[#E04B4B] border border-[#E04B4B]/30"
              >
                Abandonner
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
