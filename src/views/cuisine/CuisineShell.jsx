import { useState, useMemo } from "react";
import {
  LayoutGrid, Table2, Clock, Users, CheckCircle2,
  Flame, Printer, X, BellRing, ChefHat, Wine, Layers, Volume2, Ban, Search
} from "lucide-react";
import {
  tableStatus, STATUS_META, orderKitchenStatus,
  kitchenStartTs, timerLevel, TIMER_LEVELS, formatTimer, noteIndicatesAllergy, isAvailable
} from "../../utils/index.js";
import { AllergyBadge } from "../salle/OrderTaking.jsx";
import ThermalReceiptPreview from "../../components/ThermalReceiptPreview.jsx";
import { useAudioState, useNow, useModules } from "../../hooks/index.js";

/**
 * CuisineShell — Enveloppe de la vue KDS avec support Multi-postes (Cuisine vs Bar)
 * et gestion visuelle des "Suites" & Réclames (Phase 4).
 */
export default function CuisineShell({
  view,
  setView,
  tables,
  orders,
  products,
  config = {},
  onStart,
  onReady,
  onToggleProductAvailable,
}) {
  const now = useNow();
  const { hasMultiStation } = useModules();
  const { isSuspended, unlock } = useAudioState();
  const [printOrder, setPrintOrder] = useState(null); // { order, table, defaultTab } | null
  const [showOutOfStock, setShowOutOfStock] = useState(false);
  const [stationFilter, setStationFilter] = useState(() => {
    try {
      return localStorage.getItem("rf_kds_station") || "all";
    } catch {
      return "all";
    }
  });

  const effectiveStation = hasMultiStation ? stationFilter : "all";

  const handleStationChange = (st) => {
    setStationFilter(st);
    try {
      localStorage.setItem("rf_kds_station", st);
    } catch {}
  };

  // Helper pour savoir si un item appartient au poste actif
  const isItemForStation = (item) => {
    if (!hasMultiStation || effectiveStation === "all") return true;
    const isBar = item.station === "bar" || (item.productId?.startsWith("p18") || item.productId?.startsWith("p19") || item.productId?.startsWith("p20") || item.productId?.startsWith("p21"));
    if (effectiveStation === "bar") return isBar;
    if (effectiveStation === "kitchen") return !isBar;
    return true;
  };

  // Produits du poste actif (hors menus) pour le panneau « 86 »
  const stationProducts = (products || []).filter((p) => {
    if (p.isMenu) return false;
    if (!hasMultiStation || effectiveStation === "all") return true;
    const isBar = p.station === "bar" || p.cat === "boissons";
    return effectiveStation === "bar" ? isBar : !isBar;
  });
  const outCount = stationProducts.filter((p) => !isAvailable(p)).length;

  return (
    <div className="p-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="rf-display text-2xl font-semibold text-[#F2ECDD] flex items-center gap-2">
            <span>Écran de Production (KDS)</span>
            {hasMultiStation && effectiveStation === "bar" && (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#3E7CB1]/20 text-[#3E7CB1] border border-[#3E7CB1]/40 font-mono font-bold">
                🍸 POSTE BAR
              </span>
            )}
            {hasMultiStation && effectiveStation === "kitchen" && (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#D9A441]/20 text-[#D9A441] border border-[#D9A441]/40 font-mono font-bold">
                👨‍🍳 POSTE CUISINE
              </span>
            )}
          </h1>
          <p className="text-sm text-[#9A917E]">
            {hasMultiStation && effectiveStation === "bar"
              ? "File de préparation des boissons, cocktails & cafés"
              : hasMultiStation && effectiveStation === "kitchen"
              ? "File de préparation des entrées, plats chauds & desserts"
              : "Suivi global de toutes les commandes en temps réel"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Alerte déblocage audio si suspendu par le navigateur */}
          {isSuspended && (
            <button
              onClick={() => unlock()}
              className="rf-tap flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#D9A441]/20 text-[#D9A441] border border-[#D9A441]/40 animate-pulse hover:bg-[#D9A441]/30"
              title="Cliquez pour débloquer les alertes sonores de commande sur ce terminal"
            >
              <Volume2 size={14} />
              <span>Activer les bips KDS</span>
            </button>
          )}

          {/* Dispatch Multi-postes (Phase 4 / Phase 8 Flag) */}
          {hasMultiStation && (
            <div className="flex gap-1 p-1 rounded-xl bg-white/5 border border-white/10">
              {[
                { id: "all", label: "Tous postes", icon: Layers },
                { id: "kitchen", label: "Cuisine", icon: ChefHat },
                { id: "bar", label: "Bar", icon: Wine },
              ].map((s) => {
                const Icon = s.icon;
                const active = effectiveStation === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => handleStationChange(s.id)}
                    className="rf-tap flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                    style={{
                      background: active ? "#D9A441" : "transparent",
                      color: active ? "#14110D" : "#C9C2B0",
                    }}
                  >
                    <Icon size={13} />
                    <span>{s.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Ruptures « 86 » : retirer un plat de la vente depuis la cuisine */}
          {onToggleProductAvailable && (
            <button
              onClick={() => setShowOutOfStock(true)}
              className="rf-tap flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border"
              style={{
                background: outCount ? "#C1361B33" : "rgba(255,255,255,.05)",
                borderColor: outCount ? "#C1361B" : "rgba(255,255,255,.1)",
                color: outCount ? "#FFB4A3" : "#C9C2B0",
              }}
              title="Mettre un plat en rupture ou le remettre en vente"
            >
              <Ban size={13} />
              <span>86 · Ruptures{outCount ? ` (${outCount})` : ""}</span>
            </button>
          )}

          {/* Bascule Vue Kanban / Par Table */}
          <div className="flex gap-1 p-1 rounded-full bg-white/5">
            {[
              { id: "board", label: "Commandes", icon: LayoutGrid },
              { id: "table", label: "Par table", icon: Table2 },
            ].map((t) => {
              const Icon = t.icon;
              const active = view === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setView(t.id)}
                  className="rf-tap flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium"
                  style={{
                    background: active ? "#F2ECDD" : "transparent",
                    color: active ? "#14110D" : "#C9C2B0",
                  }}
                >
                  <Icon size={14} /> {t.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {view === "board" ? (
        <KitchenBoard
          tables={tables}
          orders={orders}
          now={now}
          products={products}
          stationFilter={stationFilter}
          isItemForStation={isItemForStation}
          onStart={(orderId) => onStart(orderId, stationFilter)}
          onReady={(orderId) => onReady(orderId, stationFilter)}
          onPrintTicket={(order, table) =>
            setPrintOrder({
              order,
              table,
              defaultTab: stationFilter === "bar" ? "bar" : "cuisine",
            })
          }
        />
      ) : (
        <KitchenByTable
          tables={tables}
          orders={orders}
          now={now}
          products={products}
          stationFilter={stationFilter}
          isItemForStation={isItemForStation}
          onPrintTicket={(order, table) =>
            setPrintOrder({
              order,
              table,
              defaultTab: stationFilter === "bar" ? "bar" : "cuisine",
            })
          }
        />
      )}

      {showOutOfStock && (
        <OutOfStockPanel
          products={stationProducts}
          onToggle={onToggleProductAvailable}
          onClose={() => setShowOutOfStock(false)}
        />
      )}

      {/* Impression thermique du bon cuisine / bar */}
      {printOrder && (
        <ThermalReceiptPreview
          order={printOrder.order}
          table={printOrder.table}
          config={config}
          defaultTab={printOrder.defaultTab || "cuisine"}
          onClose={() => setPrintOrder(null)}
        />
      )}
    </div>
  );
}

/* ── Panneau des ruptures « 86 » ───────────────────────────── */

function OutOfStockPanel({ products, onToggle, onClose }) {
  const [query, setQuery] = useState("");
  const list = products
    .filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => Number(isAvailable(a)) - Number(isAvailable(b)) || a.name.localeCompare(b.name));

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Ruptures 86"
        className="w-full max-w-lg max-h-[80vh] flex flex-col rounded-2xl bg-[#1E1A15] border border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <h2 className="text-[#F2ECDD] font-semibold flex items-center gap-2"><Ban size={16} /> 86 · Ruptures</h2>
          <button onClick={onClose} className="rf-tap p-1.5 rounded-full bg-white/5 text-[#C9C2B0]" aria-label="Fermer"><X size={16} /></button>
        </div>
        <div className="px-4 py-2 border-b border-white/10 flex items-center gap-2">
          <Search size={14} className="text-[#9A917E]" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un plat…"
            aria-label="Rechercher un plat"
            className="flex-1 bg-transparent outline-none text-sm text-[#F2ECDD] placeholder:text-[#6B6355]"
          />
        </div>
        <div className="flex-1 overflow-y-auto rf-scrollbar p-2 space-y-1">
          {list.map((p) => (
            <button
              key={p.id}
              onClick={() => onToggle(p.id)}
              className="rf-tap w-full flex items-center justify-between gap-3 px-3 py-3 rounded-xl text-left hover:bg-white/5"
            >
              <span className={`text-sm font-medium ${isAvailable(p) ? "text-[#F2ECDD]" : "text-[#9A917E] line-through"}`}>
                {p.emoji || "🍽️"} {p.name}
              </span>
              <span
                className="text-[11px] font-extrabold px-2.5 py-1 rounded-full shrink-0"
                style={isAvailable(p) ? { background: "rgba(255,255,255,.08)", color: "#C9C2B0" } : { background: "#C1361B", color: "#FFF7ED" }}
              >
                {isAvailable(p) ? "Marquer 86" : "RUPTURE · Remettre"}
              </span>
            </button>
          ))}
          {list.length === 0 && <p className="text-sm text-[#9A917E] text-center py-6">Aucun produit.</p>}
        </div>
      </div>
    </div>
  );
}

/* ── Board Kanban ──────────────────────────────────────────── */

const KDS_COLS = [
  { key: "new",       title: "Nouvelles",      color: "#D9A441", icon: "🟡" },
  { key: "preparing", title: "En préparation", color: "#3E7CB1", icon: "🔵" },
  { key: "ready",     title: "Prêtes",         color: "#2E9E5B", icon: "🟢" },
];

function KitchenBoard({
  tables,
  orders,
  now,
  products,
  stationFilter,
  isItemForStation,
  onStart,
  onReady,
  onPrintTicket,
}) {
  // Filtrer les commandes qui contiennent au moins un article pour ce poste
  const relevantOrders = useMemo(() => {
    return orders.filter((o) => {
      const items = (o.items || []).filter(
        (i) => i.status !== "draft" && isItemForStation(i)
      );
      // Reste visible sur le KDS tant qu'au moins un article n'est pas encore servi
      return items.some((i) => i.status !== "served");
    });
  }, [orders, stationFilter]);

  const grouped = { new: [], preparing: [], ready: [] };
  relevantOrders.forEach((o) => {
    // Calcul de statut local pour ce poste
    const stationItems = (o.items || []).filter(
      (i) => i.status !== "draft" && i.status !== "served" && isItemForStation(i)
    );
    // Articles actifs (non en attente passive "held")
    const activeItems = stationItems.filter((i) => i.courseStatus !== "held");

    let st = "new";
    if (activeItems.length > 0) {
      if (activeItems.every((i) => i.status === "ready")) {
        st = "ready";
      } else if (activeItems.some((i) => i.status === "preparing" || i.status === "ready")) {
        st = "preparing";
      } else {
        st = "new";
      }
    } else {
      // Tous les articles restants sont en attente de réclame ("held")
      st = "new";
    }
    if (grouped[st]) grouped[st].push(o);
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4" style={{ minHeight: 520 }}>
      {KDS_COLS.map((col) => (
        <div key={col.key} className="rounded-2xl bg-white/[.03] border border-white/10 p-3 flex flex-col">
          <div className="flex items-center gap-2 mb-3 px-1">
            <span>{col.icon}</span>
            <span className="rf-black text-sm tracking-wide" style={{ color: col.color }}>{col.title}</span>
            <span className="ml-auto rf-mono text-xs text-[#9A917E]">{grouped[col.key].length}</span>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto rf-scrollbar pr-1">
            {grouped[col.key].length === 0 && (
              <p className="text-xs text-[#5B5346] text-center py-8">Aucune commande</p>
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
                  stationFilter={stationFilter}
                  isItemForStation={isItemForStation}
                  onStart={() => onStart(o.id)}
                  onReady={() => onReady(o.id)}
                  onPrint={() => onPrintTicket?.(o, table)}
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

function KitchenTicket({
  order,
  table,
  now,
  column,
  products,
  stationFilter,
  isItemForStation,
  onStart,
  onReady,
  onPrint,
}) {
  // Tous les articles de la commande pour ce poste (pour conserver le visuel complet)
  const allStationItems = (order.items || []).filter(
    (i) => i.status !== "draft" && isItemForStation(i)
  );
  // Articles non servis
  const unservedItems = allStationItems.filter((i) => i.status !== "served");
  // Articles actifs (non held)
  const activeItems = unservedItems.filter((i) => i.courseStatus !== "held");
  // En attente uniquement de réclame
  const heldOnly = unservedItems.length > 0 && activeItems.length === 0;

  const startTs = kitchenStartTs(order);
  const elapsedMs = now - startTs;
  const level = timerLevel(elapsedMs);
  const ready = column === "ready";

  // Détection des réclames actives reçues
  const calledItems = unservedItems.filter((i) => i.courseStatus === "called");
  const hasCalledSuite = calledItems.length > 0;

  return (
    <div
      className={`rf-ticket rf-anim-ticket rounded-sm shadow-lg p-3.5 ${
        level === "critical" && !ready
          ? "ring-2 ring-[#C1361B]"
          : hasCalledSuite
          ? "ring-2 ring-[#D9A441]"
          : ""
      }`}
    >
      {/* Bannière Alerte Réclame Reçue (Phase 4) */}
      {hasCalledSuite && (
        <div className="mb-2 py-1 px-2 rounded bg-[#D9A441] text-[#14110D] font-extrabold text-[11px] flex items-center justify-center gap-1.5 animate-pulse shadow-sm">
          <BellRing size={13} />
          <span>RÉCLAME REÇUE : ENVOYER LA SUITE !</span>
        </div>
      )}

      <div className="rf-mono flex items-center justify-between mb-1">
        <span className="font-bold text-sm">TABLE {table?.number ?? "?"}</span>
        <div className="flex items-center gap-2">
          {onPrint && (
            <button
              onClick={(e) => { e.stopPropagation(); onPrint(); }}
              className="p-1 rounded hover:bg-black/10 transition-colors text-black/70 hover:text-black"
              title="Imprimer bon de production"
            >
              <Printer size={13} />
            </button>
          )}
          <span className="text-[10px] opacity-60">#{order.id.slice(-4).toUpperCase()}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-2">
        <TicketTimer startTs={startTs} now={now} ready={ready} />
        <span className="rf-mono text-[11px] opacity-70">{order.server}</span>
        {level === "critical" && !ready && (
          <span className="ml-auto text-[#C1361B] font-bold flex items-center gap-0.5 text-[11px]">
            <Flame size={12} />RETARD
          </span>
        )}
        {ready && (
          <span className="ml-auto text-[#2E9E5B] font-bold flex items-center gap-1 text-[11px]">
            <CheckCircle2 size={13} />PRÊT
          </span>
        )}
      </div>

      <div className="border-t border-dashed border-black/20 my-2" />

      {/* Liste des articles avec anticipation visuelle */}
      <div className="space-y-2">
        {allStationItems.map((it) => {
          const isAllergy = noteIndicatesAllergy(it.notes);
          const product = products?.find((p) => p.id === it.productId);
          const isBarItem = it.station === "bar" || product?.cat === "boissons";
          const isServed = it.status === "served";
          const isHeld = it.courseStatus === "held" && !isServed;
          const isCalled = it.courseStatus === "called" && !isServed;
          const isPrep = it.status === "preparing";
          const isReady = it.status === "ready";

          return (
            <div
              key={it.id}
              className={`rf-mono text-[12.5px] transition-all ${
                isServed
                  ? "opacity-40 text-[#666]"
                  : isHeld
                  ? "opacity-65 bg-black/[.03] p-1.5 rounded"
                  : isCalled
                  ? "bg-[#D9A441]/10 p-1.5 rounded border border-[#D9A441]/40"
                  : ""
              }`}
            >
              {isAllergy && !isServed && <AllergyBadge item={it} product={product} compact />}

              <div className="flex items-start justify-between gap-1">
                <div className={`font-semibold leading-tight ${isServed ? "line-through" : ""}`}>
                  {/* Badge Poste si vue globale */}
                  {stationFilter === "all" && (
                    <span className="mr-1 text-[10px]">
                      {isBarItem ? "🍸" : "🍳"}
                    </span>
                  )}
                  {isServed && <span className="mr-1 text-[11px] text-[#2E9E5B] no-underline inline-block">✓</span>}
                  {it.qty} × {it.name}
                </div>

                {/* Badges d'état / Suite / Réclame */}
                {isServed && (
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-black/10 text-black/60 shrink-0 no-underline">
                    Servi
                  </span>
                )}
                {isHeld && (
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-900 border border-amber-500/30 shrink-0">
                    ⏸️ EN ATTENTE
                  </span>
                )}
                {isCalled && (
                  <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-[#D9A441] text-[#14110D] shrink-0 animate-pulse shadow-2xs">
                    🔔 RÉCLAMÉ
                  </span>
                )}
                {isPrep && !isHeld && !isCalled && (
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-900 shrink-0">
                    🔵 EN COURS
                  </span>
                )}
                {isReady && (
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-900 shrink-0">
                    🟢 PRÊT
                  </span>
                )}
              </div>

              {it.composition?.length > 0 && (
                <div className="text-[11px] opacity-80 pl-3 space-y-0.5 mt-0.5">
                  {it.composition.map((g, i) => (
                    <div key={i}>
                      • {g.title ? `${g.title} : ` : ""}
                      {Array.isArray(g.names) ? g.names.join(", ") : (g.names || "")}
                    </div>
                  ))}
                </div>
              )}

              {it.notes && !isAllergy && <div className="text-[11px] opacity-70 pl-3">↳ {it.notes}</div>}
            </div>
          );
        })}
      </div>

      <div className="border-t border-dashed border-black/20 my-2.5" />

      {column === "new" && (
        heldOnly ? (
          <div className="py-2 px-3 rounded bg-amber-500/10 border border-amber-500/25 text-center">
            <div className="text-[11px] font-bold text-amber-900 flex items-center justify-center gap-1.5">
              <span>⏸️</span>
              <span>EN ATTENTE DE RÉCLAME EN SALLE</span>
            </div>
            <div className="text-[10px] text-amber-800/80 mt-0.5">
              Anticiper la suite ci-dessus
            </div>
          </div>
        ) : (
          <button
            onClick={onStart}
            className="rf-tap w-full py-2 rounded font-bold text-xs text-white shadow-xs"
            style={{ background: "#3E7CB1" }}
          >
            {hasCalledSuite
              ? `COMMENCER LA SUITE ${stationFilter === "bar" ? "(BAR)" : stationFilter === "kitchen" ? "(CUISINE)" : ""}`
              : `COMMENCER ${stationFilter === "bar" ? "(BAR)" : stationFilter === "kitchen" ? "(CUISINE)" : ""}`}
          </button>
        )
      )}

      {column === "preparing" && (
        <button
          onClick={onReady}
          className="rf-tap w-full py-2 rounded font-bold text-xs text-white shadow-xs"
          style={{ background: "#2E9E5B" }}
        >
          PRÊT {stationFilter === "bar" ? "(BAR)" : stationFilter === "kitchen" ? "(CUISINE)" : ""}
        </button>
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

function KitchenByTable({
  tables,
  orders,
  now,
  products,
  isItemForStation,
  onPrintTicket,
}) {
  const [openId, setOpenId] = useState(null);
  const open = tables.find((t) => t.id === openId);
  const openOrder = orders.find((o) => o.tableId === openId);

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {tables.map((t) => {
          const order = orders.find((o) => o.tableId === t.id);
          const status = tableStatus(t, order);
          const meta = STATUS_META[status];

          const stationItems = order
            ? (order.items || []).filter((i) => i.status !== "draft" && isItemForStation(i))
            : [];
          const readyCount = stationItems.filter((i) => i.status === "ready").length;
          const total = stationItems.length;

          return (
            <button
              key={t.id}
              onClick={() => setOpenId(t.id)}
              className="rf-tap text-left rounded-xl bg-white/[.04] border border-white/10 p-3.5 hover:border-white/25 transition-all"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="rf-black text-base">TABLE {t.number}</span>
                <span>{meta.dot}</span>
              </div>
              <div className="text-[11px] text-[#9A917E] flex items-center gap-1 mb-1">
                <Users size={10} />{t.seats} pers.
              </div>

              {order && total > 0 ? (
                <>
                  <div className="text-xs text-[#C9C2B0]">
                    #{order.id.slice(-4).toUpperCase()} · {total} article(s)
                  </div>
                  <div className="text-xs font-semibold mt-1" style={{ color: meta.color }}>
                    {readyCount > 0 ? `${readyCount} prêt(s)` : meta.label}
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
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-6"
          onClick={() => setOpenId(null)}
        >
          <div
            className="rf-ticket rf-anim-pop rounded-sm p-5 w-full max-w-md max-h-[80vh] overflow-y-auto rf-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="rf-mono flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <span className="font-bold text-lg">TABLE {open.number}</span>
                {openOrder && (
                  <button
                    onClick={() => onPrintTicket?.(openOrder, open)}
                    className="p-1 rounded hover:bg-black/10 transition-colors text-black/70 hover:text-black flex items-center gap-1 text-xs"
                    title="Imprimer bon"
                  >
                    <Printer size={15} />
                    <span>Imprimer</span>
                  </button>
                )}
              </div>
              <button onClick={() => setOpenId(null)}><X size={18} /></button>
            </div>

            {openOrder ? (
              <>
                <div className="rf-mono text-xs opacity-70 mb-1">
                  Commande #{openOrder.id.slice(-4).toUpperCase()} · serveur {openOrder.server}
                </div>
                <div className="mb-2">
                  <TicketTimer
                    startTs={kitchenStartTs(openOrder)}
                    now={now}
                    ready={orderKitchenStatus(openOrder) === "ready"}
                  />
                </div>
                <div className="border-t border-dashed border-black/20 my-2" />
                <div className="space-y-2">
                  {(openOrder.items || [])
                    .filter((i) => i.status !== "draft" && isItemForStation(i))
                    .map((it) => {
                      const icon =
                        it.status === "served"
                          ? "✅"
                          : it.status === "ready"
                          ? "🟢"
                          : it.status === "preparing"
                          ? "🔵"
                          : "🟡";
                      const isAllergy = noteIndicatesAllergy(it.notes);
                      const product = products?.find((p) => p.id === it.productId);
                      return (
                        <div key={it.id} className="rf-mono text-[13px]">
                          {isAllergy && <AllergyBadge item={it} product={product} compact />}
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div>{icon} {it.qty} × {it.name}</div>
                              {it.composition?.length > 0 && (
                                <div className="text-[11px] opacity-80 pl-4 space-y-0.5 mt-0.5">
                                  {it.composition.map((g, i) => (
                                    <div key={i}>
                                      • {g.title ? `${g.title} : ` : ""}
                                      {Array.isArray(g.names) ? g.names.join(", ") : (g.names || "")}
                                    </div>
                                  ))}
                                </div>
                              )}
                              {it.notes && !isAllergy && (
                                <div className="text-[11px] opacity-70 pl-4">↳ {it.notes}</div>
                              )}
                            </div>
                            <span className="text-[10px] opacity-60 uppercase shrink-0">{it.status}</span>
                          </div>
                        </div>
                      );
                    })}
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
