import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { getSocket, getSessionToken } from "../services/socket.js";
import { emitOrQueue } from "../services/emitOrQueue.js";
import { uid } from "../data/seed.js";

/**
 * Pointage de l'équipier connecté (arrivée / départ).
 * Services en cours lus au serveur (shift:open_list) puis tenus à jour par shifts:open ;
 * hors-ligne, le pointage part dans la file avec l'heure de la tablette.
 */
export default function ClockButton({ currentStaff, dark }) {
  const [openShifts, setOpenShifts] = useState(null); // null : état inconnu (pas encore synchronisé)

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !currentStaff) return;
    const refresh = () => socket.emit("shift:open_list", {}, (res) => res?.ok && setOpenShifts(res.shifts));
    if (socket.connected) refresh();
    socket.on("connect", refresh);
    socket.on("shifts:open", setOpenShifts);
    return () => {
      socket.off("connect", refresh);
      socket.off("shifts:open", setOpenShifts);
    };
  }, [currentStaff]);

  if (!currentStaff || openShifts === null) return null;
  const mine = openShifts.find((s) => s.staffId === currentStaff.id);

  const clock = () => {
    const at = Date.now();
    if (mine) {
      if (!confirm(`Pointer le départ de ${currentStaff.name} ?`)) return;
      setOpenShifts((prev) => prev.filter((s) => s.id !== mine.id));
      emitOrQueue("shift:clock", { staffId: currentStaff.id, action: "out", at, operatorToken: getSessionToken() });
    } else {
      const id = uid("shift");
      setOpenShifts((prev) => [...prev, { id, staffId: currentStaff.id, startAt: new Date(at).toISOString(), endAt: null }]);
      emitOrQueue("shift:clock", { id, staffId: currentStaff.id, action: "in", at, operatorToken: getSessionToken() });
    }
  };

  const since = mine ? new Date(mine.startAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : null;
  return (
    <button
      onClick={clock}
      className={`rf-tap flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-semibold ${
        mine ? "bg-[#2E9E5B]/15 text-[#2E9E5B]" : dark ? "bg-white/5 text-[#C9C2B0]" : "bg-black/5 text-[#6B6355]"
      }`}
      title={mine ? `En poste depuis ${since} : pointer le départ` : "Pointer l'arrivée"}
    >
      <Clock size={12} /> {mine ? `Depuis ${since}` : "Arrivée"}
    </button>
  );
}
