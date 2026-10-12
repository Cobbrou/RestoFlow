import { useState, useMemo } from "react";
import { ClipboardList, BarChart3, Table2, Sparkles } from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell,
} from "recharts";
import { orderKitchenStatus, money } from "../../utils/index.js";
import { salesByHour, salesByServer } from "../../utils/stats.js";

/**
 * Dashboard — Tableau de bord du back-office.
 *
 * Affiche :
 *  - KPIs : CA, nombre de commandes, panier moyen, tables occupées
 *  - Graphique CA des 7 derniers jours (AreaChart)
 *  - Répartition live des commandes en cuisine (PieChart)
 *  - Top produits vendus (BarChart horizontal)
 *  - CA par heure et par serveur (sur les tickets synchronisés : 100 derniers)
 *
 * Filtre temporel : Aujourd'hui | Cette semaine | Historique complet
 */
export default function Dashboard({ history, orders, tables }) {
  const [range, setRange] = useState("today");
  const now = Date.now();
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);

  const filtered = useMemo(() => {
    if (range === "today") return history.filter((h) => h.createdAt >= dayStart.getTime());
    if (range === "week")  return history.filter((h) => h.createdAt >= now - 7 * 86400000);
    return history;
  }, [range, history]); // eslint-disable-line react-hooks/exhaustive-deps

  const ca          = filtered.reduce((s, h) => s + h.total, 0);
  const nOrders     = filtered.length;
  const panierMoyen = nOrders ? ca / nOrders : 0;
  const occupied    = tables.filter((t) => orders.some((o) => o.tableId === t.id)).length;

  // CA par jour de la semaine
  const byDay = useMemo(() => {
    const map = {};
    history.forEach((h) => {
      const d = new Date(h.createdAt);
      const key = d.toLocaleDateString("fr-FR", { weekday: "short" });
      map[key] = (map[key] || 0) + h.total;
    });
    return Object.entries(map).map(([name, ca]) => ({ name, ca: Math.round(ca) }));
  }, [history]);

  // Top produits
  const topProducts = useMemo(() => {
    const map = {};
    filtered.forEach((h) =>
      h.items.forEach((it) => { map[it.name] = (map[it.name] || 0) + it.qty; })
    );
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, qty]) => ({ name, qty }));
  }, [filtered]);

  const byHour   = useMemo(() => salesByHour(filtered), [filtered]);
  const byServer = useMemo(() => salesByServer(filtered), [filtered]);

  // Commandes en cuisine (live)
  const liveByStatus = useMemo(() => {
    const counts = { new: 0, preparing: 0, ready: 0 };
    orders.forEach((o) => {
      const s = orderKitchenStatus(o);
      if (counts[s] !== undefined) counts[s]++;
    });
    return [
      { name: "Nouvelles",       value: counts.new,       color: "#D9A441" },
      { name: "En préparation",  value: counts.preparing,  color: "#3E7CB1" },
      { name: "Prêtes",          value: counts.ready,      color: "#2E9E5B" },
    ].filter((d) => d.value > 0);
  }, [orders]);

  return (
    <div className="p-5">
      {/* En-tête + filtre */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="rf-display text-2xl font-semibold text-[#2B2622]">Tableau de bord</h1>
          <p className="text-sm text-[#6B6355]">Vue d'ensemble de l'activité du restaurant</p>
        </div>
        <div className="flex gap-1 p-1 rounded-full bg-black/5">
          {[
            { id: "today", l: "Aujourd'hui" },
            { id: "week",  l: "Cette semaine" },
            { id: "all",   l: "Historique complet" },
          ].map((o) => (
            <button key={o.id} onClick={() => setRange(o.id)}
              className="rf-tap px-3 py-1.5 rounded-full text-xs font-semibold"
              style={{ background: range === o.id ? "#2B2622" : "transparent", color: range === o.id ? "#FAF6EE" : "#5B5346" }}>
              {o.l}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <StatCard label="Chiffre d'affaires" value={money(ca)}                               icon={Sparkles} />
        <StatCard label="Commandes"           value={nOrders}                                 icon={ClipboardList} />
        <StatCard label="Panier moyen"        value={money(panierMoyen)}                      icon={BarChart3} />
        <StatCard label="Tables occupées"     value={`${occupied} / ${tables.length}`}        icon={Table2} />
      </div>

      {/* Graphiques */}
      <div className="grid grid-cols-3 gap-4">
        {/* CA 7 jours */}
        <div className="col-span-2 rounded-2xl border border-black/10 bg-white p-4">
          <p className="text-sm font-semibold text-[#2B2622] mb-2">Chiffre d'affaires (7 derniers jours)</p>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={byDay}>
              <defs>
                <linearGradient id="ca" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#C1440E" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#C1440E" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#EFE7D2" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#8A8378" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#8A8378" }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => money(v)} contentStyle={{ borderRadius: 8, border: "1px solid #EFE7D2", fontSize: 12 }} />
              <Area type="monotone" dataKey="ca" stroke="#C1440E" fill="url(#ca)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Commandes live */}
        <div className="rounded-2xl border border-black/10 bg-white p-4">
          <p className="text-sm font-semibold text-[#2B2622] mb-2">Commandes en cuisine</p>
          {liveByStatus.length === 0 ? (
            <p className="text-xs text-[#9A917E] py-10 text-center">Aucune commande active</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={liveByStatus} dataKey="value" nameKey="name" innerRadius={45} outerRadius={72} paddingAngle={3}>
                  {liveByStatus.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div className="flex flex-wrap gap-2 justify-center mt-1">
            {liveByStatus.map((d) => (
              <span key={d.name} className="text-[10px] flex items-center gap-1 text-[#5B5346]">
                <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                {d.name}
              </span>
            ))}
          </div>
        </div>

        {/* Top produits */}
        <div className="col-span-3 rounded-2xl border border-black/10 bg-white p-4">
          <p className="text-sm font-semibold text-[#2B2622] mb-2">Produits les plus vendus</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={topProducts} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EFE7D2" horizontal={false} />
              <XAxis type="number"   tick={{ fontSize: 11, fill: "#8A8378" }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11, fill: "#2B2622" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #EFE7D2", fontSize: 12 }} />
              <Bar dataKey="qty" fill="#4A7856" radius={[0, 6, 6, 0]} barSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* CA par heure */}
        <div className="col-span-2 rounded-2xl border border-black/10 bg-white p-4">
          <p className="text-sm font-semibold text-[#2B2622] mb-2">Chiffre d'affaires par heure</p>
          {byHour.length === 0 ? (
            <p className="text-xs text-[#9A917E] py-10 text-center">Aucune vente sur la période</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={byHour}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EFE7D2" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#8A8378" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#8A8378" }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v, _k, p) => [`${money(v)} · ${p.payload.tickets} ticket(s)`, "CA"]}
                  contentStyle={{ borderRadius: 8, border: "1px solid #EFE7D2", fontSize: 12 }}
                />
                <Bar dataKey="ca" fill="#C1440E" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* CA par serveur */}
        <div className="rounded-2xl border border-black/10 bg-white p-4">
          <p className="text-sm font-semibold text-[#2B2622] mb-2">Par serveur</p>
          {byServer.length === 0 ? (
            <p className="text-xs text-[#9A917E] py-10 text-center">Aucune vente sur la période</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[#8A8378] text-left">
                  <th className="py-1 font-semibold">Serveur</th>
                  <th className="py-1 font-semibold text-right">CA</th>
                  <th className="py-1 font-semibold text-right">Tickets</th>
                  <th className="py-1 font-semibold text-right">Moyen</th>
                  <th className="py-1 font-semibold text-right">Pourb.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {byServer.map((s) => (
                  <tr key={s.name}>
                    <td className="py-1.5 font-semibold text-[#2B2622]">{s.name}</td>
                    <td className="py-1.5 text-right rf-mono">{money(s.ca)}</td>
                    <td className="py-1.5 text-right">{s.tickets}</td>
                    <td className="py-1.5 text-right rf-mono">{money(s.average)}</td>
                    <td className="py-1.5 text-right rf-mono">{money(s.tips)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-[#8A8378] uppercase tracking-wide">{label}</span>
        <Icon size={15} className="text-[#C1440E]" />
      </div>
      <span className="rf-display text-2xl font-semibold text-[#2B2622]">{value}</span>
    </div>
  );
}
