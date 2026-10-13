import { useState, useMemo } from "react";
import {
  Calendar, Users, Phone, Mail, CheckCircle2,
  XCircle, AlertCircle, Plus, Search, CalendarClock,
  UserCheck, Sparkles, Trash2
} from "lucide-react";
import Modal from "./Modal.jsx";

export default function ReservationModal({
  isOpen,
  onClose,
  reservations = [],
  tables = [],
  orders = [],
  onCreateReservation,
  onUpdateStatus,
  onAssignTable,
  onDeleteReservation,
  onSeatGuests, // ({ table, reservation }) => seats and opens order
}) {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState("list"); // "list" | "new"
  const [filterDate, setFilterDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // "all" | "confirmed" | "seated" | "cancelled"

  // Formulaire nouvelle réservation
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState("20:00");
  const [guests, setGuests] = useState(2);
  const [selectedTableId, setSelectedTableId] = useState("");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState("");

  const TIME_SLOTS = [
    // Midi
    "12:00", "12:15", "12:30", "12:45", "13:00", "13:15", "13:30",
    // Soir
    "19:00", "19:30", "20:00", "20:30", "21:00", "21:30", "22:00",
  ];

  // Filtrage des réservations
  const filteredReservations = useMemo(() => {
    return reservations.filter((r) => {
      const matchDate = filterDate ? r.date === filterDate : true;
      const matchStatus = statusFilter === "all" ? true : r.status === statusFilter;
      const matchQuery = searchQuery
        ? (r.customerName + " " + r.phone + " " + (r.notes || "")).toLowerCase().includes(searchQuery.toLowerCase())
        : true;
      return matchDate && matchStatus && matchQuery;
    });
  }, [reservations, filterDate, statusFilter, searchQuery]);

  const stats = useMemo(() => {
    const todayRes = reservations.filter((r) => r.date === filterDate);
    const totalGuests = todayRes.filter((r) => r.status !== "cancelled").reduce((s, r) => s + (r.guests || 0), 0);
    const confirmed = todayRes.filter((r) => r.status === "confirmed").length;
    const seated = todayRes.filter((r) => r.status === "seated").length;
    return { count: todayRes.length, totalGuests, confirmed, seated };
  }, [reservations, filterDate]);

  // Tables compatibles avec le nombre de convives
  const suitableTables = useMemo(() => {
    return tables.filter((t) => t.seats >= guests);
  }, [tables, guests]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError("");

    if (!customerName.trim()) {
      setFormError("Veuillez renseigner le nom du client.");
      return;
    }
    if (!phone.trim()) {
      setFormError("Veuillez renseigner un numéro de téléphone.");
      return;
    }

    onCreateReservation({
      customerName: customerName.trim(),
      phone: phone.trim(),
      email: email.trim() || null,
      date,
      time,
      guests: Number(guests) || 2,
      tableId: selectedTableId || null,
      notes: notes.trim() || null,
      status: "confirmed",
    });

    // Reset formulaire & bascule sur la liste
    setCustomerName("");
    setPhone("");
    setEmail("");
    setNotes("");
    setSelectedTableId("");
    setActiveTab("list");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Gestion des Réservations" wide>
      <div className="flex flex-col h-[650px] max-h-[85vh]">
        {/* Navigation Onglets */}
        <div className="flex items-center justify-between border-b border-black/10 px-4 py-2 bg-black/[.02]">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab("list")}
              className={`rf-tap flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${
                activeTab === "list"
                  ? "bg-[#C1440E] text-white shadow-sm"
                  : "bg-black/5 text-[#5B5346] hover:bg-black/10"
              }`}
            >
              <CalendarClock size={14} />
              <span>Réservations du jour</span>
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">
                {stats.count}
              </span>
            </button>
            <button
              onClick={() => setActiveTab("new")}
              className={`rf-tap flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${
                activeTab === "new"
                  ? "bg-[#C1440E] text-white shadow-sm"
                  : "bg-black/5 text-[#5B5346] hover:bg-black/10"
              }`}
            >
              <Plus size={14} />
              <span>Nouvelle réservation (Widget)</span>
            </button>
          </div>

          <div className="flex items-center gap-3 text-xs text-[#6B6355]">
            <span className="font-semibold">{stats.totalGuests} couverts</span>
            <span>·</span>
            <span className="text-[#2E9E5B] font-semibold">{stats.confirmed} confirmées</span>
            <span>·</span>
            <span className="text-[#3E7CB1] font-semibold">{stats.seated} installées</span>
          </div>
        </div>

        {/* Contenu Onglet 1 : Liste */}
        {activeTab === "list" && (
          <div className="flex-1 flex flex-col min-h-0 p-4 space-y-3">
            {/* Barre de filtre date et recherche */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 bg-black/5 px-3 py-1.5 rounded-xl border border-black/10">
                <Calendar size={14} className="text-[#8A8378]" />
                <input
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="bg-transparent text-xs font-semibold outline-none text-[#2B2622]"
                />
              </div>

              <div className="flex-1 min-w-[180px] flex items-center gap-2 bg-black/5 px-3 py-1.5 rounded-xl border border-black/10">
                <Search size={14} className="text-[#8A8378]" />
                <input
                  type="text"
                  placeholder="Rechercher nom, téléphone, note..."
                  aria-label="Rechercher nom, téléphone, note"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent text-xs outline-none flex-1 text-[#2B2622] placeholder:text-[#9A917E]"
                />
              </div>

              <div className="flex items-center gap-1">
                {["all", "confirmed", "seated", "cancelled"].map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`rf-tap px-2.5 py-1 rounded-lg text-[11px] font-semibold capitalize ${
                      statusFilter === st
                        ? "bg-[#2B2622] text-white"
                        : "bg-black/5 text-[#5B5346] hover:bg-black/10"
                    }`}
                  >
                    {st === "all" ? "Toutes" : st === "confirmed" ? "Confirmées" : st === "seated" ? "Installées" : "Annulées"}
                  </button>
                ))}
              </div>
            </div>

            {/* Liste scrollable */}
            <div className="flex-1 overflow-y-auto rf-scrollbar space-y-2 pr-1">
              {filteredReservations.length === 0 ? (
                <div className="text-center py-12 space-y-2">
                  <CalendarClock size={36} className="mx-auto text-[#9A917E]/50" />
                  <p className="text-sm font-semibold text-[#5B5346]">Aucune réservation trouvée</p>
                  <p className="text-xs text-[#9A917E]">
                    Aucune réservation ne correspond à la date ou aux critères sélectionnés.
                  </p>
                  <button
                    onClick={() => setActiveTab("new")}
                    className="rf-tap mt-2 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-[#C1440E]"
                  >
                    <Plus size={13} /> Créer une réservation
                  </button>
                </div>
              ) : (
                filteredReservations.map((res) => {
                  const table = tables.find((t) => t.id === res.tableId);
                  const isSeated = res.status === "seated";
                  const isCancelled = res.status === "cancelled" || res.status === "no_show";

                  return (
                    <div
                      key={res.id}
                      className={`p-3 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-3 transition-colors ${
                        isSeated
                          ? "bg-[#3E7CB1]/5 border-[#3E7CB1]/20"
                          : isCancelled
                          ? "bg-black/[.02] border-black/10 opacity-60"
                          : "bg-white border-black/10 hover:border-[#C1440E]/40 shadow-xs"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Heure créneau */}
                        <div className="flex flex-col items-center justify-center min-w-[54px] py-1 px-2 rounded-lg bg-[#2B2622] text-white">
                          <span className="rf-black text-sm font-bold leading-tight">{res.time}</span>
                          <span className="text-[10px] text-white/70 flex items-center gap-0.5 mt-0.5">
                            <Users size={10} /> {res.guests}
                          </span>
                        </div>

                        {/* Coordonnées & détails */}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-[#2B2622]">{res.customerName}</span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                isSeated
                                  ? "bg-[#3E7CB1]/15 text-[#3E7CB1]"
                                  : isCancelled
                                  ? "bg-red-500/15 text-red-600"
                                  : "bg-[#2E9E5B]/15 text-[#2E9E5B]"
                              }`}
                            >
                              {isSeated ? "Installée" : isCancelled ? "Annulée" : "Confirmée"}
                            </span>
                            {table && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#D9A441]/20 text-[#8B5E34]">
                                Table {table.number} ({table.seats} pl.)
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#6B6355] mt-1">
                            <span className="flex items-center gap-1">
                              <Phone size={11} className="text-[#8A8378]" /> {res.phone}
                            </span>
                            {res.email && (
                              <span className="flex items-center gap-1">
                                <Mail size={11} className="text-[#8A8378]" /> {res.email}
                              </span>
                            )}
                          </div>

                          {res.notes && (
                            <p className="text-[11px] text-[#C1440E] font-medium mt-1 bg-[#C1440E]/5 px-2 py-0.5 rounded inline-block">
                              📝 {res.notes}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 self-end md:self-center">
                        {!isCancelled && !isSeated && (
                          <button
                            onClick={() => {
                              if (table) {
                                onSeatGuests?.({ table, reservation: res });
                                onClose();
                              } else {
                                // Ouvrir popup assignation ou première table libre
                                const free = tables.find((t) => !orders.some((o) => o.tableId === t.id && o.status === "open") && t.seats >= res.guests);
                                if (free) {
                                  onAssignTable?.(res.id, free.id);
                                  onSeatGuests?.({ table: free, reservation: res });
                                  onClose();
                                } else {
                                  alert("Veuillez d'abord attribuer une table disponible pour installer les convives.");
                                }
                              }
                            }}
                            className="rf-tap px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-[#2E9E5B] hover:bg-[#258249] flex items-center gap-1 shadow-sm"
                            title="Installer les convives et ouvrir la commande"
                          >
                            <UserCheck size={13} />
                            <span>Installer</span>
                          </button>
                        )}

                        {!isCancelled && !table && (
                          <select
                            onChange={(e) => {
                              if (e.target.value) onAssignTable?.(res.id, e.target.value);
                            }}
                            defaultValue=""
                            className="text-xs bg-black/5 hover:bg-black/10 border border-black/15 rounded-lg px-2 py-1.5 font-semibold text-[#5B5346] outline-none"
                          >
                            <option value="" disabled>Attribuer table...</option>
                            {tables.map((t) => (
                              <option key={t.id} value={t.id}>
                                Table {t.number} ({t.seats} pl.)
                              </option>
                            ))}
                          </select>
                        )}

                        {!isCancelled && isSeated && (
                          <span className="text-xs text-[#3E7CB1] font-semibold flex items-center gap-1">
                            <CheckCircle2 size={13} /> En salle
                          </span>
                        )}

                        {!isCancelled && (
                          <button
                            onClick={() => onUpdateStatus?.(res.id, "cancelled")}
                            className="rf-tap p-1.5 rounded-lg text-[#9A917E] hover:text-red-600 hover:bg-red-50"
                            title="Annuler la réservation"
                          >
                            <XCircle size={15} />
                          </button>
                        )}

                        <button
                          onClick={() => {
                            if (window.confirm("Supprimer définitivement cette réservation ?")) {
                              onDeleteReservation?.(res.id);
                            }
                          }}
                          className="rf-tap p-1.5 rounded-lg text-[#9A917E] hover:text-red-600 hover:bg-red-50"
                          title="Supprimer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Contenu Onglet 2 : Widget Formulaire */}
        {activeTab === "new" && (
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto rf-scrollbar p-5 space-y-4">
            <div className="bg-[#FAF6EE] p-4 rounded-xl border border-[#E4DAC6] flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-[#2B2622] flex items-center gap-1.5">
                  <Sparkles size={16} className="text-[#C1440E]" />
                  Widget de réservation interactif
                </h3>
                <p className="text-xs text-[#6B6355]">
                  Enregistrez une réservation client avec attribution intelligente de table.
                </p>
              </div>
            </div>

            {formError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-600 flex items-center gap-2">
                <AlertCircle size={15} />
                <span>{formError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#5B5346] mb-1">Nom du client *</label>
                <input
                  type="text"
                  placeholder="Ex : Famille Dupont"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-black/15 bg-white outline-none focus:border-[#C1440E]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#5B5346] mb-1">Téléphone de contact *</label>
                <input
                  type="tel"
                  placeholder="Ex : 06 12 34 56 78"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-black/15 bg-white outline-none focus:border-[#C1440E]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#5B5346] mb-1">Email (optionnel)</label>
                <input
                  type="email"
                  placeholder="Ex : dupont@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-black/15 bg-white outline-none focus:border-[#C1440E]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#5B5346] mb-1">Date *</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-black/15 bg-white outline-none focus:border-[#C1440E]"
                  required
                />
              </div>
            </div>

            {/* Nombre de convives */}
            <div>
              <label className="block text-xs font-bold text-[#5B5346] mb-1.5">Nombre de convives ({guests} personnes)</label>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 10, 12].map((n) => (
                  <button
                    type="button"
                    key={n}
                    onClick={() => setGuests(n)}
                    className={`rf-tap w-9 h-9 rounded-xl text-xs font-bold flex items-center justify-center ${
                      guests === n
                        ? "bg-[#C1440E] text-white shadow-sm"
                        : "bg-black/5 text-[#5B5346] hover:bg-black/10"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Créneau horaire */}
            <div>
              <label className="block text-xs font-bold text-[#5B5346] mb-1.5">Créneau horaire ({time})</label>
              <div className="flex flex-wrap gap-1.5">
                {TIME_SLOTS.map((slot) => (
                  <button
                    type="button"
                    key={slot}
                    onClick={() => setTime(slot)}
                    className={`rf-tap px-3 py-1.5 rounded-lg text-xs font-semibold ${
                      time === slot
                        ? "bg-[#2B2622] text-white shadow-sm"
                        : "bg-black/5 text-[#5B5346] hover:bg-black/10"
                    }`}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            </div>

            {/* Choix de la table (optionnel ou auto) */}
            <div>
              <label className="block text-xs font-bold text-[#5B5346] mb-1">
                Affectation d'une table (optionnelle)
              </label>
              <select
                value={selectedTableId}
                onChange={(e) => setSelectedTableId(e.target.value)}
                className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-black/15 bg-white outline-none focus:border-[#C1440E]"
              >
                <option value="">Sélection automatique ou non assignée</option>
                {suitableTables.map((t) => (
                  <option key={t.id} value={t.id}>
                    Table {t.number} — {t.seats} couverts ({t.reserved ? "Déjà réservée" : "Libre"})
                  </option>
                ))}
              </select>
            </div>

            {/* Remarques & Allergies */}
            <div>
              <label className="block text-xs font-bold text-[#5B5346] mb-1">Notes / Régimes / Emplacement</label>
              <textarea
                rows={2}
                placeholder="Ex : Chaise bébé requise, allergie arachide, anniversaire..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full text-xs font-medium px-3 py-2 rounded-xl border border-black/15 bg-white outline-none focus:border-[#C1440E]"
              />
            </div>

            {/* Bouton de confirmation */}
            <div className="pt-2 flex justify-end gap-2 border-t border-black/10">
              <button
                type="button"
                onClick={() => setActiveTab("list")}
                className="rf-tap px-4 py-2 rounded-xl text-xs font-semibold bg-black/5 text-[#5B5346]"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="rf-tap px-5 py-2 rounded-xl text-xs font-bold text-white bg-[#C1440E] hover:bg-[#a93b0b] shadow-sm flex items-center gap-1.5"
              >
                <CheckCircle2 size={14} />
                <span>Enregistrer la réservation</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
