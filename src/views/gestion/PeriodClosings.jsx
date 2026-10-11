import { useState, useEffect } from "react";
import { CalendarCheck, AlertTriangle } from "lucide-react";
import { money } from "../../utils/index.js";
import { getSocket } from "../../services/socket.js";

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/** "2026-10" → "octobre 2026" */
export function periodLabel(type, period) {
  return type === "YEAR" ? `année ${period}` : `${MONTHS[Number(period.slice(5, 7)) - 1]} ${period.slice(0, 4)}`;
}

/** Mois écoulé (AAAA-MM) et année écoulée (AAAA) par rapport à une date */
export function previousPeriods(now = new Date()) {
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return {
    month: `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`,
    year: String(now.getFullYear() - 1),
  };
}

/**
 * Clôtures mensuelles et annuelles NF525 : cumul signé des Z, en ajout seul.
 * Le serveur refuse un mois en cours, un mois dont des tickets n'ont pas de Z, une année dont un mois actif n'est pas clôturé.
 */
export default function PeriodClosings({ canClose, pushToast }) {
  const [periods, setPeriods] = useState([]);
  const [submitting, setSubmitting] = useState(null);

  useEffect(() => {
    const socket = getSocket();
    socket.emit("closing:get_periods", {}, (res) => res?.ok && setPeriods(res.periods));
    const onNew = (p) => setPeriods((prev) => [p, ...prev.filter((x) => x.id !== p.id)]);
    socket.on("closing:new_period", onNew);
    return () => socket.off("closing:new_period", onNew);
  }, []);

  const { month, year } = previousPeriods();
  const isClosed = (type, period) => periods.some((p) => p.type === type && p.period === period);

  const close = (type, period) => {
    if (!window.confirm(`Clôturer définitivement ${periodLabel(type, period)} ? Cette clôture est irréversible.`)) return;
    setSubmitting(`${type}-${period}`);
    getSocket()
      .timeout(15000)
      .emit("closing:close_period", { type, period }, (err, res) => {
        setSubmitting(null);
        if (err) pushToast?.("Pas de réponse du serveur", "warn");
        else if (res?.ok) pushToast?.(`Clôture ${res.closing.reportNumber} enregistrée`, "server");
        else pushToast?.(res?.error || "Clôture refusée", "warn");
      });
  };

  const actions = [
    { type: "MONTH", period: month },
    { type: "YEAR", period: year },
  ].filter((a) => !isClosed(a.type, a.period));

  return (
    <div className="space-y-5">
      {!isClosed("MONTH", month) && (
        <div className="p-3 rounded-xl text-sm font-semibold bg-amber-50 border border-amber-200 text-amber-800 flex items-center gap-2">
          <AlertTriangle size={16} /> La clôture mensuelle de {periodLabel("MONTH", month)} n'est pas encore faite.
        </div>
      )}

      {canClose && actions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {actions.map(({ type, period }) => (
            <button
              key={`${type}-${period}`}
              type="button"
              disabled={submitting !== null}
              onClick={() => close(type, period)}
              className="rf-tap flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#2B2622] text-[#FAF6EE] text-sm font-semibold disabled:opacity-50"
            >
              <CalendarCheck size={16} /> Clôturer {periodLabel(type, period)}
            </button>
          ))}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-black/10 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-[11px] uppercase text-[#8A8378] text-left">
            <tr>
              <th className="px-4 py-2.5">Clôture</th>
              <th className="px-4 py-2.5">Période</th>
              <th className="px-4 py-2.5 text-right">Z / mois</th>
              <th className="px-4 py-2.5 text-right">Tickets</th>
              <th className="px-4 py-2.5 text-right">CA net TTC</th>
              <th className="px-4 py-2.5 text-right">TVA</th>
              <th className="px-4 py-2.5 text-right">Grand Total</th>
            </tr>
          </thead>
          <tbody>
            {periods.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-[#9A917E]">Aucune clôture périodique.</td>
              </tr>
            )}
            {periods.map((p) => (
              <tr key={p.id} className="border-t border-black/5">
                <td className="px-4 py-2.5 font-semibold">{p.reportNumber}</td>
                <td className="px-4 py-2.5">
                  {periodLabel(p.type, p.period)}
                  <span className="block text-[11px] text-[#8A8378]">
                    par {p.closedBy} le {new Date(p.closedAt).toLocaleDateString("fr-FR")}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">{p.closingsCount}</td>
                <td className="px-4 py-2.5 text-right">{p.ticketsCount}</td>
                <td className="px-4 py-2.5 text-right font-semibold">{money(p.totalNet)}</td>
                <td className="px-4 py-2.5 text-right">{money(p.totalVAT)}</td>
                <td className="px-4 py-2.5 text-right">{money(p.grandTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
