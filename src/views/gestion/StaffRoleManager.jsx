import { useState, useMemo, useEffect } from "react";
import {
  Users,
  ShieldCheck,
  Plus,
  Pencil,
  Trash2,
  KeyRound,
  Phone,
  Mail,
  SlidersHorizontal,
  Check,
  Sparkles,
  Clock,
} from "lucide-react";
import Modal, { Field, inputCls } from "../../components/Modal.jsx";
import { PERMISSION_MODULES, ALL_PERMISSIONS } from "../../data/staff.js";
import { getSocket } from "../../services/socket.js";
import { hoursByStaff, formatMinutes } from "../../utils/stats.js";

const PRESET_COLORS = [
  "#C1440E", // RestoFlow Rust
  "#3E7CB1", // Blue
  "#D9A441", // Amber
  "#4A7856", // Forest Green
  "#8B5A2B", // Warm Brown
  "#6B5B95", // Purple
  "#2B2622", // Slate Black
  "#D9534F", // Crimson
];

export default function StaffRoleManager({
  staff = [],
  roles = [],
  onAddStaff,
  onUpdateStaff,
  onDeleteStaff,
  onAddRole,
  onUpdateRole,
  onDeleteRole,
}) {
  const [subTab, setSubTab] = useState("staff"); // staff | roles | matrix | hours
  const [editingStaff, setEditingStaff] = useState(null); // null | 'new' | staffObject
  const [editingRole, setEditingRole] = useState(null);   // null | 'new' | roleObject
  const [filterRoleId, setFilterRoleId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  // Filtrage du personnel
  const filteredStaff = useMemo(() => {
    return staff.filter((s) => {
      const matchRole = !filterRoleId || s.roleId === filterRoleId;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        s.name.toLowerCase().includes(q) ||
        (s.email && s.email.toLowerCase().includes(q)) ||
        (s.phone && s.phone.includes(q));
      return matchRole && matchSearch;
    });
  }, [staff, filterRoleId, searchQuery]);

  // Statistiques rapides
  const activeCount = staff.filter((s) => s.active).length;

  return (
    <div>
      {/* En-tête des sous-onglets */}
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <div className="flex gap-1.5 p-1 rounded-xl bg-black/5">
          <button
            onClick={() => setSubTab("staff")}
            className="rf-tap flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold"
            style={{
              background: subTab === "staff" ? "#2B2622" : "transparent",
              color: subTab === "staff" ? "#FAF6EE" : "#5B5346",
            }}
          >
            <Users size={14} /> Personnel ({staff.length})
          </button>
          <button
            onClick={() => setSubTab("roles")}
            className="rf-tap flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold"
            style={{
              background: subTab === "roles" ? "#2B2622" : "transparent",
              color: subTab === "roles" ? "#FAF6EE" : "#5B5346",
            }}
          >
            <ShieldCheck size={14} /> Rôles & Permissions ({roles.length})
          </button>
          <button
            onClick={() => setSubTab("matrix")}
            className="rf-tap flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold"
            style={{
              background: subTab === "matrix" ? "#2B2622" : "transparent",
              color: subTab === "matrix" ? "#FAF6EE" : "#5B5346",
            }}
          >
            <SlidersHorizontal size={14} /> Matrice des droits
          </button>
          <button
            onClick={() => setSubTab("hours")}
            className="rf-tap flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold"
            style={{
              background: subTab === "hours" ? "#2B2622" : "transparent",
              color: subTab === "hours" ? "#FAF6EE" : "#5B5346",
            }}
          >
            <Clock size={14} /> Heures pointées
          </button>
        </div>

        {subTab === "staff" && (
          <button
            onClick={() => setEditingStaff("new")}
            className="rf-tap flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: "#C1440E" }}
          >
            <Plus size={15} /> Ajouter un collaborateur
          </button>
        )}

        {subTab === "roles" && (
          <button
            onClick={() => setEditingRole("new")}
            className="rf-tap flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: "#C1440E" }}
          >
            <Plus size={15} /> Créer un rôle
          </button>
        )}
      </div>

      {subTab === "hours" && <ShiftHours staff={staff} />}

      {/* ─── VUE 1 : PERSONNEL & AFFECTATIONS ─── */}
      {subTab === "staff" && (
        <div>
          {/* Cartes KPI */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="rounded-xl border border-black/10 bg-white p-3.5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#C1440E15", color: "#C1440E" }}>
                <Users size={18} />
              </div>
              <div>
                <p className="text-xs text-[#8A8378]">Effectif total</p>
                <p className="text-lg font-bold text-[#2B2622]">{staff.length} personnes</p>
              </div>
            </div>

            <div className="rounded-xl border border-black/10 bg-white p-3.5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#2E9E5B15", color: "#2E9E5B" }}>
                <Check size={18} />
              </div>
              <div>
                <p className="text-xs text-[#8A8378]">En service (actifs)</p>
                <p className="text-lg font-bold text-[#2E9E5B]">{activeCount} actifs</p>
              </div>
            </div>

            <div className="rounded-xl border border-black/10 bg-white p-3.5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#3E7CB115", color: "#3E7CB1" }}>
                <ShieldCheck size={18} />
              </div>
              <div>
                <p className="text-xs text-[#8A8378]">Rôles définis</p>
                <p className="text-lg font-bold text-[#2B2622]">{roles.length} profils</p>
              </div>
            </div>
          </div>

          {/* Barre de recherche et filtres de rôles */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <div className="flex-1 min-w-[220px] flex items-center gap-2 bg-black/5 rounded-xl px-3 py-2">
              <Users size={14} className="text-[#8A8378]" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher par nom, e-mail, téléphone…"
                className="bg-transparent outline-none text-sm flex-1 placeholder:text-[#9A917E]"
              />
            </div>
            <div className="flex gap-1 flex-wrap">
              <button
                onClick={() => setFilterRoleId(null)}
                className="rf-tap px-3 py-1.5 rounded-full text-xs font-semibold"
                style={{
                  background: filterRoleId === null ? "#2B2622" : "rgba(0,0,0,.05)",
                  color: filterRoleId === null ? "#FAF6EE" : "#5B5346",
                }}
              >
                Tous ({staff.length})
              </button>
              {roles.map((r) => {
                const count = staff.filter((s) => s.roleId === r.id).length;
                const active = filterRoleId === r.id;
                return (
                  <button
                    key={r.id}
                    onClick={() => setFilterRoleId(r.id)}
                    className="rf-tap px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5"
                    style={{
                      background: active ? r.color : "rgba(0,0,0,.05)",
                      color: active ? "#FAF6EE" : "#5B5346",
                    }}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ background: active ? "#FAF6EE" : r.color }} />
                    {r.name} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Grille du personnel */}
          {filteredStaff.length === 0 ? (
            <div className="text-center py-12 rounded-xl border border-black/10 bg-white">
              <Users size={32} className="mx-auto mb-2 text-[#9A917E]" />
              <p className="text-sm font-semibold text-[#2B2622]">Aucun collaborateur trouvé</p>
              <p className="text-xs text-[#8A8378] mt-1">Modifiez vos filtres ou ajoutez un nouveau membre d'équipe.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3.5">
              {filteredStaff.map((member) => {
                const role = roles.find((r) => r.id === member.roleId);
                const roleColor = role?.color || "#5B5346";

                // Initiales
                const initials = member.name
                  .split(" ")
                  .map((p) => p[0])
                  .filter(Boolean)
                  .slice(0, 2)
                  .join("")
                  .toUpperCase();

                return (
                  <div
                    key={member.id}
                    className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm flex flex-col justify-between hover:border-black/25 transition-all"
                  >
                    <div>
                      {/* Ligne haute : Avatar + Nom + Boutons actions */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className="w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-sm text-white shrink-0 shadow-sm"
                            style={{ background: roleColor }}
                          >
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="text-base font-bold text-[#2B2622] truncate">{member.name}</h3>
                              <span
                                className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase shrink-0"
                                style={{
                                  background: member.active ? "#4A785620" : "#C1361B20",
                                  color: member.active ? "#4A7856" : "#C1361B",
                                }}
                              >
                                {member.active ? "Actif" : "Inactif"}
                              </span>
                            </div>

                            {/* Affectation rapide du rôle */}
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[11px] text-[#8A8378]">Rôle :</span>
                              <select
                                value={member.roleId}
                                onChange={(e) => onUpdateStaff(member.id, { roleId: e.target.value })}
                                className="text-xs font-semibold rounded-lg px-2 py-0.5 border border-black/10 outline-none cursor-pointer"
                                style={{ color: roleColor, background: `${roleColor}12` }}
                              >
                                {roles.map((r) => (
                                  <option key={r.id} value={r.id}>
                                    {r.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-1 shrink-0">
                          <button
                            onClick={() => setEditingStaff(member)}
                            className="rf-tap p-1.5 rounded-full bg-black/5 hover:bg-black/10"
                            title="Modifier ce membre"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Confirmer la suppression de ${member.name} de l'équipe ?`)) {
                                onDeleteStaff(member.id);
                              }
                            }}
                            className="rf-tap p-1.5 rounded-full bg-black/5 hover:bg-[#C1361B15] text-[#C1361B]"
                            title="Supprimer ce membre"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Coordonnées & Code PIN */}
                      <div className="space-y-1.5 text-xs text-[#5B5346] bg-black/[.02] p-2.5 rounded-xl border border-black/5">
                        {member.email && (
                          <div className="flex items-center gap-2">
                            <Mail size={12} className="text-[#8A8378] shrink-0" />
                            <span className="truncate">{member.email}</span>
                          </div>
                        )}
                        {member.phone && (
                          <div className="flex items-center gap-2">
                            <Phone size={12} className="text-[#8A8378] shrink-0" />
                            <span>{member.phone}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between pt-1 border-t border-black/5">
                          <div className="flex items-center gap-1.5">
                            <KeyRound size={12} className="text-[#8A8378]" />
                            <span className="text-[11px] text-[#8A8378]">Code PIN terminal :</span>
                            <span className="rf-mono font-bold tracking-widest text-[#2B2622] ml-1">
                              ••••
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Ligne basse : Toggle statut d'activité */}
                    <div className="mt-3 pt-2.5 border-t border-black/5 flex items-center justify-between text-xs">
                      <span className="text-[#8A8378]">
                        Permissions : <strong>{role?.permissions?.length || 0}</strong> accordée(s)
                      </span>
                      <button
                        onClick={() => onUpdateStaff(member.id, { active: !member.active })}
                        className="rf-tap font-semibold text-[11px]"
                        style={{ color: member.active ? "#C1440E" : "#2E9E5B" }}
                      >
                        {member.active ? "Désactiver le compte" : "Activer le compte"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── VUE 2 : RÔLES & PERMISSIONS ─── */}
      {subTab === "roles" && (
        <div className="space-y-3.5">
          <div className="grid grid-cols-1 gap-3.5">
            {roles.map((r) => {
              const assignedMembers = staff.filter((s) => s.roleId === r.id);
              const permsCount = r.permissions?.length || 0;
              const totalPerms = ALL_PERMISSIONS.length;
              const permPercent = Math.round((permsCount / totalPerms) * 100);

              return (
                <div key={r.id} className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 font-bold"
                        style={{ background: r.color }}
                      >
                        <ShieldCheck size={20} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-[#2B2622]">{r.name}</h3>
                          {r.isSystem && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/5 text-[#5B5346]">
                              Système
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#8A8378]">{r.description || "Aucune description"}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setEditingRole(r)}
                        className="rf-tap flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/5 text-xs font-semibold text-[#2B2622] hover:bg-black/10"
                      >
                        <Pencil size={12} /> Configurer les droits
                      </button>
                      {!r.isSystem && (
                        <button
                          onClick={() => {
                            if (assignedMembers.length > 0) {
                              alert(
                                `Impossible de supprimer le rôle « ${r.name} » car ${assignedMembers.length} collaborateur(s) y sont actuellement assignés. Réassignez-les d'abord.`
                              );
                              return;
                            }
                            if (confirm(`Confirmer la suppression du rôle « ${r.name} » ?`)) {
                              onDeleteRole(r.id);
                            }
                          }}
                          className="rf-tap p-2 rounded-lg bg-black/5 hover:bg-[#C1361B15] text-[#C1361B]"
                          title={
                            assignedMembers.length > 0
                              ? "Rôle assigné à des collaborateurs"
                              : "Supprimer ce rôle"
                          }
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Statut des permissions par module */}
                  <div className="mt-3 pt-3 border-t border-black/5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-[#5B5346]">
                        Couverture des droits : {permsCount} / {totalPerms} permissions ({permPercent}%)
                      </span>
                      <div className="w-36 h-2 bg-black/5 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${permPercent}%`, background: r.color }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {PERMISSION_MODULES.map((m) => {
                        const countInModule = m.permissions.filter((p) => r.permissions?.includes(p.id)).length;
                        const totalInModule = m.permissions.length;
                        const hasAll = countInModule === totalInModule;
                        const hasNone = countInModule === 0;

                        return (
                          <div
                            key={m.id}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border"
                            style={{
                              borderColor: hasNone ? "rgba(0,0,0,.08)" : `${m.color}35`,
                              background: hasNone ? "rgba(0,0,0,.02)" : `${m.color}10`,
                              color: hasNone ? "#9A917E" : m.color,
                            }}
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ background: hasNone ? "#9A917E" : m.color }}
                            />
                            <span>{m.label} :</span>
                            <strong>
                              {countInModule}/{totalInModule}
                            </strong>
                            {hasAll && <Check size={11} className="ml-0.5" />}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Collaborateurs assignés */}
                  <div className="mt-3 pt-2.5 border-t border-black/5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-[#8A8378]">Personnel assigné ({assignedMembers.length}) :</span>
                      {assignedMembers.length === 0 ? (
                        <span className="text-[11px] text-[#9A917E] italic">Aucun membre pour le moment</span>
                      ) : (
                        <div className="flex items-center gap-1 flex-wrap">
                          {assignedMembers.map((m) => (
                            <span
                              key={m.id}
                              className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-black/5 text-[#2B2622]"
                            >
                              {m.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => {
                        setFilterRoleId(r.id);
                        setSubTab("staff");
                      }}
                      className="rf-tap text-[11px] font-semibold text-[#3E7CB1] hover:underline"
                    >
                      Voir les membres →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── VUE 3 : MATRICE DES DROITS ─── */}
      {subTab === "matrix" && (
        <div className="rounded-2xl border border-black/10 bg-white overflow-hidden shadow-sm">
          <div className="p-4 border-b border-black/10 bg-[#FAF6EE]/50 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[#2B2622] flex items-center gap-2">
                <SlidersHorizontal size={15} /> Matrice comparative des permissions
              </h3>
              <p className="text-xs text-[#8A8378]">
                Vue d'ensemble croisée des modules et des droits attribués à chaque profil du restaurant
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-[11px] font-bold text-[#2E9E5B] bg-[#2E9E5B15] px-2 py-0.5 rounded-full">
                <Check size={11} /> Autorisé
              </span>
              <span className="flex items-center gap-1 text-[11px] font-bold text-[#9A917E] bg-black/5 px-2 py-0.5 rounded-full">
                — Non accordé
              </span>
            </div>
          </div>

          <div className="overflow-x-auto rf-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-black/10 bg-black/[.02]">
                  <th className="py-3 px-4 text-xs font-bold text-[#5B5346] w-1/3">Permission / Action</th>
                  {roles.map((r) => (
                    <th key={r.id} className="py-3 px-3 text-center text-xs font-bold" style={{ color: r.color }}>
                      <div className="flex flex-col items-center">
                        <span>{r.name}</span>
                        <span className="text-[10px] font-normal text-[#8A8378]">
                          {r.permissions?.length || 0} / {ALL_PERMISSIONS.length}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMISSION_MODULES.map((module) => (
                  <tr key={module.id} className="contents">
                    <td
                      colSpan={roles.length + 1}
                      className="py-2 px-4 text-xs font-bold uppercase tracking-wider border-y border-black/10"
                      style={{ background: `${module.color}10`, color: module.color }}
                    >
                      {module.label}
                    </td>
                    {module.permissions.map((p) => (
                      <tr key={p.id} className="border-b border-black/5 hover:bg-black/[.01] transition-colors">
                        <td className="py-2.5 px-4 text-xs">
                          <p className="font-semibold text-[#2B2622]">{p.label}</p>
                          <p className="text-[10px] text-[#8A8378]">{p.desc}</p>
                        </td>
                        {roles.map((r) => {
                          const hasPerm = r.permissions?.includes(p.id);
                          return (
                            <td key={r.id} className="py-2.5 px-3 text-center">
                              {hasPerm ? (
                                <span
                                  className="inline-flex w-6 h-6 rounded-full items-center justify-center font-bold"
                                  style={{ background: `${r.color}20`, color: r.color }}
                                >
                                  <Check size={13} />
                                </span>
                              ) : (
                                <span className="text-[#C9C2B0] text-sm">—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── MODALE D'ÉDITION / AJOUT COLLABORATEUR ─── */}
      {editingStaff && (
        <StaffFormModal
          member={editingStaff === "new" ? null : editingStaff}
          roles={roles}
          onClose={() => setEditingStaff(null)}
          onSave={(data) => {
            if (editingStaff === "new") {
              onAddStaff(data);
            } else {
              onUpdateStaff(editingStaff.id, data);
            }
            setEditingStaff(null);
          }}
        />
      )}

      {/* ─── MODALE D'ÉDITION / AJOUT RÔLE ─── */}
      {editingRole && (
        <RoleFormModal
          role={editingRole === "new" ? null : editingRole}
          onClose={() => setEditingRole(null)}
          onSave={(data) => {
            if (editingRole === "new") {
              onAddRole(data);
            } else {
              onUpdateRole(editingRole.id, data);
            }
            setEditingRole(null);
          }}
        />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MODALE COLLABORATEUR
══════════════════════════════════════════════════════════════ */
function StaffFormModal({ member, roles, onClose, onSave }) {
  const [name, setName] = useState(member?.name ?? "");
  const [roleId, setRoleId] = useState(member?.roleId ?? roles[0]?.id ?? "server");
  const [pin, setPin] = useState("");
  const [email, setEmail] = useState(member?.email ?? "");
  const [phone, setPhone] = useState(member?.phone ?? "");
  const [active, setActive] = useState(member?.active ?? true);

  // PIN obligatoire à la création ; en modification, vide = inchangé
  const pinOk = member ? pin === "" || /^\d{4,6}$/.test(pin) : /^\d{4,6}$/.test(pin);
  const isValid = name.trim().length > 0 && roleId && pinOk;

  return (
    <Modal title={member ? `Modifier ${member.name}` : "Nouveau collaborateur"} onClose={onClose}>
      <Field label="Nom complet & prénom *">
        <input
          className={inputCls}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex : Camille Bernard"
          autoFocus
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Rôle assigné *">
          <select className={inputCls} value={roleId} onChange={(e) => setRoleId(e.target.value)}>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label={member ? "Nouveau code PIN (vide = inchangé)" : "Code PIN (4 à 6 chiffres) *"}>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            className={inputCls + " font-mono tracking-widest text-center"}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            placeholder="Ex : 1234"
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Adresse e-mail">
          <input
            type="email"
            className={inputCls}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="camille@restoflow.fr"
          />
        </Field>

        <Field label="Téléphone mobile">
          <input
            type="tel"
            className={inputCls}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="06 12 34 56 78"
          />
        </Field>
      </div>

      <div className="mb-4 pt-1">
        <label className="flex items-center gap-2 cursor-pointer text-sm text-[#2B2622]">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="w-4 h-4 rounded text-[#C1440E]"
          />
          <span className="font-medium">Collaborateur actif en service</span>
        </label>
        <p className="text-[11px] text-[#8A8378] ml-6">
          Si désactivé, le collaborateur ne pourra pas se connecter aux terminaux de commande.
        </p>
      </div>

      <div className="flex gap-2">
        <button onClick={onClose} className="rf-tap flex-1 py-2.5 rounded-xl text-sm font-semibold bg-black/5">
          Annuler
        </button>
        <button
          disabled={!isValid}
          onClick={() =>
            onSave({
              name: name.trim(),
              roleId,
              ...(pin ? { pin } : {}),
              email: email.trim(),
              phone: phone.trim(),
              active,
            })
          }
          className="rf-tap flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40"
          style={{ background: "#C1440E" }}
        >
          Enregistrer
        </button>
      </div>
    </Modal>
  );
}

/* ══════════════════════════════════════════════════════════════
   MODALE RÔLE & PERMISSIONS
══════════════════════════════════════════════════════════════ */
function RoleFormModal({ role, onClose, onSave }) {
  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [color, setColor] = useState(role?.color ?? PRESET_COLORS[0]);
  const [permissions, setPermissions] = useState(role?.permissions ? [...role.permissions] : []);

  const isValid = name.trim().length > 0;

  // Toggle une permission
  const togglePerm = (permId) => {
    setPermissions((prev) =>
      prev.includes(permId) ? prev.filter((p) => p !== permId) : [...prev, permId]
    );
  };

  // Cocher / Décocher tout un module
  const toggleModule = (modulePerms, shouldCheck) => {
    const ids = modulePerms.map((p) => p.id);
    if (shouldCheck) {
      setPermissions((prev) => Array.from(new Set([...prev, ...ids])));
    } else {
      setPermissions((prev) => prev.filter((p) => !ids.includes(p)));
    }
  };

  // Tout cocher / décocher globalement
  const selectAll = () => setPermissions([...ALL_PERMISSIONS]);
  const deselectAll = () => setPermissions([]);

  return (
    <Modal title={role ? `Modifier le rôle : ${role.name}` : "Nouveau rôle personnalisé"} onClose={onClose} wide>
      <div className="grid grid-cols-[1fr_140px] gap-3">
        <Field label="Nom du rôle *">
          <input
            className={inputCls}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex : Barman / Barista"
            autoFocus
          />
        </Field>

        <Field label="Couleur d'accent">
          <div className="flex items-center gap-1.5 h-[38px]">
            {PRESET_COLORS.slice(0, 5).map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => setColor(c)}
                className="w-6 h-6 rounded-full transition-transform"
                style={{
                  background: c,
                  transform: color === c ? "scale(1.2)" : "scale(1)",
                  outline: color === c ? "2px solid #2B2622" : "none",
                }}
              />
            ))}
          </div>
        </Field>
      </div>

      <Field label="Description du poste & responsabilités">
        <input
          className={inputCls}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Ex : En charge des boissons, cocktails et encaissements au comptoir"
        />
      </Field>

      {/* Barre d'outils des permissions */}
      <div className="flex items-center justify-between mt-4 mb-3 pt-3 border-t border-black/10">
        <div>
          <h4 className="text-xs font-bold text-[#2B2622] uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles size={13} style={{ color }} /> Configuration des droits d'accès
          </h4>
          <p className="text-[11px] text-[#8A8378]">
            {permissions.length} sur {ALL_PERMISSIONS.length} permission(s) sélectionnée(s)
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={selectAll}
            className="rf-tap px-2.5 py-1 rounded-lg text-xs font-semibold bg-black/5 hover:bg-black/10"
          >
            Tout cocher
          </button>
          <button
            type="button"
            onClick={deselectAll}
            className="rf-tap px-2.5 py-1 rounded-lg text-xs font-semibold bg-black/5 hover:bg-black/10 text-[#C1361B]"
          >
            Tout décocher
          </button>
        </div>
      </div>

      {/* Modules de permissions */}
      <div className="space-y-3.5 max-h-[380px] overflow-y-auto rf-scrollbar pr-1">
        {PERMISSION_MODULES.map((module) => {
          const checkedCount = module.permissions.filter((p) => permissions.includes(p.id)).length;
          const allChecked = checkedCount === module.permissions.length;

          return (
            <div key={module.id} className="rounded-xl border border-black/10 p-3 bg-[#FAF6EE]/30">
              {/* Entête du module */}
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-black/5">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: module.color }} />
                  <span className="text-xs font-bold text-[#2B2622]">{module.label}</span>
                  <span className="text-[10px] text-[#8A8378]">
                    ({checkedCount} / {module.permissions.length})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => toggleModule(module.permissions, !allChecked)}
                  className="rf-tap text-[10px] font-bold"
                  style={{ color: module.color }}
                >
                  {allChecked ? "Tout décocher" : "Tout cocher"}
                </button>
              </div>

              {/* Liste des permissions */}
              <div className="grid grid-cols-2 gap-2">
                {module.permissions.map((p) => {
                  const isChecked = permissions.includes(p.id);
                  return (
                    <button
                      type="button"
                      key={p.id}
                      onClick={() => togglePerm(p.id)}
                      className="rf-tap flex items-start gap-2.5 p-2 rounded-lg text-left transition-all border"
                      style={{
                        borderColor: isChecked ? module.color : "rgba(0,0,0,.08)",
                        background: isChecked ? `${module.color}0E` : "white",
                      }}
                    >
                      <span
                        className="w-4 h-4 rounded mt-0.5 flex items-center justify-center shrink-0 border"
                        style={{
                          borderColor: isChecked ? module.color : "rgba(0,0,0,.2)",
                          background: isChecked ? module.color : "white",
                        }}
                      >
                        {isChecked && <Check size={11} color="white" strokeWidth={3} />}
                      </span>
                      <div className="min-w-0">
                        <p
                          className="text-xs font-semibold leading-snug"
                          style={{ color: isChecked ? "#2B2622" : "#5B5346" }}
                        >
                          {p.label}
                        </p>
                        <p className="text-[10px] text-[#8A8378] leading-tight">{p.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-2 mt-4 pt-2 border-t border-black/10">
        <button onClick={onClose} className="rf-tap flex-1 py-2.5 rounded-xl text-sm font-semibold bg-black/5">
          Annuler
        </button>
        <button
          disabled={!isValid}
          onClick={() =>
            onSave({
              name: name.trim(),
              description: description.trim(),
              color,
              permissions,
            })
          }
          className="rf-tap flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40"
          style={{ background: "#C1440E" }}
        >
          Enregistrer le rôle
        </button>
      </div>
    </Modal>
  );
}

/* ─── Heures pointées : cumul par équipier et départs oubliés à clore ─── */
const PERIODS = {
  week: { label: "7 derniers jours", range: () => [Date.now() - 7 * 86400000, Date.now() + 60000] },
  month: { label: "Ce mois", range: () => { const d = new Date(); return [new Date(d.getFullYear(), d.getMonth(), 1).getTime(), Date.now() + 60000]; } },
  lastMonth: { label: "Mois dernier", range: () => { const d = new Date(); return [new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime(), new Date(d.getFullYear(), d.getMonth(), 1).getTime()]; } },
};

function ShiftHours({ staff }) {
  const [period, setPeriod] = useState("week");
  const [shifts, setShifts] = useState([]);
  const [error, setError] = useState("");
  const [closing, setClosing] = useState({}); // shiftId → "AAAA-MM-JJTHH:MM"

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const [from, to] = PERIODS[period].range();
    const load = () => {
      if (!socket.connected) return setError("Hors ligne : heures indisponibles");
      socket.emit("shift:list", { from, to }, (res) => {
        if (res?.ok) { setShifts(res.shifts); setError(""); } else setError(res?.error || "Chargement impossible");
      });
    };
    load();
    socket.on("shifts:open", load);
    return () => socket.off("shifts:open", load);
  }, [period]);

  const name = (id) => staff.find((s) => s.id === id)?.name || "Équipier supprimé";
  const rows = hoursByStaff(shifts);
  const open = shifts.filter((s) => !s.endAt);
  const fmt = (d) => new Date(d).toLocaleString("fr-FR", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  const close = (id) => {
    const value = closing[id];
    if (!value) return;
    getSocket()?.emit("shift:close", { id, endAt: new Date(value).getTime() }, (res) => {
      if (res?.ok === false) setError(res.error);
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-1 p-1 rounded-xl bg-black/5 w-fit">
        {Object.entries(PERIODS).map(([id, p]) => (
          <button key={id} onClick={() => setPeriod(id)}
            className="rf-tap px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{ background: period === id ? "#2B2622" : "transparent", color: period === id ? "#FAF6EE" : "#5B5346" }}>
            {p.label}
          </button>
        ))}
      </div>
      {error && <p className="text-xs font-semibold text-[#C1361B]">{error}</p>}

      {open.length > 0 && (
        <div className="bg-white rounded-2xl border border-black/10 p-4">
          <p className="text-sm font-bold text-[#2B2622] mb-2">En poste ({open.length})</p>
          <div className="divide-y divide-black/5">
            {open.map((s) => (
              <div key={s.id} className="flex items-center gap-2 py-2 text-xs flex-wrap">
                <span className="font-semibold text-[#2B2622] flex-1 min-w-[140px]">{name(s.staffId)} · depuis {fmt(s.startAt)}</span>
                <div className="w-52"><input type="datetime-local" className={inputCls} value={closing[s.id] || ""}
                  onChange={(e) => setClosing((prev) => ({ ...prev, [s.id]: e.target.value }))} /></div>
                <button onClick={() => close(s.id)} disabled={!closing[s.id]}
                  className="rf-tap px-3 py-2 rounded-lg font-bold text-white bg-[#2B2622] disabled:opacity-40">
                  Pointer le départ
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-black/10 overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-black/10 text-[#8A8378] font-bold uppercase tracking-wider">
              <th className="py-3 px-4">Équipier</th>
              <th className="py-3 px-3 text-right">Services</th>
              <th className="py-3 px-4 text-right">Heures</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {rows.map((r) => (
              <tr key={r.staffId}>
                <td className="py-2.5 px-4 font-semibold text-[#2B2622]">{name(r.staffId)}{r.open && <span className="ml-1.5 text-[10px] text-[#2E9E5B]">● en poste</span>}</td>
                <td className="py-2.5 px-3 text-right">{r.shifts}</td>
                <td className="py-2.5 px-4 text-right rf-mono font-bold">{formatMinutes(r.minutes)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={3} className="py-8 text-center text-[#8A8378]">Aucun pointage sur la période</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
