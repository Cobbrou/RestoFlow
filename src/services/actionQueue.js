const QUEUE_STORAGE_KEY = "restoflow_offline_actions_v1";

let queue = [];
const queueListeners = new Set();
let isFlushing = false;

// Load persisted queue on module init
try {
  const saved = localStorage.getItem(QUEUE_STORAGE_KEY);
  if (saved) {
    queue = JSON.parse(saved);
  }
} catch {
  queue = [];
}

function persistQueue() {
  try {
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.error("Failed to save offline action queue", err);
  }
  notifyListeners();
}

function notifyListeners() {
  queueListeners.forEach((cb) => cb(queue.length, [...queue]));
}

export function subscribeQueue(callback) {
  queueListeners.add(callback);
  callback(queue.length, [...queue]);
  return () => queueListeners.delete(callback);
}

export function getPendingQueueCount() {
  return queue.length;
}

export function enqueueAction(type, payload) {
  const action = {
    id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    type,
    payload,
    timestamp: Date.now(),
    retries: 0,
  };
  queue.push(action);
  persistQueue();
  return action;
}

export async function flushQueue(socket) {
  if (!socket || !socket.connected || isFlushing || queue.length === 0) {
    return;
  }

  isFlushing = true;

  try {
    while (queue.length > 0 && socket.connected) {
      const action = queue[0];

      try {
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Ack timeout"));
          }, 6000);

          socket.emit(action.type, action.payload, (ack) => {
            clearTimeout(timeout);
            if (ack && ack.error) {
              reject(new Error(ack.error));
            } else {
              resolve(ack);
            }
          });
        });

        // Action succeeded, remove from queue
        queue.shift();
        persistQueue();
      } catch (err) {
        console.warn(`Failed to replay offline action ${action.type}:`, err);
        action.retries = (action.retries || 0) + 1;
        if (action.retries > 5) {
          // Drop poisoned action after 5 failures to unblock queue
          console.error("Action exceeded max retries, discarding:", action);
          queue.shift();
          persistQueue();
        } else {
          // Pause flushing until next attempt / reconnection
          break;
        }
      }
    }
  } finally {
    isFlushing = false;
  }
}
