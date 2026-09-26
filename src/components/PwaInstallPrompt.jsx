import { useState, useEffect } from "react";
import { Download, RefreshCw, X, Smartphone } from "lucide-react";
import { useRegisterSW } from "virtual:pwa-register/react";

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isDismissed, setIsDismissed] = useState(() => {
    try {
      return sessionStorage.getItem("rf_pwa_dismissed") === "true";
    } catch {
      return false;
    }
  });

  // Gestion du Service Worker avec vite-plugin-pwa
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      if (r) {
        console.log("[PWA] Service Worker enregistré avec succès");
      }
    },
    onRegisterError(error) {
      console.warn("[PWA] Erreur enregistrement Service Worker :", error);
    },
  });

  useEffect(() => {
    const handleBeforeInstall = (e) => {
      // Empêche la bannière native automatique pour contrôler l'affichage
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    // Détection si l'application tourne déjà en mode standalone
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstallable(false);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`[PWA] Résultat de l'installation : ${outcome}`);
    setDeferredPrompt(null);
    setIsInstallable(false);
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      sessionStorage.setItem("rf_pwa_dismissed", "true");
    } catch {}
  };

  return (
    <>
      {/* 1. Notification de mise à jour du Service Worker */}
      {needRefresh && (
        <div className="fixed bottom-4 left-4 z-50 max-w-sm bg-[#1C1814] border border-[#C1440E] p-3.5 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2">
          <div className="w-8 h-8 rounded-full bg-[#C1440E]/20 text-[#C1440E] flex items-center justify-center shrink-0">
            <RefreshCw size={16} className="animate-spin" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-[#EDE7DE]">Mise à jour disponible</p>
            <p className="text-[11px] text-[#A69B89]">Une nouvelle version de RestoFlow est prête.</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => updateServiceWorker(true)}
              className="px-2.5 py-1.5 rounded-xl bg-[#C1440E] hover:bg-[#D94F14] text-white text-xs font-bold transition-colors cursor-pointer"
            >
              Actualiser
            </button>
            <button
              onClick={() => setNeedRefresh(false)}
              className="p-1 rounded-lg text-[#8C8273] hover:text-[#EDE7DE] transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* 2. Bannière discrète d'installation PWA */}
      {isInstallable && !isDismissed && (
        <div className="fixed bottom-4 right-4 z-50 max-w-xs bg-[#241E1A] border border-[#3D352E] p-3 rounded-2xl shadow-xl flex items-center gap-3 text-xs text-[#EDE7DE]">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
            <Smartphone size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-xs text-[#EDE7DE]">Installer RestoFlow</p>
            <p className="text-[10px] text-[#A69B89] truncate">Accessible hors-ligne en 1 clic</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={handleInstallClick}
              className="px-2.5 py-1 rounded-lg bg-[#C1440E] hover:bg-[#D94F14] text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Download size={11} /> Installer
            </button>
            <button
              onClick={handleDismiss}
              className="p-1 text-[#8C8273] hover:text-[#EDE7DE] rounded transition-colors"
              title="Plus tard"
            >
              <X size={13} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
