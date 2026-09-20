import { useRef, useCallback, useState, useEffect } from "react";

/**
 * Génère et joue un bip audio synthétique via l'API Web Audio.
 * @returns {(freq?: number) => void}
 */
export function useBeep() {
  const ctxRef = useRef(null);
  return useCallback((freq = 720) => {
    try {
      if (!ctxRef.current)
        ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const ctx = ctxRef.current;
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
 * @returns {[React.RefObject, number]}
 */
export function useContainerWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(1024);
  useEffect(() => {
    if (!ref.current || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) setWidth(entry.contentRect.width);
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

/**
 * Horloge en temps réel — se met à jour toutes les secondes.
 * @returns {number} Timestamp courant en ms
 */
export function useNow() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}
