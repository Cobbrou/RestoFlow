import { io } from "socket.io-client";

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ||
  (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");

let socket = null;
const statusListeners = new Set();
let isConnected = false;

function getSavedToken() {
  try {
    return localStorage.getItem("rf_session_token") || null;
  } catch {
    return null;
  }
}

/**
 * Vrai si un jeton serveur non expiré est présent (le jeton "offline-token" du mode hors-ligne ne compte pas).
 * Lecture de l'expiration seulement : la signature reste vérifiée par le serveur.
 */
export function hasValidSessionToken() {
  const token = getSavedToken();
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.exp === "number" && payload.exp > Date.now();
  } catch {
    return false;
  }
}

/**
 * Oublie le jeton sans forcer de reconnexion (utilisé quand le serveur exige une nouvelle connexion PIN)
 */
export function clearSessionToken() {
  try {
    localStorage.removeItem("rf_session_token");
  } catch {}
  if (socket) socket.auth = {};
}

export function setSocketToken(token) {
  try {
    if (token) {
      localStorage.setItem("rf_session_token", token);
    } else {
      localStorage.removeItem("rf_session_token");
    }
  } catch {}

  if (socket) {
    socket.auth = { token };
    if (socket.connected) {
      // Déclenche une reconnexion pour rafraîchir l'authentification handshake
      socket.disconnect().connect();
    }
  }
}

export function getSocket() {
  if (!socket) {
    const token = getSavedToken();
    socket = io(BACKEND_URL, {
      transports: ["websocket", "polling"],
      auth: token ? { token } : {},
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    socket.on("connect", () => {
      isConnected = true;
      statusListeners.forEach((cb) => cb({ connected: true, socketId: socket.id }));
    });

    socket.on("disconnect", (reason) => {
      isConnected = false;
      statusListeners.forEach((cb) => cb({ connected: false, reason }));
    });

    socket.on("connect_error", (error) => {
      isConnected = false;
      statusListeners.forEach((cb) => cb({ connected: false, error: error.message }));
    });
  }

  return socket;
}

export function subscribeSocketStatus(callback) {
  statusListeners.add(callback);
  callback({ connected: isConnected, socketId: socket?.id });
  return () => {
    statusListeners.delete(callback);
  };
}
