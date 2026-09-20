import { Utensils, Volume2, VolumeX, ClipboardList, ChefHat, BarChart3, Settings } from "lucide-react";

/**
 * Barre de navigation principale — change le rôle actif (poste de travail).
 *
 * Postes disponibles :
 *  - serveur   → Plan de salle + prise de commande
 *  - cuisine   → KDS (Écran cuisine)
 *  - dashboard → Tableau de bord
 *  - gestion   → Back-office (tables, produits, menus)
 */
export default function TopNav({ role, setRole, soundOn, setSoundOn, isMobile }) {
  const dark = role === "cuisine";

  const tabs = [
    { id: "serveur",    label: "Salle",      icon: ClipboardList },
    { id: "cuisine",    label: "Cuisine",    icon: ChefHat },
    { id: "dashboard",  label: "Dashboard",  icon: BarChart3 },
    { id: "gestion",    label: "Gestion",    icon: Settings },
  ];

  const logo = (
    <div className="flex items-center gap-2">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "#C1440E" }}>
        <Utensils size={16} color="#FAF6EE" />
      </div>
      <span className={`rf-display text-lg font-semibold tracking-tight ${dark ? "text-[#F2ECDD]" : "text-[#2B2622]"}`}>
        RestoFlow
      </span>
    </div>
  );

  const soundBtn = (
    <button
      onClick={() => setSoundOn((s) => !s)}
      className={`rf-tap p-2 rounded-full ${dark ? "bg-white/5 text-[#F2ECDD]" : "bg-black/5 text-[#2B2622]"}`}
      title="Son des notifications"
    >
      {soundOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
    </button>
  );

  if (isMobile) {
    return (
      <div className={`border-b ${dark ? "border-white/10" : "border-black/10"}`}>
        <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5">
          {logo}
          {soundBtn}
        </div>
        <div className="grid grid-cols-4 gap-1 px-2 pb-2">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = role === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setRole(t.id)}
                className="rf-tap flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-xl text-[10px] font-semibold"
                style={{
                  background: active ? (dark ? "#F2ECDD" : "#2B2622") : (dark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.05)"),
                  color:      active ? (dark ? "#14110D" : "#FAF6EE") : (dark ? "#C9C2B0" : "#5B5346"),
                }}
              >
                <Icon size={16} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-between px-5 py-3 border-b ${dark ? "border-white/10" : "border-black/10"}`}>
      {logo}
      <div className={`flex gap-1 p-1 rounded-full ${dark ? "bg-white/5" : "bg-black/5"}`}>
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = role === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setRole(t.id)}
              className={`rf-tap flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium ${active ? "shadow-sm" : ""}`}
              style={{
                background: active ? (dark ? "#F2ECDD" : "#2B2622") : "transparent",
                color:      active ? (dark ? "#14110D" : "#FAF6EE") : (dark ? "#C9C2B0" : "#5B5346"),
              }}
            >
              <Icon size={14} />
              {t.label}
            </button>
          );
        })}
      </div>
      {soundBtn}
    </div>
  );
}
