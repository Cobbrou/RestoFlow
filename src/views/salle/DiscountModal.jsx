import { useState, useMemo } from "react";
import {
  Tag,
  Percent,
  Euro,
  CheckCircle2,
  X,
  Trash2,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { money } from "../../utils/index.js";

/**
 * DiscountModal — Modale d'application de remises et codes promotionnels
 */
export default function DiscountModal({
  order,
  config = {},
  onApply,
  onRemove,
  onClose,
}) {
  const [tab, setTab] = useState("promo"); // "promo" | "custom"

  // Calcul du sous-total brut
  const items = useMemo(() => (order?.items || []).filter((i) => i.status !== "draft"), [order]);
  const subtotal = useMemo(() => items.reduce((s, i) => s + (i.price || 0) * (i.qty || 1), 0), [items]);

  // Codes promo disponibles
  const promoCodes = useMemo(() => {
    return (config?.promoCodes || [
      { code: "HAPPYHOUR", label: "Happy Hour (-15%)", type: "percent", value: 15, active: true },
      { code: "STAFF", label: "Tarif Équipe (-20%)", type: "percent", value: 20, active: true },
      { code: "BIENVENUE5", label: "Offre Bienvenue (-5€)", type: "fixed", value: 5, active: true },
      { code: "FIDELITE10", label: "Remise Fidélité (-10%)", type: "percent", value: 10, active: true },
      { code: "VIP25", label: "Client Privilège (-25%)", type: "percent", value: 25, active: true },
    ]).filter((p) => p.active !== false);
  }, [config]);

  // État onglet code promo
  const [typedCode, setTypedCode] = useState("");
  const [promoError, setPromoError] = useState("");

  // État onglet remise manuelle
  const [customType, setCustomType] = useState("percent"); // "percent" | "fixed"
  const [customValue, setCustomValue] = useState("");
  const [customReason, setCustomReason] = useState("");

  // Calcul dynamique de la remise selon l'onglet
  const currentDiscountPreview = useMemo(() => {
    if (tab === "promo") {
      const found = promoCodes.find((p) => p.code.toUpperCase() === typedCode.trim().toUpperCase());
      if (!found) return null;
      const amt = found.type === "percent"
        ? Math.round(subtotal * (found.value / 100) * 100) / 100
        : Math.min(subtotal, found.value);
      return {
        type: found.type,
        value: found.value,
        code: found.code,
        label: found.label,
        amount: amt,
        reason: `Code promo: ${found.code}`,
      };
    } else {
      const val = parseFloat(customValue);
      if (isNaN(val) || val <= 0) return null;
      let amt = 0;
      if (customType === "percent") {
        amt = Math.round(subtotal * (Math.min(100, val) / 100) * 100) / 100;
      } else {
        amt = Math.min(subtotal, Math.round(val * 100) / 100);
      }
      return {
        type: customType,
        value: val,
        amount: amt,
        reason: customReason.trim() || "Geste commercial",
      };
    }
  }, [tab, typedCode, promoCodes, customType, customValue, customReason, subtotal]);

  const handleApplyPromo = (promoObj) => {
    const amt = promoObj.type === "percent"
      ? Math.round(subtotal * (promoObj.value / 100) * 100) / 100
      : Math.min(subtotal, promoObj.value);

    onApply({
      type: promoObj.type,
      value: promoObj.value,
      code: promoObj.code,
      label: promoObj.label,
      amount: amt,
      reason: `Code promo: ${promoObj.code}`,
    });
    onClose();
  };

  const handleApplyCustom = () => {
    if (!currentDiscountPreview) return;
    onApply(currentDiscountPreview);
    onClose();
  };

  const existingDiscount = order?.discount;

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 sm:p-6"
      onClick={onClose}
    >
      <div
        className="rf-anim-pop bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col border border-black/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête */}
        <div className="px-5 py-4 border-b border-black/10 flex items-center justify-between bg-[#FAF6EE]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-[#C1440E]/15 text-[#C1440E] flex items-center justify-center font-bold">
              <Tag size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#2B2622]">
                Remise & Codes Promo
              </h3>
              <p className="text-xs text-[#8A8378]">
                Table {order?.tableId ? order.tableId.replace("tbl_", "") : "—"} · Sous-total :{" "}
                <strong className="text-[#2B2622]">{money(subtotal)}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-black/5 hover:bg-black/10 text-[#5B5346]"
          >
            <X size={16} />
          </button>
        </div>

        {/* Remise déjà active s'il y en a une */}
        {existingDiscount && (
          <div className="px-5 py-3 bg-[#2E9E5B]/10 border-b border-[#2E9E5B]/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-[#2E9E5B]" />
              <div>
                <span className="text-xs font-bold text-[#2B2622]">
                  {existingDiscount.code ? `Code actif : ${existingDiscount.code}` : "Remise active"}
                </span>
                <span className="text-xs text-[#2E9E5B] font-extrabold ml-1.5">
                  -{money(existingDiscount.amount)}
                </span>
                {existingDiscount.reason && (
                  <p className="text-[10px] text-[#6B6355]">{existingDiscount.reason}</p>
                )}
              </div>
            </div>
            <button
              onClick={() => {
                onRemove();
                onClose();
              }}
              className="rf-tap px-2.5 py-1.5 rounded-xl bg-white border border-[#C1361B]/30 text-[#C1361B] text-xs font-bold flex items-center gap-1 hover:bg-[#C1361B]/5"
            >
              <Trash2 size={12} />
              <span>Retirer</span>
            </button>
          </div>
        )}

        {/* Onglets */}
        <div className="p-2 border-b border-black/10 bg-[#FAF6EE] flex gap-1">
          <button
            onClick={() => setTab("promo")}
            className={`rf-tap flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              tab === "promo"
                ? "bg-[#2B2622] text-white shadow-xs"
                : "text-[#6B6355] hover:text-[#2B2622]"
            }`}
          >
            <Tag size={13} />
            <span>Codes Promo</span>
          </button>
          <button
            onClick={() => setTab("custom")}
            className={`rf-tap flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              tab === "custom"
                ? "bg-[#2B2622] text-white shadow-xs"
                : "text-[#6B6355] hover:text-[#2B2622]"
            }`}
          >
            <Percent size={13} />
            <span>Remise Manuelle</span>
          </button>
        </div>

        {/* Corps */}
        <div className="p-5 overflow-y-auto rf-scrollbar space-y-4 max-h-[55vh]">
          {tab === "promo" && (
            <div className="space-y-3">
              {/* Saisie d'un code libre */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6B6355] mb-1">
                  Saisir un code promo
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={typedCode}
                    onChange={(e) => {
                      setTypedCode(e.target.value.toUpperCase());
                      setPromoError("");
                    }}
                    placeholder="EX: HAPPYHOUR"
                    className="flex-1 px-3 py-2 rounded-xl border border-black/15 uppercase font-mono font-bold text-sm outline-none focus:border-[#C1440E]"
                  />
                  <button
                    disabled={!typedCode.trim()}
                    onClick={() => {
                      const found = promoCodes.find(
                        (p) => p.code.toUpperCase() === typedCode.trim().toUpperCase()
                      );
                      if (found) {
                        handleApplyPromo(found);
                      } else {
                        setPromoError("Code promotionnel non valide ou expiré");
                      }
                    }}
                    className="rf-tap px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#2B2622] disabled:opacity-40"
                  >
                    Valider
                  </button>
                </div>
                {promoError && (
                  <p className="text-[11px] text-[#C1361B] font-semibold mt-1 flex items-center gap-1">
                    <AlertCircle size={12} /> {promoError}
                  </p>
                )}
              </div>

              {/* Suggestions / Liste des codes actifs */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8A8378] mb-1.5">
                  Codes actifs disponibles ({promoCodes.length})
                </label>
                <div className="space-y-1.5">
                  {promoCodes.map((p) => {
                    const discountAmt = p.type === "percent"
                      ? Math.round(subtotal * (p.value / 100) * 100) / 100
                      : Math.min(subtotal, p.value);

                    return (
                      <div
                        key={p.code}
                        className="p-2.5 rounded-2xl border border-black/10 bg-[#FAF6EE]/50 hover:bg-[#FAF6EE] flex items-center justify-between transition-all"
                      >
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-extrabold text-xs text-[#2B2622] px-1.5 py-0.5 rounded bg-black/5">
                              {p.code}
                            </span>
                            <span className="text-xs font-semibold text-[#5B5346]">
                              {p.label}
                            </span>
                          </div>
                          <span className="text-[11px] text-[#2E9E5B] font-bold mt-0.5 block">
                            Économie : -{money(discountAmt)}
                          </span>
                        </div>
                        <button
                          onClick={() => handleApplyPromo(p)}
                          className="rf-tap px-3 py-1.5 rounded-xl text-xs font-bold text-white shadow-2xs"
                          style={{ background: "#C1440E" }}
                        >
                          Appliquer
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {tab === "custom" && (
            <div className="space-y-3.5">
              {/* Type de remise */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6B6355] mb-1.5">
                  Type de calcul
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setCustomType("percent")}
                    className={`rf-tap py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      customType === "percent"
                        ? "border-[#C1440E] bg-[#C1440E]/10 text-[#C1440E]"
                        : "border-black/10 bg-[#FAF6EE] text-[#5B5346]"
                    }`}
                  >
                    <Percent size={14} />
                    <span>Pourcentage (%)</span>
                  </button>
                  <button
                    onClick={() => setCustomType("fixed")}
                    className={`rf-tap py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      customType === "fixed"
                        ? "border-[#C1440E] bg-[#C1440E]/10 text-[#C1440E]"
                        : "border-black/10 bg-[#FAF6EE] text-[#5B5346]"
                    }`}
                  >
                    <Euro size={14} />
                    <span>Montant fixe (€)</span>
                  </button>
                </div>
              </div>

              {/* Valeur */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6B6355] mb-1">
                  {customType === "percent" ? "Taux de remise (%)" : "Montant de la remise (€)"}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step={customType === "percent" ? "1" : "0.50"}
                    min="1"
                    max={customType === "percent" ? "100" : subtotal}
                    value={customValue}
                    onChange={(e) => setCustomValue(e.target.value)}
                    placeholder={customType === "percent" ? "10" : "5.00"}
                    className="w-full px-3 py-2.5 rounded-xl border border-black/15 font-bold text-base outline-none focus:border-[#C1440E]"
                  />
                  <span className="absolute right-3.5 top-3 text-xs font-extrabold text-[#8A8378]">
                    {customType === "percent" ? "%" : "€"}
                  </span>
                </div>

                {/* Boutons rapides */}
                <div className="flex gap-1.5 mt-2">
                  {(customType === "percent" ? [5, 10, 15, 20, 50] : [2, 5, 10, 15, 20]).map((v) => (
                    <button
                      key={v}
                      onClick={() => setCustomValue(String(v))}
                      className="rf-tap flex-1 py-1 rounded-lg bg-black/5 hover:bg-black/10 text-xs font-bold text-[#5B5346]"
                    >
                      {v} {customType === "percent" ? "%" : "€"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Motif obligatoire */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6B6355] mb-1">
                  Motif de la remise / Geste commercial
                </label>
                <input
                  type="text"
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="Ex : Attente prolongée, Ami de la direction, Incident..."
                  className="w-full px-3 py-2 rounded-xl border border-black/15 text-xs outline-none focus:border-[#C1440E]"
                />
              </div>

              {/* Prévisualisation calcul */}
              {currentDiscountPreview && (
                <div className="p-3 rounded-2xl bg-[#2E9E5B]/10 border border-[#2E9E5B]/20 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-[#5B5346] font-semibold">Nouveau total à payer :</span>
                    <div className="text-base font-extrabold text-[#2B2622]">
                      {money(Math.max(0, subtotal - currentDiscountPreview.amount))}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-extrabold text-[#2E9E5B]">
                      -{money(currentDiscountPreview.amount)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Pied */}
        <div className="p-4 bg-[#FAF6EE] border-t border-black/10 flex gap-2">
          <button
            onClick={onClose}
            className="rf-tap flex-1 py-2.5 rounded-xl text-xs font-semibold bg-white border border-black/10 text-[#5B5346]"
          >
            Fermer
          </button>
          {tab === "custom" && (
            <button
              disabled={!currentDiscountPreview}
              onClick={handleApplyCustom}
              className="rf-tap flex-1 py-2.5 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5 disabled:opacity-40 shadow-sm"
              style={{ background: "#C1440E" }}
            >
              <CheckCircle2 size={14} />
              <span>Valider la remise</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
