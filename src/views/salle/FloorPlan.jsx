import { useState } from "react";
import { useNow } from "../../hooks/index.js";
import { Users, Clock, Lock, CalendarClock, ArrowRightLeft, ShoppingBag, Plus, Phone } from "lucide-react";
import { tableStatus, STATUS_META, orderTotal, elapsed, isOffPremise, orderLabel, formatPickup } from "../../utils/index.js";
import Modal from "../../components/Modal.jsx";
import { useModules } from "../../hooks/useModules.js";

/**
 * FloorPlan — Plan de salle interactif.
 *
 * Mode desktop : tables positionnées librement sur un fond quadrillé (en %).
 * Mode mobile  : grille 2 colonnes de cartes.
 *
 * Interactions :
 *  - Clic sur une table → ouvre sa commande (onOpen)
 *  - Clic droit / appui long → bascule l'alerte (onToggleAlert)
 *  - Bouton réservations → ouvre la gestion des créneaux & widget
 */
export default function FloorPlan({
  tables,
  orders,
  reservations = [],
  onOpen,
  onOpenOffPremise,
  onToggleAlert,
  onOpenReservations,
  onOpenTableAction,
  isMobile,
}) {
  const now = useNow();
  const { hasReservations, hasTakeaway } = useModules();
  const takeaway = hasTakeaway && onOpenOffPremise && <TakeawayBar orders={orders} onOpen={onOpenOffPremise} />;
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayReservations = reservations.filter((r) => r.date === todayStr && r.status !== "cancelled");

  if (isMobile) {
    return (
      <div className="p-3">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="rf-display text-xl font-semibold text-[#2B2622]">Plan de salle</h1>
            <p className="text-xs text-[#6B6355]">Touchez une table pour ouvrir sa commande</p>
          </div>
          {hasReservations && onOpenReservations && (
            <button
              onClick={onOpenReservations}
              className="rf-tap flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-black/15 bg-white text-xs font-bold text-[#5B5346] shadow-2xs"
            >
              <CalendarClock size={14} className="text-[#C1440E]" />
              <span>Résas ({todayReservations.length})</span>
            </button>
          )}
        </div>

        {takeaway}

        {/* Légende défilable */}
        <div className="flex gap-1.5 overflow-x-auto rf-scrollbar pb-3 -mx-3 px-3">
          {Object.entries(STATUS_META).map(([k, v]) => (
            <span key={k} className="text-[10px] whitespace-nowrap px-2 py-1 rounded-full bg-black/5 text-[#5B5346]">
              {v.dot} {v.label}
            </span>
          ))}
        </div>

        {/* Grille de tables */}
        <div className="grid grid-cols-2 gap-2.5">
          {tables.map((t) => {
            const order  = orders.find((o) => o.tableId === t.id);
            const status = tableStatus(t, order);
            const meta   = STATUS_META[status];
            const readyCount = order ? order.items.filter((i) => i.status === "ready").length : 0;

            return (
              <button
                key={t.id}
                onClick={() => onOpen(t)}
                onContextMenu={(e) => { e.preventDefault(); onToggleAlert(t.id); }}
                className={`rf-tap relative text-left rounded-2xl border-2 bg-white p-3 min-h-[104px] flex flex-col ${status === "alert" ? "rf-flash-alert" : ""} ${status === "ready" ? "rf-pulse-ready" : ""}`}
                style={{ borderColor: meta.color }}
              >
                {hasReservations && t.reserved && (
                  <span className="absolute -top-2 -right-2 flex items-center gap-0.5 text-[8px] font-extrabold px-1.5 py-0.5 rounded-full shadow" style={{ background: "#5B5346", color: "#FAF6EE" }}>
                    <Lock size={8} /> RÉSERVÉE
                  </span>
                )}
                <div className="flex items-center justify-between">
                  <span className="rf-black text-xl leading-none text-[#2B2622]">{t.number}</span>
                  <span className="text-base">{meta.dot}</span>
                </div>
                <span className="text-[11px] text-[#8A8378] flex items-center gap-1 mt-1">
                  <Users size={11} />{t.seats} pers.
                </span>
                {hasReservations && t.reserved && t.reservationTime && (
                  <span className="text-[10px] text-[#5B5346] flex items-center gap-1">
                    <CalendarClock size={10} />
                    {t.reservationName || "Réservation"} · {t.reservationTime}
                  </span>
                )}
                <span className="text-[11px] font-semibold mt-auto pt-1.5" style={{ color: meta.color }}>
                  {readyCount > 0 ? `${readyCount} prêt(s)` : meta.label}
                </span>
                {order && orderTotal(order) > 0 && (
                  <span className="text-[11px] font-bold text-[#2B2622]">
                    {orderTotal(order).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} € · {elapsed(order.createdAt, now)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <p className="text-[10px] text-[#9A917E] text-center mt-3">Appui long sur une table pour signaler un problème</p>
      </div>
    );
  }

  return (
    <div className="p-5">
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <h1 className="rf-display text-2xl font-semibold text-[#2B2622]">Plan de salle</h1>
          <p className="text-sm text-[#6B6355]">Sélectionnez une table pour prendre ou consulter une commande</p>
        </div>
        <div className="flex items-center gap-3">
          {hasReservations && onOpenReservations && (
            <button
              onClick={onOpenReservations}
              className="rf-tap flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-black/15 bg-white hover:bg-black/5 text-xs font-bold text-[#5B5346] shadow-2xs"
            >
              <CalendarClock size={15} className="text-[#C1440E]" />
              <span>Réservations ({todayReservations.length})</span>
            </button>
          )}
          <Legend />
        </div>
      </div>

      {takeaway}

      {/* Plateau */}
      <div
        className="relative rounded-2xl border border-[#E4DAC6]"
        style={{ height: 560, background: "repeating-linear-gradient(45deg,#F3EDDD,#F3EDDD 22px,#EFE7D2 22px,#EFE7D2 44px)" }}
      >
        {tables.map((t) => {
          const order  = orders.find((o) => o.tableId === t.id);
          const status = tableStatus(t, order);
          const meta   = STATUS_META[status];
          const size   = t.seats <= 2 ? 78 : t.seats <= 4 ? 96 : 118;
          const shape  = t.seats <= 4 ? "9999px" : "20px";
          const total  = order ? orderTotal(order) : 0;

          return (
            <button
              key={t.id}
              onClick={() => onOpen(t)}
              onContextMenu={(e) => { e.preventDefault(); onToggleAlert(t.id); }}
              title={hasReservations && t.reserved
                ? `Réservée${t.reservationName ? " — " + t.reservationName : ""}${t.reservationTime ? " à " + t.reservationTime : ""}`
                : "Clic droit : signaler / lever une alerte"}
              className={`rf-tap absolute flex flex-col items-center justify-center border-2 shadow-md ${status === "alert" ? "rf-flash-alert" : ""} ${status === "ready" ? "rf-pulse-ready" : ""}`}
              style={{
                left: `${t.x}%`, top: `${t.y}%`,
                width: size, height: size,
                borderRadius: shape,
                background: "#FFFDF7",
                borderColor: meta.color,
                transform: "translate(-50%, -50%)",
              }}
            >
              <span className="rf-black text-lg leading-none text-[#2B2622]">{t.number}</span>
              <span className="text-[10px] text-[#8A8378] flex items-center gap-0.5 mt-0.5">
                <Users size={10} />{t.seats}
              </span>

              {/* Dot statut */}
              <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center text-[10px]" style={{ background: meta.color }}>
                <span style={{ filter: "grayscale(1) brightness(3)" }}>●</span>
              </span>

              {/* Badge réservation */}
              {hasReservations && t.reserved && (
                <span className="absolute -top-2 -left-2 flex items-center gap-0.5 text-[8px] font-extrabold px-1.5 py-0.5 rounded-full shadow whitespace-nowrap" style={{ background: "#5B5346", color: "#FAF6EE" }}>
                  <Lock size={8} /> RÉSERVÉE
                </span>
              )}

              {/* Montant */}
              {total > 0 && (
                <span className="absolute -bottom-6 text-[11px] font-semibold text-[#5B5346] whitespace-nowrap">
                  {total.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
                </span>
              )}

              {/* Heure ou réservation */}
              {order?.createdAt ? (
                <span className="absolute -bottom-[38px] text-[9px] text-[#9A917E] whitespace-nowrap flex items-center gap-0.5">
                  <Clock size={8} />{elapsed(order.createdAt, now)}
                </span>
              ) : (
                !order && t.reserved && (t.reservationName || t.reservationTime) ? (
                  <span className="absolute -bottom-[38px] text-[9px] text-[#5B5346] whitespace-nowrap flex items-center gap-0.5 font-semibold">
                    <CalendarClock size={8} />
                    {t.reservationName || "Réservée"}{t.reservationTime ? ` · ${t.reservationTime}` : ""}
                  </span>
                ) : null
              )}

              {order && onOpenTableAction && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenTableAction(t);
                  }}
                  title="Transférer ou fusionner cette table"
                  className="absolute -top-2 -left-2 w-5 h-5 rounded-full bg-white border border-black/20 hover:border-[#C1440E] flex items-center justify-center text-[#5B5346] hover:text-[#C1440E] shadow-sm z-10"
                >
                  <ArrowRightLeft size={10} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex gap-3 flex-wrap text-xs text-[#5B5346]">
      {Object.entries(STATUS_META).map(([k, v]) => (
        <span key={k} className="flex items-center gap-1">
          <span>{v.dot}</span>{v.label}
        </span>
      ))}
    </div>
  );
}

/* ── Vente à emporter : commandes hors salle ouvertes + création ── */
function TakeawayBar({ orders, onOpen }) {
  const [creating, setCreating] = useState(false);
  const open = orders
    .filter(isOffPremise)
    .sort((a, b) => (a.pickupAt ?? Infinity) - (b.pickupAt ?? Infinity) || (a.pickupNumber ?? 0) - (b.pickupNumber ?? 0));

  return (
    <div className="flex items-center gap-2 overflow-x-auto rf-scrollbar pb-3 mb-1">
      <button
        onClick={() => setCreating(true)}
        className="rf-tap shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white shadow-sm"
        style={{ background: "#0891B2" }}
      >
        <ShoppingBag size={14} /> <Plus size={12} /> Emporter
      </button>
      {open.map((o) => {
        const ready = o.items.some((i) => i.status === "ready");
        return (
          <button
            key={o.id}
            onClick={() => onOpen(o)}
            className={`rf-tap shrink-0 text-left px-3 py-1.5 rounded-xl border-2 bg-white ${ready ? "rf-pulse-ready" : ""}`}
            style={{ borderColor: ready ? "#2E9E5B" : "#0891B240" }}
          >
            <span className="block text-xs font-bold text-[#2B2622] whitespace-nowrap">{orderLabel(o)}</span>
            <span className="block text-[10px] text-[#6B6355] whitespace-nowrap">
              {o.pickupAt ? `Retrait ${formatPickup(o.pickupAt)}` : "Dès que prêt"}
              {o.channel === "phone" && " · Tél."}
              {ready ? " · Prête" : ""}
            </span>
          </button>
        );
      })}
      {creating && (
        <NewTakeawayModal
          onCancel={() => setCreating(false)}
          onConfirm={(data) => { setCreating(false); onOpen(data); }}
        />
      )}
    </div>
  );
}

function NewTakeawayModal({ onCancel, onConfirm }) {
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [pickupTime, setPickupTime] = useState(""); // "HH:mm", vide = dès que prêt
  const [byPhone, setByPhone] = useState(false);

  const submit = (e) => {
    e.preventDefault();
    let pickupAt = null;
    if (pickupTime) {
      const [h, m] = pickupTime.split(":").map(Number);
      pickupAt = new Date().setHours(h, m, 0, 0);
    }
    onConfirm({ type: "takeaway", channel: byPhone ? "phone" : "pos", customerName, customerPhone, pickupAt });
  };

  const input = "w-full px-3 py-2 rounded-xl border border-black/15 bg-white text-sm";
  return (
    <Modal title="Nouvelle commande à emporter" onClose={onCancel}>
      <form onSubmit={submit} className="space-y-3">
        <label className="block text-xs font-semibold text-[#5B5346]">
          Nom du client
          <input className={input} value={customerName} onChange={(e) => setCustomerName(e.target.value)} maxLength={60} autoFocus />
        </label>
        <label className="block text-xs font-semibold text-[#5B5346]">
          Heure de retrait (vide : dès que prête)
          <input type="time" className={input} value={pickupTime} onChange={(e) => setPickupTime(e.target.value)} />
        </label>
        <label className="flex items-center gap-2 text-xs font-semibold text-[#5B5346]">
          <input type="checkbox" checked={byPhone} onChange={(e) => setByPhone(e.target.checked)} />
          <Phone size={12} /> Commande prise par téléphone
        </label>
        {byPhone && (
          <label className="block text-xs font-semibold text-[#5B5346]">
            Téléphone
            <input type="tel" className={input} value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} maxLength={30} />
          </label>
        )}
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onCancel} className="rf-tap flex-1 py-2.5 rounded-xl text-xs font-semibold bg-black/5">Annuler</button>
          <button type="submit" className="rf-tap flex-1 py-2.5 rounded-xl text-xs font-bold text-white" style={{ background: "#0891B2" }}>
            Prendre la commande
          </button>
        </div>
      </form>
    </Modal>
  );
}
