import { useState, useEffect } from "react";
import { RefreshCw, Trash2, AlertTriangle, CheckCircle, Clock, X, Layers, RotateCcw } from "lucide-react";
import Modal from "./Modal.jsx";
import { subscribeQueue, discardAction, retryAction, clearQueue, flushQueue } from "../services/actionQueue.js";
import { getSocket } from "../services/socket.js";

const ACTION_LABELS = {
  "order:create_or_ensure": "Ouverture de commande",
  "order:create_offpremise": "Commande à emporter",
  "order:add_item": "Ajout d'article",
  "order:change_qty": "Changement de quantité",
  "order:remove_item": "Suppression d'article",
  "order:set_note": "Note sur un article",
  "order:send_kitchen": "Envoi en cuisine",
  "order:start_prep": "Préparation démarrée",
  "order:mark_ready": "Commande prête",
  "order:serve": "Commande servie",
  "order:call_course": "Réclame d'une suite",
  "order:change_item_course": "Changement de suite",
  "order:discount:apply": "Remise appliquée",
  "order:discount:remove": "Remise retirée",
  "order:checkout": "Encaissement",
  "order:set_covers": "Nombre de couverts",
  "order:request_bill": "Addition demandée",
  "order:cancel_offpremise": "Annulation de commande",
  "tables:toggle_alert": "Alerte de table",
  "reservation:create": "Nouvelle réservation",
  "reservation:update_status": "Statut de réservation",
  "reservation:assign_table": "Table de réservation",
  "reservation:delete": "Suppression de réservation",
  "config:update": "Paramètres de caisse",
  "recipe:save": "Fiche technique",
};

function getActionLabel(type, payload) {
  const label = ACTION_LABELS[type] || type;
  if (type === "order:add_item" && payload?.product?.name) return `${label} : ${payload.product.name}`;
  if (type === "order:checkout" && payload?.payments?.length) {
    const total = payload.payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    return `${label} : ${total.toFixed(2)} €`;
  }
  if (type === "reservation:create" && payload?.customerName) return `${label} : ${payload.customerName}`;
  return label;
}

const STATUS_STYLES = {
  syncing: "bg-sky-50 border-sky-200",
  rejected: "bg-red-50 border-red-200",
  pending: "bg-white border-black/10",
};

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

  const rejectedCount = queue.filter((a) => a.status === "rejected").length;

  const handleManualSync = async () => {
    setSyncFeedback(null);
    const socket = getSocket();
    if (!socket || !socket.connected) {
      setSyncFeedback({ ok: false, message: "Le serveur est toujours inaccessible. Vérifiez la connexion." });
      return;
    }

    try {
      const res = await flushQueue(socket);
      if (res.rejected > 0) {
        setSyncFeedback({ ok: false, message: `${res.flushed} action(s) synchronisée(s), ${res.rejected} refusée(s) par le serveur.` });
      } else if (res.flushed > 0) {
        setSyncFeedback({ ok: true, message: `${res.flushed} action(s) synchronisée(s) avec succès.` });
      } else {
        setSyncFeedback({ ok: true, message: "Aucune action à envoyer." });
      }
    } catch (e) {
      setSyncFeedback({ ok: false, message: e.message || "Erreur de synchronisation" });
    }
  };

  const handleRetry = async (id) => {
    await retryAction(id);
    await handleManualSync();
  };

  const handleDiscard = async (id) => {
    if (window.confirm("Abandonner définitivement cette action ? Elle ne sera jamais envoyée au serveur.")) {
      await discardAction(id);
    }
  };

  const handleClearAll = async () => {
    if (window.confirm("Vider toutes les actions en attente ? Les modifications non synchronisées seront perdues.")) {
      await clearQueue();
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="File d'attente hors-ligne" wide>
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-[#5B5346]">
          <Layers className="text-amber-600 shrink-0 mt-0.5" size={16} />
          <div>
            <p className="font-semibold text-[#2B2622]">Actions enregistrées sur ce terminal</p>
            <p className="mt-0.5">
              Elles sont rejouées dans l'ordre dès le retour du serveur ; une action déjà prise en compte n'est jamais appliquée deux fois.
              Une action refusée par le serveur reste ici jusqu'à ce que vous la réessayiez ou l'abandonniez.
            </p>
          </div>
        </div>

        {queue.some((a) => a.status === "rejected" && a.type === "order:checkout") && (
          <div className="p-3 rounded-xl text-sm font-bold bg-red-600 text-white flex items-start gap-2">
            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
            <span>
              Encaissement refusé par le serveur : la commande est restée ouverte. Rouvrez la table et encaissez-la à
              nouveau (vérifiez si le client a déjà payé), puis abandonnez l'action refusée.
            </span>
          </div>
        )}

        {rejectedCount > 0 && (
          <div className="p-3 rounded-xl text-xs font-semibold bg-red-50 border border-red-200 text-[#C1361B] flex items-center gap-2">
            <AlertTriangle size={14} /> {rejectedCount} action(s) refusée(s) par le serveur : vérifiez-les avant de les abandonner.
          </div>
        )}

        {syncFeedback && (
          <div
            className={`p-3 rounded-xl text-xs font-semibold flex items-center justify-between ${
              syncFeedback.ok ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : "bg-red-50 border border-red-200 text-[#C1361B]"
            }`}
          >
            <span>{syncFeedback.message}</span>
            <button onClick={() => setSyncFeedback(null)} className="p-1 hover:opacity-80" aria-label="Fermer le message">
              <X size={14} />
            </button>
          </div>
        )}

        <div className="max-h-[360px] overflow-y-auto space-y-2 pr-1">
          {queue.length === 0 ? (
            <div className="py-12 text-center text-[#8A8378]">
              <CheckCircle size={32} className="mx-auto text-emerald-500 mb-2" />
              <p className="font-semibold text-sm text-[#2B2622]">Toutes les actions sont synchronisées</p>
              <p className="text-xs">Aucune opération en attente sur ce terminal.</p>
            </div>
          ) : (
            queue.map((action, idx) => (
              <div
                key={action.id}
                className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs ${STATUS_STYLES[action.status] || STATUS_STYLES.pending}`}
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <span className="font-mono text-[10px] text-[#8A8378] shrink-0 mt-0.5">#{idx + 1}</span>
                  <div className="min-w-0">
                    <div className="font-semibold text-[#2B2622] truncate">{getActionLabel(action.type, action.payload)}</div>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-[#8A8378]">
                      <span className="flex items-center gap-1 font-mono">
                        <Clock size={11} />
                        {new Date(action.timestamp).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </span>
                      {action.status === "rejected" && <span className="font-bold text-[#C1361B]">Refusée</span>}
                      {action.status === "syncing" && <span className="font-bold text-sky-700">Envoi…</span>}
                      {action.retries > 0 && <span className="text-amber-700 font-semibold">{action.retries} tentative(s)</span>}
                    </div>
                    {action.lastError && (
                      <div className="mt-1 text-[11px] text-[#C1361B] flex items-center gap-1">
                        <AlertTriangle size={11} /> {action.lastError}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {action.status === "rejected" && (
                    <button
                      onClick={() => handleRetry(action.id)}
                      title="Réessayer cette action"
                      aria-label="Réessayer cette action"
                      className="p-1.5 rounded-lg text-[#5B5346] hover:bg-black/5"
                    >
                      <RotateCcw size={14} />
                    </button>
                  )}
                  <button
                    onClick={() => handleDiscard(action.id)}
                    title="Abandonner cette action"
                    aria-label="Abandonner cette action"
                    className="p-1.5 rounded-lg text-[#8A8378] hover:text-[#C1361B] hover:bg-red-50"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="pt-3 border-t border-black/10 flex items-center justify-between">
          <div>
            {queue.length > 0 && (
              <button onClick={handleClearAll} className="text-xs text-[#C1361B] hover:underline flex items-center gap-1">
                <Trash2 size={12} /> Tout vider
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-black/5 text-[#2B2622]">
              Fermer
            </button>
            <button
              onClick={handleManualSync}
              disabled={isFlushing || queue.length === 0}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-[#C1440E] text-white flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
