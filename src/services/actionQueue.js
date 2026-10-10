import {
  getOfflineActionsFromDB,
  saveOfflineActionToDB,
  removeOfflineActionFromDB,
  updateOfflineActionInDB,
  clearOfflineActionsFromDB,
} from "./db.js";

const QUEUE_STORAGE_KEY = "restoflow_offline_actions_v1";
const ACK_TIMEOUT_MS = 8000;

/**
 * File d'actions hors-ligne, strictement ordonnée.
 * Statuts : "pending" (à envoyer) | "syncing" (en cours) | "rejected" (refusée par le serveur, conservée
 * pour décision humaine : jamais supprimée automatiquement).
 * Chaque action est envoyée avec son id comme clientActionId : le serveur ignore un rejeu déjà appliqué.
 */
let queue = [];
const queueListeners = new Set();
let isFlushing = false;

// 1. Initialisation asynchrone depuis IndexedDB avec fallback localStorage
async function loadQueue() {
  let stored = [];
  try {
    stored = (await getOfflineActionsFromDB()) || [];
    if (stored.length === 0) {
      // Migration éventuelle depuis localStorage
      const saved = localStorage.getItem(QUEUE_STORAGE_KEY);
      if (saved) {
        stored = JSON.parse(saved);
        for (const action of stored) await saveOfflineActionToDB(action);
      }
    }
  } catch (err) {
    console.warn("[actionQueue] Échec chargement IndexedDB, fallback localStorage :", err);
    try {
      stored = JSON.parse(localStorage.getItem(QUEUE_STORAGE_KEY) || "[]");
    } catch {
      stored = [];
    }
  }
  // Les actions enfilées pendant le chargement passent après celles déjà stockées (ordre conservé)
  const known = new Set(stored.map((a) => a.id));
  queue = [
    ...stored.map((a) => (a.status === "syncing" ? { ...a, status: "pending" } : a)),
    ...queue.filter((a) => !known.has(a.id)),
  ];
  persistMirror();
  notifyListeners();
}

const ready = typeof window !== "undefined" ? loadQueue() : Promise.resolve();

function persistMirror() {
  try {
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
  } catch {}
}

function notifyListeners() {
  queueListeners.forEach((cb) => {
    try {
      cb(queue.length, [...queue], isFlushing);
    } catch (e) {
      console.error("[actionQueue] Erreur dans le listener :", e);
    }
  });
}

export function subscribeQueue(callback) {
  queueListeners.add(callback);
  callback(queue.length, [...queue], isFlushing);
  return () => queueListeners.delete(callback);
}

/** Vrai si des actions attendent d'être envoyées : toute nouvelle action doit alors passer par la file */
export function hasPendingActions() {
  return isFlushing || queue.some((a) => a.status !== "rejected");
}

export function newActionId() {
  return `act_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Enfile une action pour exécution différée.
 * `id` permet de ré-enfiler une action déjà émise sans acquittement : le serveur la dédupliquera.
 */
export function enqueueAction(type, payload, id = newActionId()) {
  if (queue.some((a) => a.id === id)) return null;
  const action = {
    id,
    type,
    payload,
    timestamp: Date.now(),
    retries: 0,
    status: "pending",
    lastError: null,
  };

  queue.push(action);
  saveOfflineActionToDB(action).catch(() => {});
  persistMirror();
  notifyListeners();
  return action;
}

async function patchAction(action, patch) {
  Object.assign(action, patch);
  await updateOfflineActionInDB(action.id, patch);
  persistMirror();
  notifyListeners();
}

/**
 * Supprime manuellement une action (décision explicite de l'utilisateur).
 */
export async function discardAction(actionId) {
  queue = queue.filter((a) => a.id !== actionId);
  await removeOfflineActionFromDB(actionId);
  persistMirror();
  notifyListeners();
}

/**
 * Remet une action rejetée en attente (ex : après correction côté serveur).
 */
export async function retryAction(actionId) {
  const action = queue.find((a) => a.id === actionId);
  if (action) await patchAction(action, { status: "pending", lastError: null });
}

/**
 * Purge complète de la file d'attente.
 */
export async function clearQueue() {
  queue = [];
  await clearOfflineActionsFromDB();
  try {
    localStorage.removeItem(QUEUE_STORAGE_KEY);
  } catch {}
  notifyListeners();
}

/**
 * Émet une action et attend son acquittement.
 * Un refus des guards serveur n'est pas acquitté mais signalé par l'événement "exception" :
 * session expirée = erreur temporaire (rejouée après reconnexion PIN), droits insuffisants = refus définitif.
 * (La file est séquentielle : l'exception reçue pendant l'attente concerne cette action.)
 */
function emitWithAck(socket, action) {
  return new Promise((resolve, reject) => {
    const done = () => {
      clearTimeout(timer);
      socket.off("exception", onException);
    };
    const onException = (err) => {
      done();
      const message = err?.message || "Action refusée par le serveur";
      if (/session|authentification/i.test(message)) reject(new Error(message));
      else resolve({ ok: false, error: message });
    };
    const timer = setTimeout(() => {
      done();
      reject(new Error(`Délai d'acquittement dépassé (${ACK_TIMEOUT_MS / 1000}s)`));
    }, ACK_TIMEOUT_MS);
    socket.on("exception", onException);
    socket.emit(action.type, { ...action.payload, clientActionId: action.id }, (ack) => {
      done();
      resolve(ack);
    });
  });
}

/**
 * Rejoue les actions en attente, dans l'ordre, dès que le socket est connecté.
 * - acquittée : retirée de la file
 * - refusée par le serveur (ok:false) : marquée "rejected", conservée, la file continue
 * - sans réponse (réseau) : reste "pending", la file s'arrête et reprendra à la prochaine connexion
 * Renvoie un rapport { flushed, rejected, remaining }
 */
export async function flushQueue(socket) {
  await ready;
  if (!socket || !socket.connected || isFlushing) {
    return { flushed: 0, rejected: 0, remaining: queue.length };
  }

  isFlushing = true;
  notifyListeners();

  let flushed = 0;
  let rejected = 0;

  try {
    for (;;) {
      const action = queue.find((a) => a.status === "pending");
      if (!action || !socket.connected) break;
      await patchAction(action, { status: "syncing" });

      let ack;
      try {
        ack = await emitWithAck(socket, action);
      } catch (err) {
        await patchAction(action, { status: "pending", retries: (action.retries || 0) + 1, lastError: err.message });
        break;
      }

      if (ack && (ack.ok === false || ack.error)) {
        rejected++;
        await patchAction(action, { status: "rejected", lastError: ack.error || "Action refusée par le serveur" });
        continue;
      }

      queue = queue.filter((a) => a.id !== action.id);
      await removeOfflineActionFromDB(action.id);
      persistMirror();
      flushed++;
      notifyListeners();
    }
  } finally {
    isFlushing = false;
    notifyListeners();
  }

  return { flushed, rejected, remaining: queue.length };
}
