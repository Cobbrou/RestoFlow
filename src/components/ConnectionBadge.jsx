import { useState, useEffect } from "react";
import { Wifi, WifiOff, RefreshCw } from "lucide-react";
import { subscribeSocketStatus } from "../services/socket.js";
import { subscribeQueue } from "../services/actionQueue.js";
import OfflineQueueModal from "./OfflineQueueModal.jsx";

export default function ConnectionBadge({ dark = false }) {
  const [status, setStatus] = useState({ connected: false });
  const [pendingCount, setPendingCount] = useState(0);
  const [isFlushing, setIsFlushing] = useState(false);
  const [isQueueModalOpen, setIsQueueModalOpen] = useState(false);

  useEffect(() => {
    const unsubSocket = subscribeSocketStatus((s) => setStatus(s));
    const unsubQueue = subscribeQueue((count, queue, flushing) => {
      setPendingCount(count);
      setIsFlushing(flushing);
    });
    return () => {
      unsubSocket();
      unsubQueue();
    };
  }, []);

  const isConnected = status.connected;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsQueueModalOpen(true)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all hover:scale-105 cursor-pointer ${
          dark ? "bg-white/5 hover:bg-white/10" : "bg-black/5 hover:bg-black/10"
        }`}
        title={
          isConnected
            ? pendingCount > 0
              ? `${pendingCount} action(s) en file d'attente locale (cliquer pour inspecter)`
              : "Connecté au serveur en temps réel (cliquer pour voir la file locale)"
            : "Déconnecté — fonctionnement autonome (cliquer pour inspecter la file d'attente)"
        }
      >
        {isConnected ? (
          <>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <Wifi size={12} className="text-emerald-500" />
            <span className={dark ? "text-[#C9C2B0]" : "text-[#5B5346]"}>En ligne</span>
          </>
        ) : (
          <>
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
            <WifiOff size={12} className="text-amber-500" />
            <span className="text-amber-600 font-semibold">Hors-ligne (autonome)</span>
          </>
        )}

        {pendingCount > 0 && (
          <span
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full font-bold text-[10px] ${
              isFlushing
                ? "bg-sky-500/20 text-sky-400"
                : "bg-amber-500/20 text-amber-600 dark:text-amber-400"
            }`}
          >
            <RefreshCw size={10} className={isFlushing ? "animate-spin" : ""} />
            {pendingCount} en attente
          </span>
        )}
      </button>

      {/* Modale d'inspection de la file d'attente */}
      <OfflineQueueModal
        isOpen={isQueueModalOpen}
        onClose={() => setIsQueueModalOpen(false)}
      />
    </>
  );
}
