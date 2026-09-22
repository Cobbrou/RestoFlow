import { useState, useEffect } from "react";
import { Wifi, WifiOff, RefreshCw } from "lucide-react";
import { subscribeSocketStatus } from "../services/socket.js";
import { subscribeQueue } from "../services/actionQueue.js";

export default function ConnectionBadge({ dark = false }) {
  const [status, setStatus] = useState({ connected: false });
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const unsubSocket = subscribeSocketStatus((s) => setStatus(s));
    const unsubQueue = subscribeQueue((count) => setPendingCount(count));
    return () => {
      unsubSocket();
      unsubQueue();
    };
  }, []);

  const isConnected = status.connected;

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
        dark ? "bg-white/5" : "bg-black/5"
      }`}
      title={
        isConnected
          ? "Connecté au serveur en temps réel"
          : "Déconnecté — les actions sont stockées en mémoire tampon locale"
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
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          <WifiOff size={12} className="text-amber-500" />
          <span className="text-amber-600 font-semibold">Hors-ligne</span>
        </>
      )}

      {pendingCount > 0 && (
        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-600 font-bold text-[10px]">
          <RefreshCw size={10} className="animate-spin" />
          {pendingCount} en attente
        </span>
      )}
    </div>
  );
}
