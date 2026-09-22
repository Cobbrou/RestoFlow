import { Utensils, Volume2, VolumeX, ClipboardList, ChefHat, BarChart3, Settings, KeyRound, LogOut } from "lucide-react";
import ConnectionBadge from "./ConnectionBadge.jsx";
import { canAccessTab, getRoleName } from "../utils/permissions.js";

/**
 * Barre de navigation principale — change le rôle actif (poste de travail).
 * Filtre les onglets selon les droits RBAC de l'équipier connecté.
 */
export default function TopNav({
  role,
  setRole,
  soundOn,
  setSoundOn,
  isMobile,
  currentStaff,
  roles = [],
  onOpenPinModal,
  onLogout,
}) {
  const dark = role === "cuisine";

  const allTabs = [
    { id: "serveur",    label: "Salle",      icon: ClipboardList },
    { id: "cuisine",    label: "Cuisine",    icon: ChefHat },
    { id: "dashboard",  label: "Dashboard",  icon: BarChart3 },
    { id: "gestion",    label: "Gestion",    icon: Settings },
  ];

  const currentRoleObj = roles.find((r) => r.id === currentStaff?.roleId);

  // Filtrer les onglets accessibles par l'équipier actuel
  const visibleTabs = allTabs.filter((t) => canAccessTab(currentStaff, currentRoleObj, t.id));

  const roleLabel = getRoleName(currentStaff, roles);

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

  const staffBtn = (
    <button
      onClick={onOpenPinModal}
      className={`rf-tap flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
        currentStaff
          ? dark
            ? "bg-white/10 text-[#FAF6EE] hover:bg-white/15 border border-white/10"
            : "bg-black/5 text-[#2B2622] hover:bg-black/10 border border-black/10"
          : "bg-[#C1440E] text-white shadow-sm"
      }`}
      title="Cliquer pour changer d'équipier / saisir code PIN"
    >
      {currentStaff ? (
        <>
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ background: currentStaff.avatarBg || "#D9A441" }}
          />
          <span className="font-bold">{currentStaff.name.split(" ")[0]}</span>
          <span className="text-[10px] opacity-75 font-normal">({roleLabel})</span>
        </>
      ) : (
        <>
          <KeyRound size={12} />
          <span>S'identifier</span>
        </>
      )}
    </button>
  );

  const logoutBtn = currentStaff && (
    <button
      onClick={onLogout}
      className={`rf-tap p-2 rounded-full transition-all ${
        dark ? "bg-white/5 text-[#C9C2B0] hover:text-white" : "bg-black/5 text-[#6B6355] hover:text-[#2B2622]"
      }`}
      title="Verrouiller / Se déconnecter"
    >
      <LogOut size={14} />
    </button>
  );

  if (isMobile) {
    return (
      <div className={`border-b ${dark ? "border-white/10" : "border-black/10"}`}>
        <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5 gap-2">
          {logo}
          <div className="flex items-center gap-1.5 ml-auto">
            <ConnectionBadge dark={dark} />
            {staffBtn}
            {logoutBtn}
            {soundBtn}
          </div>
        </div>
        {visibleTabs.length > 0 && (
          <div
            className="grid gap-1 px-2 pb-2"
            style={{ gridTemplateColumns: `repeat(${visibleTabs.length}, minmax(0, 1fr))` }}
          >
            {visibleTabs.map((t) => {
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
        )}
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-between px-5 py-3 border-b ${dark ? "border-white/10" : "border-black/10"}`}>
      <div className="flex items-center gap-4">
        {logo}
        <ConnectionBadge dark={dark} />
      </div>

      {visibleTabs.length > 0 && (
        <div className={`flex gap-1 p-1 rounded-full ${dark ? "bg-white/5" : "bg-black/5"}`}>
          {visibleTabs.map((t) => {
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
      )}

      <div className="flex items-center gap-2">
        {staffBtn}
        {logoutBtn}
        {soundBtn}
      </div>
    </div>
  );
}
