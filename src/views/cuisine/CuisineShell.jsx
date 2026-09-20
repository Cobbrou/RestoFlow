import { useState } from "react";
import { LayoutGrid, Table2, Clock, Users, CheckCircle2, Flame } from "lucide-react";
import { tableStatus, STATUS_META, orderKitchenStatus, kitchenStartTs, timerLevel, TIMER_LEVELS, formatTimer, noteIndicatesAllergy } from "../../utils/index.js";
import { AllergyBadge } from "../salle/OrderTaking.jsx";
import { X } from "lucide-react";

/**
 * CuisineShell — Enveloppe de la vue cuisine avec basculement Board / Par table.
 */
export default function CuisineShell({ view, setView, tables, orders, now, products, onStart, onReady }) {
  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="rf-display text-2xl font-semibold text-[#F2ECDD]">Écran cuisine</h1>
          <p className="text-sm text-[#9A917E]">Suivi des commandes en temps réel</p>
        </div>
        <div className="flex gap-1 p-1 rounded-full bg-white/5">
          {[
            { id: "board", label: "Commandes", icon: LayoutGrid },
            { id: "table", label: "Par table",  icon: Table2 },
          ].map((t) => {
            const Icon = t.icon;
            const active = view === t.id;
            return (
              <button key={t.id} onClick={() => setView(t.id)}
                className="rf-tap flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium"
                style={{ background: active ? "#F2ECDD" : "transparent", color: active ? "#14110D" : "#C9C2B0" }}>
                <Icon size={14} /> {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {view === "board"
        ? <KitchenBoard tables={tables} orders={orders} now={now} products={products} onStart={onStart} onReady={onReady} />
        : <KitchenByTable tables={tables} orders={orders} now={now} products={products} />
      }
    </div>
  );
}

/* ── Board Kanban ──────────────────────────────────────────── */

const KDS_COLS = [
  { key: "new",       title: "Nouvelles",      color: "#D9A441", icon: "🟡" },
  { key: "preparing", title: "En préparation", color: "#3E7CB1", icon: "🔵" },
  { key: "ready",     title: "Prêtes",         color: "#2E9E5B", icon: "🟢" },
];

function KitchenBoard({ tables, orders, now, products, onStart, onReady }) {
  const grouped = { new: [], preparing: [], ready: [] };
  orders.forEach((o) => {
    const st = orderKitchenStatus(o);
    if (grouped[st]) grouped[st].push(o);
  });

  return (
    <div className="grid grid-cols-3 gap-4" style={{ minHeight: 520 }}>
      {KDS_COLS.map((col) => (
        <div key={col.key} className="rounded-2xl bg-white/[.03] border border-white/10 p-3 flex flex-col">
          <div className="flex items-center gap-2 mb-3 px-1">
            <span>{col.icon}</span>
            <span className="rf-black text-sm tracking-wide" style={{ color: col.color }}>{col.title}</span>
            <span className="ml-auto rf-mono text-xs text-[#9A917E]">{grouped[col.key].length}</span>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto rf-scrollbar pr-1">
            {grouped[col.key].length === 0 && (
              <p className="text-xs text-[#5B5346] text-center py-6">Aucune commande</p>
            )}
            {grouped[col.key].map((o) => {
              const table = tables.find((t) => t.id === o.tableId);
              return (
                <KitchenTicket
                  key={o.id}
                  order={o}
                  table={table}
                  now={now}
                  column={col.key}
                  products={products}
                  onStart={() => onStart(o.id)}
                  onReady={() => onReady(o.id)}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Timer de ticket ───────────────────────────────────────── */

function TicketTimer({ startTs, now, ready }) {
  const elapsedMs = now - startTs;
  const level = timerLevel(elapsedMs);
  const meta = TIMER_LEVELS[level];
  return (
    <span
      className={`rf-mono inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold text-[12px] ${level === "critical" && !ready ? "rf-timer-critical" : ""}`}
      style={{ background: ready ? "#2E9E5B22" : meta.bg, color: ready ? "#2E9E5B" : meta.color }}
    >
      <Clock size={11} /> {formatTimer(elapsedMs)}
    </span>
  );
}

/* ── Ticket cuisine ────────────────────────────────────────── */

function KitchenTicket({ order, table, now, column, products, onStart, onReady }) {
  const visibleItems = order.items.filter((i) => i.status !== "draft" && i.status !== "served");
  const startTs = kitchenStartTs(order);
  const elapsedMs = now - startTs;
  const level = timerLevel(elapsedMs);
  const ready = column === "ready";

  return (
    <div className={`rf-ticket rf-anim-ticket rounded-sm shadow-lg p-3.5 ${level === "critical" && !ready ? "ring-2 ring-[#C1361B]" : ""}`}>
      <div className="rf-mono flex items-center justify-between mb-1">
        <span className="font-bold text-sm">TABLE {table?.number ?? "?"}</span>
        <span className="text-[10px] opacity-60">#{order.id.slice(-4).toUpperCase()}</span>
      </div>
      <div className="flex items-center gap-2 mb-2">
        <TicketTimer startTs={startTs} now={now} ready={ready} />
        <span className="rf-mono text-[11px] opacity-70">{order.server}</span>
        {level === "critical" && !ready && (
          <span className="ml-auto text-[#C1361B] font-bold flex items-center gap-0.5 text-[11px]"><Flame size={12} />RETARD</span>
        )}
        {ready && (
          <span className="ml-auto text-[#2E9E5B] font-bold flex items-center gap-1 text-[11px]"><CheckCircle2 size={13} />PRÊT</span>
        )}
      </div>
      <div className="border-t border-dashed border-black/20 my-2" />
      <div className="space-y-1.5">
        {visibleItems.map((it) => {
          const isAllergy = noteIndicatesAllergy(it.notes);
          const product = products?.find((p) => p.id === it.productId);
          return (
            <div key={it.id} className="rf-mono text-[12.5px]">
              {isAllergy && <AllergyBadge item={it} product={product} compact />}
              <div className="font-semibold">{it.qty} × {it.name}</div>
              {it.notes && !isAllergy && <div className="text-[11px] opacity-70 pl-3">↳ {it.notes}</div>}
            </div>
          );
        })}
      </div>
      <div className="border-t border-dashed border-black/20 my-2.5" />
      {column === "new" && (
        <button onClick={onStart} className="rf-tap w-full py-2 rounded font-bold text-xs text-white" style={{ background: "#3E7CB1" }}>COMMENCER</button>
      )}
      {column === "preparing" && (
        <button onClick={onReady} className="rf-tap w-full py-2 rounded font-bold text-xs text-white" style={{ background: "#2E9E5B" }}>PRÊT</button>
      )}
      {column === "ready" && (
        <div className="text-center text-[11px] font-semibold text-[#2E9E5B] flex items-center justify-center gap-1">
          <CheckCircle2 size={13} /> En attente du serveur
        </div>
      )}
    </div>
  );
}

/* ── Vue par table ─────────────────────────────────────────── */

function KitchenByTable({ tables, orders, now, products }) {
  const [openId, setOpenId] = useState(null);
  const open = tables.find((t) => t.id === openId);
  const openOrder = orders.find((o) => o.tableId === openId);

  return (
    <div>
      <div className="grid grid-cols-4 gap-3">
        {tables.map((t) => {
          const order = orders.find((o) => o.tableId === t.id);
          const status = tableStatus(t, order);
          const meta = STATUS_META[status];
          const readyCount = order ? order.items.filter((i) => i.status === "ready").length : 0;
          const total = order ? order.items.filter((i) => i.status !== "draft").length : 0;
          return (
            <button key={t.id} onClick={() => setOpenId(t.id)}
              className="rf-tap text-left rounded-xl bg-white/[.04] border border-white/10 p-3.5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="rf-black text-base">TABLE {t.number}</span>
                <span>{meta.dot}</span>
              </div>
              <div className="text-[11px] text-[#9A917E] flex items-center gap-1 mb-1"><Users size={10} />{t.seats} pers.</div>
              {order ? (
                <>
                  <div className="text-xs text-[#C9C2B0]">#{order.id.slice(-4).toUpperCase()} · {total} produit(s)</div>
                  <div className="text-xs font-semibold mt-1" style={{ color: meta.color }}>
                    {readyCount > 0 ? `${readyCount} produit(s) prêt(s)` : meta.label}
                  </div>
                </>
              ) : (
                <div className="text-xs text-[#5B5346] mt-1">{meta.label}</div>
              )}
            </button>
          );
        })}
      </div>

      {open && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-6" onClick={() => setOpenId(null)}>
          <div className="rf-ticket rf-anim-pop rounded-sm p-5 w-full max-w-md max-h-[80vh] overflow-y-auto rf-scrollbar" onClick={(e) => e.stopPropagation()}>
            <div className="rf-mono flex items-center justify-between mb-2">
              <span className="font-bold text-lg">TABLE {open.number}</span>
              <button onClick={() => setOpenId(null)}><X size={18} /></button>
            </div>
            {openOrder ? (
              <>
                <div className="rf-mono text-xs opacity-70 mb-1">Commande #{openOrder.id.slice(-4).toUpperCase()} · serveur {openOrder.server}</div>
                <div className="mb-2">
                  <TicketTimer startTs={kitchenStartTs(openOrder)} now={now} ready={orderKitchenStatus(openOrder) === "ready"} />
                </div>
                <div className="border-t border-dashed border-black/20 my-2" />
                <div className="space-y-2">
                  {openOrder.items.filter((i) => i.status !== "draft").map((it) => {
                    const icon = it.status === "served" ? "✅" : it.status === "ready" ? "🟢" : it.status === "preparing" ? "🔵" : "🟡";
                    const isAllergy = noteIndicatesAllergy(it.notes);
                    const product = products?.find((p) => p.id === it.productId);
                    return (
                      <div key={it.id} className="rf-mono text-[13px]">
                        {isAllergy && <AllergyBadge item={it} product={product} compact />}
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div>{icon} {it.qty} × {it.name}</div>
                            {it.notes && !isAllergy && <div className="text-[11px] opacity-70 pl-4">↳ {it.notes}</div>}
                          </div>
                          <span className="text-[10px] opacity-60 uppercase shrink-0">{it.status}</span>
                        </div>
                      </div>
                    );
                  })}
                  {openOrder.items.filter((i) => i.status === "draft").length > 0 && (
                    <div className="text-[11px] opacity-50 pt-1">
                      + {openOrder.items.filter((i) => i.status === "draft").length} article(s) pas encore envoyés
                    </div>
                  )}
                </div>
              </>
            ) : (
              <p className="rf-mono text-sm opacity-60 py-4">Aucune commande active pour cette table.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
