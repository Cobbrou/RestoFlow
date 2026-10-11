import { useCallback, useState, useEffect } from "react";

let globalAudioCtx = null;
const audioListeners = new Set();

function getGlobalAudioContext() {
  if (typeof window === "undefined") return null;
  if (!globalAudioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      globalAudioCtx = new AudioContextClass();
    }
  }
  return globalAudioCtx;
}

export function unlockAudio() {
  const ctx = getGlobalAudioContext();
  if (ctx && ctx.state === "suspended") {
    return ctx.resume().then(() => {
      audioListeners.forEach((fn) => fn(ctx.state));
      return ctx.state;
    });
  }
  return Promise.resolve(ctx?.state || "unsupported");
}

// Déverrouillage automatique au premier touch/clic sur l'application (Autoplay Policy)
if (typeof window !== "undefined") {
  const handleFirstInteraction = () => {
    unlockAudio();
    window.removeEventListener("pointerdown", handleFirstInteraction);
    window.removeEventListener("keydown", handleFirstInteraction);
  };
  window.addEventListener("pointerdown", handleFirstInteraction, { passive: true, once: true });
  window.addEventListener("keydown", handleFirstInteraction, { passive: true, once: true });
}

export function useAudioState() {
  const [state, setState] = useState(() => {
    const ctx = getGlobalAudioContext();
    return ctx ? ctx.state : "unsupported";
  });

  useEffect(() => {
    const update = (s) => setState(s);
    audioListeners.add(update);
    const ctx = getGlobalAudioContext();
    if (ctx) {
      setState(ctx.state);
    }
    return () => {
      audioListeners.delete(update);
    };
  }, []);

  return {
    state,
    isSuspended: state === "suspended",
    isUnlocked: state === "running",
    unlock: unlockAudio,
  };
}

/**
 * Génère et joue un bip audio synthétique via l'API Web Audio (résistant aux blocages d'autoplay).
 * @returns {(freq?: number) => void}
 */
export function useBeep() {
  return useCallback((freq = 720) => {
    try {
      const ctx = getGlobalAudioContext();
      if (!ctx) return;

      if (ctx.state === "suspended") {
        ctx.resume();
      }

      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.36);
    } catch {
      /* audio indisponible */
    }
  }, []);
}

/**
 * Mesure la largeur réelle du conteneur DOM (pas de la fenêtre).
 * Utile pour adapter le layout même dans un iframe étroit.
 * Ref callback : suit l'élément même s'il est remplacé (écran de chargement puis application).
 * @returns {[(el: HTMLElement | null) => void, number]}
 */
export function useContainerWidth() {
  const [el, setEl] = useState(null);
  const [width, setWidth] = useState(1024);
  useEffect(() => {
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) setWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [setEl, width];
}

/**
 * Horloge en temps réel. Chaque tic re-rend le composant appelant : sur un gros écran,
 * prendre un intervalle long (affichage à la minute) et isoler les chronos à la seconde dans une feuille.
 * @param {number} intervalMs
 * @returns {number} Timestamp courant en ms
 */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export { useModules, DEFAULT_MODULES_CONFIG } from "./useModules.js";
