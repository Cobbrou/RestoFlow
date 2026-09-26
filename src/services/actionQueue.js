import {
  getOfflineActionsFromDB,
  saveOfflineActionToDB,
  removeOfflineActionFromDB,
  updateOfflineActionInDB,
  clearOfflineActionsFromDB,
} from "./db.js";

const QUEUE_STORAGE_KEY = "restoflow_offline_actions_v1";

let queue = [];
const queueListeners = new Set();
let isFlushing = false;
let isInitialized = false;

// 1. Initialisation asynchrone depuis IndexedDB avec fallback localStorage
async function initQueue() {
  if (isInitialized) return;

  try {
    const dbActions = await getOfflineActionsFromDB();
    if (dbActions && dbActions.length > 0) {
      queue = dbActions;
    } else {
      // Migration éventuelle depuis localStorage
      const saved = localStorage.getItem(QUEUE_STORAGE_KEY);
      if (saved) {
        queue = JSON.parse(saved);
        for (const action of queue) {
          await saveOfflineActionToDB(action);
        }
        localStorage.removeItem(QUEUE_STORAGE_KEY);
      }
    }
  } catch (err) {
    console.warn("[actionQueue] Échec chargement IndexedDB, fallback localStorage :", err);
    try {
      const saved = localStorage.getItem(QUEUE_STORAGE_KEY);
      if (saved) queue = JSON.parse(saved);
    } catch {
      queue = [];
    }
  } finally {
    isInitialized = true;
    notifyListeners();
  }
}

// Lancement immédiat de l'init
if (typeof window !== "undefined") {
  initQueue();
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

export function getPendingQueueCount() {
  return queue.length;
}

export function getQueue() {
  return [...queue];
}

export function isQueueFlushing() {
  return isFlushing;
}

/**
 * Enfile une action pour exécution différée.
 */
export function enqueueAction(type, payload) {
  const action = {
    id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    type,
    payload,
    timestamp: Date.now(),
    retries: 0,
    status: "pending", // pending | syncing | failed
    lastError: null,
  };

  queue.push(action);

  // Persistance asynchrone IndexedDB + miroir localStorage de sécurité
  saveOfflineActionToDB(action).catch(() => {});
  try {
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
  } catch {}

  notifyListeners();
  return action;
}

/**
 * Supprime manuellement une action de la file d'attente (ex: action toxique ou doublon annulé).
 */
export async function discardAction(actionId) {
  queue = queue.filter((a) => a.id !== actionId);
  await removeOfflineActionFromDB(actionId);
  try {
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
  } catch {}
  notifyListeners();
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
 * Rejoue toutes les actions en attente dès que le socket est connecté.
 * Renvoie un rapport { flushed: number, errors: number, remaining: number }
 */
export async function flushQueue(socket) {
  if (!socket || !socket.connected || isFlushing || queue.length === 0) {
    return { flushed: 0, errors: 0, remaining: queue.length };
  }

  isFlushing = true;
  notifyListeners();

  let flushedCount = 0;
  let errorCount = 0;

  try {
    while (queue.length > 0 && socket.connected) {
      const action = queue[0];
      action.status = "syncing";
      notifyListeners();

      try {
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Délai d'acquittement dépassé (timeout 8s)"));
          }, 8000);

          socket.emit(action.type, action.payload, (ack) => {
            clearTimeout(timeout);
            if (ack && ack.error) {
              reject(new Error(ack.error));
            } else {
              resolve(ack);
            }
          });
        });

        // Succès de l'action : on retire de la file
        queue.shift();
        flushedCount++;
        await removeOfflineActionFromDB(action.id);
        try {
          localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
        } catch {}
        notifyListeners();
      } catch (err) {
        console.warn(`[actionQueue] Échec replay de l'action ${action.type}:`, err);
        errorCount++;
        action.retries = (action.retries || 0) + 1;
        action.status = "failed";
        action.lastError = err.message || "Erreur inconnue";

        await updateOfflineActionInDB(action.id, {
          retries: action.retries,
          status: "failed",
          lastError: action.lastError,
        });

        if (action.retries >= 5) {
          // Action trop ancienne ou rejetée définitivement par le serveur
          console.error("[actionQueue] Action abandonnée après 5 échecs consécutifs :", action);
          queue.shift();
          await removeOfflineActionFromDB(action.id);
          try {
            localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
          } catch {}
          notifyListeners();
        } else {
          // On marque en pause et on tente les suivantes ou on attend la prochaine reconnexion
          notifyListeners();
          break;
        }
      }
    }
  } finally {
    isFlushing = false;
    notifyListeners();
  }

  return {
    flushed: flushedCount,
    errors: errorCount,
    remaining: queue.length,
  };
}
