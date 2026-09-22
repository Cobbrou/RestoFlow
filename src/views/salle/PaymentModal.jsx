import { useState, useMemo } from "react";
import {
  X,
  Users,
  PieChart,
  ListOrdered,
  CreditCard,
  Banknote,
  Wallet,
  CheckCircle2,
  Plus,
  Minus,
  Receipt,
  UserPlus,
  Share2,
  ArrowRight,
  RotateCcw,
} from "lucide-react";
import { money } from "../../utils/index.js";

export const PAYMENT_METHODS = [
  { id: "carte",   label: "Carte",   icon: CreditCard, emoji: "💳" },
  { id: "especes", label: "Espèces", icon: Banknote,   emoji: "💵" },
  { id: "autre",   label: "Autre",   icon: Wallet,     emoji: "👛" },
];

/**
 * PaymentModal — Interface complète et fluide d'encaissement et de partage de note.
 *
 * 4 modes :
 *  - "single"       : Paiement unique rapide (1 clic)
 *  - "equal"        : Division en parts égales (2 à 20 convives, calcul équitable des centimes)
 *  - "item"         : Division par article (attribution aux convives ou sélection rapide)
 *  - "proportional" : Division proportionnelle / montants libres (% ou montant direct)
 */
export default function PaymentModal({ order, table, onCancel, onConfirm }) {
  // Articles facturables (hors brouillons)
  const items = useMemo(() => order.items.filter((i) => i.status !== "draft"), [order]);
  const total = useMemo(() => items.reduce((s, i) => s + i.price * i.qty, 0), [items]);

  // Mode de partage actif
  const [mode, setMode] = useState("single"); // "single" | "equal" | "item" | "proportional"

  // Historique des règlements effectués dans cette session d'encaissement
  // Chaque élément : { id, label, amount, method, items, paidAt }
  const [payments, setPayments] = useState([]);

  // Montant déjà réglé et reste à payer
  const paidAmount = useMemo(
    () => payments.reduce((s, p) => s + p.amount, 0),
    [payments]
  );
  const remainingAmount = Math.max(0, Math.round((total - paidAmount) * 100) / 100);
  const isFullyPaid = remainingAmount <= 0.009 && (payments.length > 0 || total === 0);

  // ── Mode Unique (Single) ───────────────────────────────────
  const [singleMethod, setSingleMethod] = useState(null);

  // ── Mode Parts Égales ──────────────────────────────────────
  const defaultGuestCount = Math.max(2, Math.min(table?.seats || 2, 8));
  const [guestCount, setGuestCount] = useState(defaultGuestCount);
  const [equalMethod, setEqualMethod] = useState("carte");

  // Calcul exact des parts avec répartition équitable des centimes
  const equalShares = useMemo(() => {
    const totalCents = Math.round(total * 100);
    const count = Math.max(1, guestCount);
    const baseCents = Math.floor(totalCents / count);
    const remainder = totalCents % count;

    const list = [];
    for (let i = 0; i < count; i++) {
      const shareCents = baseCents + (i < remainder ? 1 : 0);
      list.push({
        index: i + 1,
        label: `Part ${i + 1}/${count}`,
        amount: shareCents / 100,
      });
    }
    return list;
  }, [total, guestCount]);

  // ── Mode Proportionnel / Libre ─────────────────────────────
  const [customAmountStr, setCustomAmountStr] = useState("");
  const [propMethod, setPropMethod] = useState("carte");

  // ── Mode Par Article ───────────────────────────────────────
  // Liste des convives pour le mode par article
  const [guests, setGuests] = useState([
    { id: "g1", name: "Convive 1" },
    { id: "g2", name: "Convive 2" },
  ]);
  const [activeGuestId, setActiveGuestId] = useState("g1");
  const [itemMethod, setItemMethod] = useState("carte");

  // itemAllocations : { [itemId]: { [guestId]: qty, shared: qty } }
  const [itemAllocations, setItemAllocations] = useState({});

  // Calcule les quantités allouées pour chaque article
  const itemAllocationSummary = useMemo(() => {
    const summary = {};
    for (const item of items) {
      const alloc = itemAllocations[item.id] || {};
      let allocatedQty = 0;
      for (const [, q] of Object.entries(alloc)) {
        if (q > 0) allocatedQty += q;
      }
      summary[item.id] = {
        allocated: allocatedQty,
        remaining: Math.max(0, item.qty - allocatedQty),
      };
    }
    return summary;
  }, [items, itemAllocations]);

  // Calcule le sous-total pour chaque convive
  const guestTotals = useMemo(() => {
    const totals = {};
    for (const g of guests) {
      totals[g.id] = 0;
    }

    for (const item of items) {
      const alloc = itemAllocations[item.id] || {};
      // Parts directes du convive
      for (const g of guests) {
        const q = alloc[g.id] || 0;
        if (q > 0) totals[g.id] += q * item.price;
      }
      // Part partagée divisée équitablement entre tous les convives
      const sharedQty = alloc.shared || 0;
      if (sharedQty > 0 && guests.length > 0) {
        const sharedTotal = sharedQty * item.price;
        const perGuest = sharedTotal / guests.length;
        for (const g of guests) {
          totals[g.id] += perGuest;
        }
      }
    }

    // Arrondi à 2 décimales
    for (const g of guests) {
      totals[g.id] = Math.round(totals[g.id] * 100) / 100;
    }
    return totals;
  }, [items, guests, itemAllocations]);

  // ── Actions de règlement ───────────────────────────────────

  const addPayment = (label, amount, method, meta = {}) => {
    const safeAmount = Math.min(amount, remainingAmount);
    if (safeAmount <= 0) return;
    const rounded = Math.round(safeAmount * 100) / 100;

    const newPayment = {
      id: `pay_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      label,
      amount: rounded,
      method,
      paidAt: Date.now(),
      ...meta,
    };

    setPayments((prev) => [...prev, newPayment]);
  };

  const removePayment = (paymentId) => {
    setPayments((prev) => prev.filter((p) => p.id !== paymentId));
  };

  const resetAllPayments = () => {
    setPayments([]);
  };

  // Finalisation : envoi des données à App.jsx
  const handleFinalize = () => {
    if (mode === "single") {
      if (!singleMethod) return;
      onConfirm(singleMethod, [
        {
          id: `pay_single_${Date.now()}`,
          label: "Paiement unique",
          amount: total,
          method: singleMethod,
          paidAt: Date.now(),
        },
      ]);
    } else {
      if (payments.length === 0) return;
      const methods = Array.from(new Set(payments.map((p) => p.method)));
      const primaryMethod = methods.length === 1 ? methods[0] : "partage";
      onConfirm(primaryMethod, payments);
    }
  };

  // Raccourci pour tout régler d'un coup dans le mode Parts égales
  const handlePayAllEqualShares = (method) => {
    const newPayments = equalShares.map((share) => ({
      id: `pay_eq_${share.index}_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      label: share.label,
      amount: share.amount,
      method: method,
      paidAt: Date.now(),
    }));
    setPayments(newPayments);
  };

  // Raccourci pour payer la part égale suivante
  const handlePayNextEqualShare = (method) => {
    const paidCount = payments.filter((p) => p.label?.startsWith("Part")).length;
    if (paidCount >= equalShares.length) return;
    const share = equalShares[paidCount];
    addPayment(share.label, share.amount, method);
  };

  // Mode par article : ajouter ou retirer un article pour le convive actif
  const handleToggleItemForGuest = (itemId, guestId, delta = 1) => {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;

    setItemAllocations((prev) => {
      const itemAlloc = { ...prev[itemId] };
      const current = itemAlloc[guestId] || 0;
      const sumOther = Object.entries(itemAlloc).reduce(
        (sum, [k, v]) => (k !== guestId ? sum + v : sum),
        0
      );

      const maxAvailable = item.qty - sumOther;
      const target = Math.max(0, Math.min(current + delta, maxAvailable));

      if (target === 0) {
        delete itemAlloc[guestId];
      } else {
        itemAlloc[guestId] = target;
      }
      return { ...prev, [itemId]: itemAlloc };
    });
  };

  // Mode par article : marquer tout le restant d'un article comme partagé
  const handleToggleItemShared = (itemId) => {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;

    setItemAllocations((prev) => {
      const itemAlloc = { ...prev[itemId] };
      const currentShared = itemAlloc.shared || 0;
      if (currentShared > 0) {
        // Enlever le partage
        delete itemAlloc.shared;
      } else {
        // Allouer le restant disponible au partage
        const allocatedToGuests = Object.entries(itemAlloc).reduce(
          (sum, [k, v]) => (k !== "shared" ? sum + v : sum),
          0
        );
        const rem = item.qty - allocatedToGuests;
        if (rem > 0) {
          itemAlloc.shared = rem;
        }
      }
      return { ...prev, [itemId]: itemAlloc };
    });
  };

  // Régler le sous-total du convive actif
  const handlePayGuest = (guestId, method) => {
    const guest = guests.find((g) => g.id === guestId);
    const amount = guestTotals[guestId] || 0;
    if (amount <= 0) return;

    // Récupère la liste des articles attribués
    const guestItems = [];
    for (const item of items) {
      const q = itemAllocations[item.id]?.[guestId] || 0;
      if (q > 0) guestItems.push({ name: item.name, qty: q, price: item.price });
      const sh = itemAllocations[item.id]?.shared || 0;
      if (sh > 0) guestItems.push({ name: `${item.name} (partagé)`, qty: `1/${guests.length}`, price: (sh * item.price) / guests.length });
    }

    addPayment(guest ? guest.name : `Convive ${guestId}`, amount, method, { items: guestItems });
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-3 sm:p-5"
      onClick={onCancel}
    >
      <div
        className="rf-anim-pop bg-[#FAF6EE] rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden border border-black/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── EN-TÊTE MODAL ───────────────────────────────────── */}
        <div className="px-5 py-3.5 bg-white border-b border-black/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center font-black text-lg shadow-sm"
              style={{ background: "#C1440E14", color: "#C1440E" }}
            >
              {table.number}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="rf-display text-lg font-bold text-[#2B2622]">
                  Encaissement · Table {table.number}
                </h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-black/5 text-[#6B6355] font-semibold">
                  {table.seats} couverts
                </span>
              </div>
              <p className="text-xs text-[#8A8378]">
                {items.length} article(s) commandé(s) · Total net : <strong className="text-[#2B2622]">{money(total)}</strong>
              </p>
            </div>
          </div>

          <button
            onClick={onCancel}
            className="rf-tap p-2 rounded-full bg-black/5 hover:bg-black/10 text-[#5B5346]"
            title="Fermer"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── SÉLECTEUR DE MODE DE PARTAGE ────────────────────── */}
        <div className="px-5 pt-3 pb-2 bg-white border-b border-black/10">
          <div className="grid grid-cols-4 gap-1.5 p-1 bg-black/5 rounded-2xl">
            <button
              onClick={() => setMode("single")}
              className={`rf-tap flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-bold transition-all ${
                mode === "single"
                  ? "bg-[#2B2622] text-[#FAF6EE] shadow-sm"
                  : "text-[#6B6355] hover:text-[#2B2622]"
              }`}
            >
              <Receipt size={14} />
              <span className="truncate">Plein</span>
            </button>

            <button
              onClick={() => setMode("equal")}
              className={`rf-tap flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-bold transition-all ${
                mode === "equal"
                  ? "bg-[#2B2622] text-[#FAF6EE] shadow-sm"
                  : "text-[#6B6355] hover:text-[#2B2622]"
              }`}
            >
              <Users size={14} />
              <span className="truncate">Parts égales</span>
            </button>

            <button
              onClick={() => setMode("item")}
              className={`rf-tap flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-bold transition-all ${
                mode === "item"
                  ? "bg-[#2B2622] text-[#FAF6EE] shadow-sm"
                  : "text-[#6B6355] hover:text-[#2B2622]"
              }`}
            >
              <ListOrdered size={14} />
              <span className="truncate">Par article</span>
            </button>

            <button
              onClick={() => setMode("proportional")}
              className={`rf-tap flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-bold transition-all ${
                mode === "proportional"
                  ? "bg-[#2B2622] text-[#FAF6EE] shadow-sm"
                  : "text-[#6B6355] hover:text-[#2B2622]"
              }`}
            >
              <PieChart size={14} />
              <span className="truncate">Proportionnel</span>
            </button>
          </div>
        </div>

        {/* ── BANDEAU DE PROGRESSION DU PAIEMENT (Si mode partagé) ── */}
        {mode !== "single" && (
          <div className="px-5 py-3 bg-[#FAF6EE] border-b border-black/10">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-semibold text-[#5B5346]">
                Déjà réglé : <strong className="text-[#2E9E5B]">{money(paidAmount)}</strong>
              </span>
              <span className="font-bold text-sm">
                Reste à payer :{" "}
                <span className={remainingAmount > 0 ? "text-[#C1440E]" : "text-[#2E9E5B]"}>
                  {money(remainingAmount)}
                </span>
              </span>
            </div>

            {/* Barre de progression */}
            <div className="w-full h-2.5 bg-black/10 rounded-full overflow-hidden flex">
              <div
                className="h-full bg-[#2E9E5B] transition-all duration-300"
                style={{ width: `${Math.min(100, total > 0 ? (paidAmount / total) * 100 : 0)}%` }}
              />
              {remainingAmount > 0 && (
                <div
                  className="h-full bg-[#C1440E] opacity-75 transition-all duration-300"
                  style={{ width: `${Math.min(100, total > 0 ? (remainingAmount / total) * 100 : 0)}%` }}
                />
              )}
            </div>

            {/* Règlements enregistrés */}
            {payments.length > 0 && (
              <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto rf-scrollbar pb-0.5">
                <span className="text-[10px] font-bold uppercase text-[#8A8378] tracking-wider shrink-0 mr-1">
                  Encaissé :
                </span>
                {payments.map((p) => {
                  const mIcon = PAYMENT_METHODS.find((m) => m.id === p.method)?.emoji || "💳";
                  return (
                    <span
                      key={p.id}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold bg-white border border-black/10 text-[#2B2622] shadow-2xs shrink-0"
                    >
                      <span>{mIcon}</span>
                      <span>{p.label}</span>
                      <strong className="text-[#2E9E5B] ml-0.5">{money(p.amount)}</strong>
                      <button
                        onClick={() => removePayment(p.id)}
                        className="text-[#8A8378] hover:text-[#C1361B] ml-1 p-0.5 rounded"
                        title="Annuler ce règlement"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  );
                })}
                <button
                  onClick={resetAllPayments}
                  className="text-[11px] text-[#C1361B] hover:underline font-semibold ml-auto shrink-0 flex items-center gap-0.5 pl-2"
                >
                  <RotateCcw size={11} /> Réinitialiser
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── CORPS CENTRAL DU MODAL ──────────────────────────── */}
        <div className="flex-1 overflow-y-auto rf-scrollbar p-5 space-y-4">
          {/* ══════════════════════════════════════════════════════
              1. MODE UNIQUE (SINGLE)
          ══════════════════════════════════════════════════════ */}
          {mode === "single" && (
            <div className="space-y-4">
              {/* Récapitulatif commande */}
              <div className="rounded-2xl border border-black/10 bg-white p-3.5 space-y-2 max-h-[220px] overflow-y-auto rf-scrollbar">
                <div className="grid grid-cols-[1fr_50px_70px_70px] gap-2 text-[10px] font-bold uppercase tracking-wide text-[#8A8378] px-1">
                  <span>Article</span>
                  <span className="text-center">Qté</span>
                  <span className="text-right">P.U.</span>
                  <span className="text-right">Total</span>
                </div>
                {items.map((it) => (
                  <div
                    key={it.id}
                    className="grid grid-cols-[1fr_50px_70px_70px] gap-2 items-center text-xs py-1 px-1 border-b border-black/5 last:border-0"
                  >
                    <span className="font-semibold text-[#2B2622] truncate">{it.name}</span>
                    <span className="text-center text-[#5B5346]">{it.qty}</span>
                    <span className="text-right text-[#5B5346]">{money(it.price)}</span>
                    <span className="text-right font-bold text-[#2B2622]">
                      {money(it.price * it.qty)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Total */}
              <div className="flex justify-between items-center px-4 py-3 rounded-2xl bg-white border border-black/10">
                <span className="text-base font-bold text-[#2B2622]">Montant total TTC</span>
                <span className="text-xl font-extrabold text-[#2B2622]">{money(total)}</span>
              </div>

              {/* Moyen de paiement */}
              <div>
                <label className="block text-xs font-bold text-[#5B5346] uppercase tracking-wider mb-2">
                  Sélectionnez le moyen de paiement
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {PAYMENT_METHODS.map((m) => {
                    const selected = singleMethod === m.id;
                    return (
                      <button
                        key={m.id}
                        onClick={() => setSingleMethod(m.id)}
                        className={`rf-tap flex flex-col items-center justify-center gap-2 py-4 rounded-2xl border-2 text-xs font-bold transition-all ${
                          selected
                            ? "border-[#C1440E] bg-[#C1440E]/10 text-[#C1440E] shadow-sm"
                            : "border-black/10 bg-white text-[#5B5346] hover:border-black/20"
                        }`}
                      >
                        <span className="text-2xl">{m.emoji}</span>
                        <span className="text-sm">{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════
              2. MODE PARTS ÉGALES
          ══════════════════════════════════════════════════════ */}
          {mode === "equal" && (
            <div className="space-y-4">
              {/* Sélecteur de convives */}
              <div className="bg-white rounded-2xl p-4 border border-black/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#5B5346]">
                    Nombre de parts / convives
                  </h4>
                  <p className="text-xs text-[#8A8378]">
                    Montant par part :{" "}
                    <strong className="text-base text-[#2B2622] ml-1">
                      {money(equalShares[0]?.amount || 0)}
                    </strong>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-black/5 rounded-xl p-1">
                    <button
                      onClick={() => setGuestCount((c) => Math.max(2, c - 1))}
                      className="rf-tap w-8 h-8 rounded-lg bg-white shadow-xs flex items-center justify-center text-[#2B2622] disabled:opacity-30"
                      disabled={guestCount <= 2}
                    >
                      <Minus size={14} />
                    </button>
                    <span className="w-10 text-center font-bold text-base text-[#2B2622]">
                      {guestCount}
                    </span>
                    <button
                      onClick={() => setGuestCount((c) => Math.min(20, c + 1))}
                      className="rf-tap w-8 h-8 rounded-lg bg-white shadow-xs flex items-center justify-center text-[#2B2622] disabled:opacity-30"
                      disabled={guestCount >= 20}
                    >
                      <Plus size={14} />
                    </button>
                  </div>

                  {/* Boutons d'accès direct */}
                  <div className="flex gap-1">
                    {[2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        onClick={() => setGuestCount(n)}
                        className={`rf-tap w-8 h-8 rounded-xl text-xs font-bold ${
                          guestCount === n
                            ? "bg-[#2B2622] text-white"
                            : "bg-black/5 text-[#5B5346] hover:bg-black/10"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Sélection moyen pour règlement partiel */}
              <div className="flex items-center justify-between bg-white rounded-2xl p-3 border border-black/10">
                <span className="text-xs font-bold text-[#5B5346]">Moyen de règlement :</span>
                <div className="flex gap-1.5">
                  {PAYMENT_METHODS.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setEqualMethod(m.id)}
                      className={`rf-tap px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all ${
                        equalMethod === m.id
                          ? "border-[#C1440E] bg-[#C1440E]/10 text-[#C1440E]"
                          : "border-black/10 bg-black/5 text-[#5B5346]"
                      }`}
                    >
                      <span>{m.emoji}</span>
                      <span>{m.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Liste des parts */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[220px] overflow-y-auto rf-scrollbar">
                {equalShares.map((share, idx) => {
                  const isPaid = payments.some(
                    (p) => p.label === share.label || idx < payments.length
                  );
                  const matchingPayment = payments[idx];

                  return (
                    <div
                      key={share.index}
                      className={`p-3 rounded-2xl border transition-all flex items-center justify-between ${
                        isPaid
                          ? "bg-[#2E9E5B]/10 border-[#2E9E5B]/40"
                          : "bg-white border-black/10"
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-[#2B2622]">{share.label}</span>
                          {isPaid && (
                            <span className="text-[10px] font-bold text-[#2E9E5B] flex items-center gap-0.5">
                              <CheckCircle2 size={12} /> Réglé
                            </span>
                          )}
                        </div>
                        <div className="text-sm font-extrabold text-[#2B2622] mt-0.5">
                          {money(share.amount)}
                        </div>
                        {isPaid && matchingPayment && (
                          <span className="text-[10px] text-[#5B5346] font-medium">
                            {PAYMENT_METHODS.find((m) => m.id === matchingPayment.method)?.emoji}{" "}
                            {PAYMENT_METHODS.find((m) => m.id === matchingPayment.method)?.label}
                          </span>
                        )}
                      </div>

                      <div>
                        {isPaid ? (
                          <button
                            onClick={() => matchingPayment && removePayment(matchingPayment.id)}
                            className="rf-tap text-xs text-[#C1361B] hover:underline font-semibold p-1"
                          >
                            Annuler
                          </button>
                        ) : (
                          <button
                            onClick={() => addPayment(share.label, share.amount, equalMethod)}
                            className="rf-tap px-3 py-2 rounded-xl text-xs font-bold text-white shadow-xs"
                            style={{ background: "#C1440E" }}
                          >
                            Régler ({PAYMENT_METHODS.find((m) => m.id === equalMethod)?.emoji})
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Raccourcis de validation globale */}
              {!isFullyPaid && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handlePayNextEqualShare(equalMethod)}
                    className="rf-tap flex-1 py-2.5 rounded-xl text-xs font-bold bg-[#2B2622] text-white flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <span>Régler la part suivante ({money(equalShares[0]?.amount || 0)})</span>
                  </button>
                  <button
                    onClick={() => handlePayAllEqualShares(equalMethod)}
                    className="rf-tap px-4 py-2.5 rounded-xl text-xs font-bold bg-black/5 hover:bg-black/10 text-[#2B2622]"
                    title="Enregistrer toutes les parts d'un coup avec ce mode de paiement"
                  >
                    ⚡ Tout régler en {PAYMENT_METHODS.find((m) => m.id === equalMethod)?.label}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════
              3. MODE PAR ARTICLE
          ══════════════════════════════════════════════════════ */}
          {mode === "item" && (
            <div className="space-y-4">
              {/* Barre des convives */}
              <div className="flex items-center gap-2 overflow-x-auto rf-scrollbar pb-1">
                {guests.map((g) => {
                  const active = activeGuestId === g.id;
                  const gTotal = guestTotals[g.id] || 0;
                  const isPaid = payments.some((p) => p.label === g.name);

                  return (
                    <button
                      key={g.id}
                      onClick={() => setActiveGuestId(g.id)}
                      className={`rf-tap flex flex-col items-start px-3 py-2 rounded-2xl border-2 transition-all min-w-[120px] text-left shrink-0 ${
                        active
                          ? "border-[#C1440E] bg-white shadow-sm"
                          : isPaid
                          ? "border-[#2E9E5B]/40 bg-[#2E9E5B]/5"
                          : "border-black/10 bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="text-xs font-bold text-[#2B2622] truncate">{g.name}</span>
                        {isPaid ? (
                          <CheckCircle2 size={12} className="text-[#2E9E5B]" />
                        ) : active ? (
                          <span className="w-2 h-2 rounded-full bg-[#C1440E]" />
                        ) : null}
                      </div>
                      <span className="text-sm font-extrabold text-[#2B2622] mt-0.5">
                        {money(gTotal)}
                      </span>
                    </button>
                  );
                })}

                {/* Ajouter un convive */}
                <button
                  onClick={() => {
                    const newId = `g${guests.length + 1}`;
                    setGuests((prev) => [...prev, { id: newId, name: `Convive ${prev.length + 1}` }]);
                    setActiveGuestId(newId);
                  }}
                  className="rf-tap flex items-center gap-1 px-3 py-3 rounded-2xl border-2 border-dashed border-black/20 hover:border-black/40 text-xs font-bold text-[#6B6355] shrink-0"
                >
                  <UserPlus size={14} /> + Convive
                </button>
              </div>

              {/* Panneau d'attribution pour le convive actif */}
              <div className="bg-white rounded-2xl p-4 border border-black/10 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-black/10">
                  <div>
                    <span className="text-xs font-bold text-[#2B2622]">
                      Attribuer les articles à :{" "}
                      <span className="text-[#C1440E]">
                        {guests.find((g) => g.id === activeGuestId)?.name}
                      </span>
                    </span>
                    <p className="text-[11px] text-[#8A8378]">
                      Touchez les articles pour les attribuer ou les partager
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-[#8A8378]">Sous-total convive :</span>
                    <div className="text-base font-extrabold text-[#2B2622]">
                      {money(guestTotals[activeGuestId] || 0)}
                    </div>
                  </div>
                </div>

                {/* Liste des articles */}
                <div className="space-y-2 max-h-[200px] overflow-y-auto rf-scrollbar pr-1">
                  {items.map((it) => {
                    const currentAlloc = itemAllocations[it.id]?.[activeGuestId] || 0;
                    const isShared = (itemAllocations[it.id]?.shared || 0) > 0;
                    const summary = itemAllocationSummary[it.id] || { allocated: 0, remaining: it.qty };

                    return (
                      <div
                        key={it.id}
                        className={`p-2.5 rounded-xl border transition-all flex items-center justify-between ${
                          currentAlloc > 0
                            ? "border-[#C1440E]/40 bg-[#C1440E]/5"
                            : isShared
                            ? "border-[#3E7CB1]/40 bg-[#3E7CB1]/5"
                            : "border-black/5 bg-black/[.02]"
                        }`}
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-xs text-[#2B2622] truncate">
                              {it.name}
                            </span>
                            <span className="text-[11px] font-bold text-[#8A8378]">
                              ×{it.qty} ({money(it.price)})
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px]">
                            <span className="text-[#5B5346]">
                              Attribué : <strong>{summary.allocated}</strong> / {it.qty}
                            </span>
                            {isShared && (
                              <span className="px-1.5 py-0.2 rounded bg-[#3E7CB1]/15 text-[#3E7CB1] font-bold flex items-center gap-0.5">
                                <Share2 size={9} /> Partagé ({guests.length} pers.)
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Contrôles d'attribution */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Bouton Partager */}
                          <button
                            onClick={() => handleToggleItemShared(it.id)}
                            className={`rf-tap px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-0.5 border ${
                              isShared
                                ? "bg-[#3E7CB1] text-white border-[#3E7CB1]"
                                : "bg-white text-[#5B5346] border-black/10 hover:bg-black/5"
                            }`}
                            title="Diviser cet article équitablement entre tous les convives"
                          >
                            <Share2 size={10} /> Partager
                          </button>

                          {/* Stepper quantité convive */}
                          <div className="flex items-center bg-white rounded-lg border border-black/10 p-0.5 shadow-2xs">
                            <button
                              onClick={() => handleToggleItemForGuest(it.id, activeGuestId, -1)}
                              disabled={currentAlloc <= 0}
                              className="rf-tap w-6 h-6 flex items-center justify-center text-[#2B2622] disabled:opacity-25"
                            >
                              <Minus size={11} />
                            </button>
                            <span className="w-6 text-center text-xs font-bold text-[#2B2622]">
                              {currentAlloc}
                            </span>
                            <button
                              onClick={() => handleToggleItemForGuest(it.id, activeGuestId, 1)}
                              disabled={summary.remaining <= 0}
                              className="rf-tap w-6 h-6 flex items-center justify-center text-[#2B2622] disabled:opacity-25"
                            >
                              <Plus size={11} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Encaissement de ce convive */}
                <div className="pt-2 border-t border-black/10 flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] font-bold text-[#5B5346]">Moyen :</span>
                    {PAYMENT_METHODS.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setItemMethod(m.id)}
                        className={`rf-tap px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 border ${
                          itemMethod === m.id
                            ? "border-[#C1440E] bg-[#C1440E]/10 text-[#C1440E]"
                            : "border-black/10 bg-black/5 text-[#5B5346]"
                        }`}
                      >
                        <span>{m.emoji}</span>
                      </button>
                    ))}
                  </div>

                  <button
                    disabled={(guestTotals[activeGuestId] || 0) <= 0}
                    onClick={() => handlePayGuest(activeGuestId, itemMethod)}
                    className="rf-tap px-4 py-2 rounded-xl text-xs font-bold text-white shadow-xs disabled:opacity-40 flex items-center gap-1.5"
                    style={{ background: "#C1440E" }}
                  >
                    <span>
                      Encaisser {guests.find((g) => g.id === activeGuestId)?.name} (
                      {money(guestTotals[activeGuestId] || 0)})
                    </span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════
              4. MODE PROPORTIONNEL / LIBRE
          ══════════════════════════════════════════════════════ */}
          {mode === "proportional" && (
            <div className="space-y-4">
              {/* Saisie montant ou pourcentage */}
              <div className="bg-white rounded-2xl p-4 border border-black/10 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#5B5346]">
                    Règlement partiel ou montant personnalisé
                  </h4>
                  <span className="text-xs text-[#8A8378]">
                    Solde restant : <strong className="text-[#C1440E]">{money(remainingAmount)}</strong>
                  </span>
                </div>

                {/* Boutons de pourcentages rapides */}
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                  {[
                    { label: "100%", val: remainingAmount },
                    { label: "50%",  val: Math.round((total * 0.5) * 100) / 100 },
                    { label: "33%",  val: Math.round((total / 3) * 100) / 100 },
                    { label: "25%",  val: Math.round((total * 0.25) * 100) / 100 },
                    { label: "20%",  val: Math.round((total * 0.2) * 100) / 100 },
                    { label: "10%",  val: Math.round((total * 0.1) * 100) / 100 },
                  ].map((btn) => (
                    <button
                      key={btn.label}
                      onClick={() => setCustomAmountStr(String(Math.min(btn.val, remainingAmount)))}
                      className="rf-tap py-2 px-1 rounded-xl border border-black/10 bg-black/[.02] hover:bg-black/5 text-xs font-bold text-[#2B2622] flex flex-col items-center justify-center"
                    >
                      <span className="text-xs">{btn.label}</span>
                      <span className="text-[10px] text-[#8A8378] font-semibold">
                        {money(Math.min(btn.val, remainingAmount))}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Champ de montant direct */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6B6355] mb-1">
                    Montant à encaisser (€)
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        max={remainingAmount}
                        placeholder={remainingAmount.toFixed(2)}
                        value={customAmountStr}
                        onChange={(e) => setCustomAmountStr(e.target.value)}
                        className="w-full pl-3 pr-8 py-2.5 rounded-xl border border-black/15 text-base font-bold text-[#2B2622] outline-none focus:border-[#C1440E] bg-[#FAF6EE]"
                      />
                      <span className="absolute right-3 top-2.5 text-base font-bold text-[#8A8378]">
                        €
                      </span>
                    </div>

                    <button
                      onClick={() => setCustomAmountStr(remainingAmount.toFixed(2))}
                      className="rf-tap px-3 py-2 rounded-xl text-xs font-bold bg-black/5 hover:bg-black/10 text-[#5B5346]"
                    >
                      Tout le solde
                    </button>
                  </div>
                </div>

                {/* Choix moyen pour ce montant */}
                <div className="pt-2 border-t border-black/10 flex items-center justify-between gap-3">
                  <div className="flex gap-1.5">
                    {PAYMENT_METHODS.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setPropMethod(m.id)}
                        className={`rf-tap px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all ${
                          propMethod === m.id
                            ? "border-[#C1440E] bg-[#C1440E]/10 text-[#C1440E]"
                            : "border-black/10 bg-black/5 text-[#5B5346]"
                        }`}
                      >
                        <span>{m.emoji}</span>
                        <span>{m.label}</span>
                      </button>
                    ))}
                  </div>

                  <button
                    disabled={
                      !customAmountStr ||
                      parseFloat(customAmountStr) <= 0 ||
                      parseFloat(customAmountStr) > remainingAmount + 0.009
                    }
                    onClick={() => {
                      const amt = parseFloat(customAmountStr);
                      if (amt > 0) {
                        const numPayment = payments.length + 1;
                        addPayment(`Règlement ${numPayment}`, amt, propMethod);
                        setCustomAmountStr("");
                      }
                    }}
                    className="rf-tap px-4 py-2.5 rounded-xl text-xs font-bold text-white shadow-xs disabled:opacity-40"
                    style={{ background: "#C1440E" }}
                  >
                    Valider {customAmountStr ? `${parseFloat(customAmountStr).toFixed(2)} €` : ""}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── PIED DU MODAL / BOUTONS D'ACTION ─────────────────── */}
        <div className="px-5 py-3.5 bg-white border-t border-black/10 flex items-center justify-between gap-3">
          <button
            onClick={onCancel}
            className="rf-tap px-4 py-2.5 rounded-xl text-xs font-bold text-[#5B5346] bg-black/5 hover:bg-black/10"
          >
            Annuler
          </button>

          <div className="flex items-center gap-2">
            {mode === "single" ? (
              <button
                disabled={!singleMethod}
                onClick={handleFinalize}
                className="rf-tap px-6 py-2.5 rounded-xl text-xs font-bold text-white shadow-md disabled:opacity-40 flex items-center gap-1.5"
                style={{ background: "#2B2622" }}
              >
                <span>Confirmer le paiement ({money(total)})</span>
                <ArrowRight size={14} />
              </button>
            ) : (
              <button
                disabled={!isFullyPaid}
                onClick={handleFinalize}
                className={`rf-tap px-6 py-2.5 rounded-xl text-xs font-bold text-white shadow-md flex items-center gap-1.5 transition-all ${
                  isFullyPaid
                    ? "bg-[#2E9E5B] hover:opacity-90"
                    : "bg-[#2B2622] opacity-40 cursor-not-allowed"
                }`}
              >
                {isFullyPaid ? (
                  <>
                    <CheckCircle2 size={15} />
                    <span>Clôturer & libérer la table ({payments.length} part{payments.length > 1 ? "s" : ""})</span>
                  </>
                ) : (
                  <>
                    <span>Reste {money(remainingAmount)} à solder</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
