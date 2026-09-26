import { useState, useEffect } from "react";
import { RefreshCw, Trash2, AlertTriangle, CheckCircle, Clock, X, Layers } from "lucide-react";
import Modal from "./Modal.jsx";
import { subscribeQueue, discardAction, clearQueue, flushQueue } from "../services/actionQueue.js";
import { getSocket } from "../services/socket.js";

function getActionLabel(type, payload) {
  switch (type) {
    case "order:create":
      return `Nouvelle commande (Table ${payload?.tableNumber || "?"})`;
    case "order:update":
      return `Mise à jour commande (Table ${payload?.tableNumber || "?"})`;
    case "order:checkout":
      return `Encaissement (Table ${payload?.tableNumber || "?"} — ${(payload?.totalPaid || payload?.total || 0).toFixed(2)} €)`;
    case "table:update_status":
      return `Statut Table ${payload?.tableNumber || payload?.tableId || "?"} ➔ ${payload?.status || "?"}`;
    case "table:transfer":
      return `Transfert Table ${payload?.sourceTableNumber} ➔ ${payload?.targetTableNumber}`;
    case "table:merge":
      return `Fusion Table ${payload?.sourceTableNumber} ➔ ${payload?.targetTableNumber}`;
    case "reservation:create":
      return `Réservation ${payload?.customerName} (${payload?.guests}p à ${payload?.time})`;
    case "config:update":
      return "Mise à jour de la configuration";
    case "stock:adjust":
      return `Ajustement stock (${payload?.reason || "Manuel"})`;
    default:
      return type;
  }
}

export default function OfflineQueueModal({ isOpen, onClose }) {
  const [queue, setQueue] = useState([]);
  const [isFlushing, setIsFlushing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState(null);

  useEffect(() => {
    const unsub = subscribeQueue((count, q, flushing) => {
      setQueue(q);
      setIsFlushing(flushing);
    });
    return unsub;
  }, []);

  const handleManualSync = async () => {
    setSyncFeedback(null);
    const socket = getSocket();
    if (!socket || !socket.connected) {
      setSyncFeedback({ ok: false, message: "Le serveur est toujours inaccessible. Vérifiez la connexion." });
      return;
    }

    try {
      const res = await flushQueue(socket);
      if (res.flushed > 0) {
        setSyncFeedback({
          ok: true,
          message: `${res.flushed} action(s) synchronisée(s) avec succès ! ${res.remaining > 0 ? `(${res.remaining} restante(s))` : ""}`,
        });
      } else if (res.errors > 0) {
        setSyncFeedback({ ok: false, message: `Échec sur ${res.errors} action(s). Le serveur a rejeté la requête.` });
      } else {
        setSyncFeedback({ ok: true, message: "Aucune action en attente." });
      }
    } catch (e) {
      setSyncFeedback({ ok: false, message: e.message || "Erreur de synchronisation" });
    }
  };

  const handleDiscard = async (id) => {
    await discardAction(id);
  };

  const handleClearAll = async () => {
    if (window.confirm("Êtes-vous sûr de vouloir vider toutes les actions en attente ? Les modifications non synchronisées seront perdues.")) {
      await clearQueue();
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="File d'attente hors-ligne" size="max-w-2xl">
      <div className="space-y-4">
        {/* En-tête explicatif */}
        <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-[#E6E1D8]">
          <Layers className="text-amber-400 shrink-0 mt-0.5" size={16} />
          <div>
            <p className="font-semibold text-amber-300">Fonctionnement autonome activé</p>
            <p className="text-[#C9C2B0] mt-0.5">
              Ces actions ont été enregistrées localement dans votre navigateur (IndexedDB) pendant une coupure réseau. Elles seront automatiquement rejouées dès le rétablissement de la liaison avec le serveur.
            </p>
          </div>
        </div>

        {/* Message de feedback après synchro manuelle */}
        {syncFeedback && (
          <div
            className={`p-3 rounded-xl text-xs font-semibold flex items-center justify-between ${
              syncFeedback.ok
                ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-300"
                : "bg-red-500/15 border border-red-500/30 text-red-300"
            }`}
          >
            <span>{syncFeedback.message}</span>
            <button onClick={() => setSyncFeedback(null)} className="p-1 hover:opacity-80">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Liste des actions */}
        <div className="max-h-[360px] overflow-y-auto space-y-2 pr-1">
          {queue.length === 0 ? (
            <div className="py-12 text-center text-[#6B6355]">
              <CheckCircle size={32} className="mx-auto text-emerald-500/60 mb-2" />
              <p className="font-semibold text-sm text-[#C9C2B0]">Toutes les actions sont synchronisées</p>
              <p className="text-xs">Aucune opération en attente dans la mémoire locale.</p>
            </div>
          ) : (
            queue.map((action, idx) => {
              const dateStr = new Date(action.timestamp).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              });

              return (
                <div
                  key={action.id || idx}
                  className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs transition-all ${
                    action.status === "syncing"
                      ? "bg-sky-500/10 border-sky-500/30 text-sky-200"
                      : action.status === "failed"
                      ? "bg-red-500/10 border-red-500/30 text-red-200"
                      : "bg-[#241E1A] border-[#3D352E] text-[#EDE7DE]"
                  }`}
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span className="font-mono text-[10px] text-[#8C8273] shrink-0 mt-0.5">
                      #{idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="font-semibold truncate">
                        {getActionLabel(action.type, action.payload)}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-[#A69B89]">
                        <span className="flex items-center gap-1 font-mono">
                          <Clock size={11} /> {dateStr}
                        </span>
                        <span className="font-mono text-[10px] bg-black/20 px-1.5 py-0.5 rounded">
                          {action.type}
                        </span>
                        {action.retries > 0 && (
                          <span className="text-amber-400 font-semibold">
                            {action.retries} essai(s)
                          </span>
                        )}
                      </div>
                      {action.lastError && (
                        <div className="mt-1 text-[10px] text-red-400 flex items-center gap-1">
                          <AlertTriangle size={11} /> {action.lastError}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleDiscard(action.id)}
                      title="Supprimer cette action"
                      className="p-1.5 rounded-lg text-[#8C8273] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Boutons d'action en bas */}
        <div className="pt-3 border-t border-[#3D352E] flex items-center justify-between">
          <div>
            {queue.length > 0 && (
              <button
                onClick={handleClearAll}
                className="text-xs text-red-400/80 hover:text-red-400 hover:underline flex items-center gap-1"
              >
                <Trash2 size={12} /> Tout vider
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#2E2721] text-[#C9C2B0] hover:bg-[#3D352E] transition-colors"
            >
              Fermer
            </button>
            <button
              onClick={handleManualSync}
              disabled={isFlushing || queue.length === 0}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-[#C1440E] hover:bg-[#D94F14] text-white flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md transition-colors"
            >
              <RefreshCw size={13} className={isFlushing ? "animate-spin" : ""} />
              {isFlushing ? "Synchronisation..." : "Forcer la synchronisation"}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
