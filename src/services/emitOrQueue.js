import { getSocket, hasValidSessionToken } from "./socket.js";
import { enqueueAction, flushQueue, hasPendingActions, newActionId } from "./actionQueue.js";

const ACK_TIMEOUT_MS = 5000;

/**
 * Émet une action vers le serveur, ou l'enfile si hors-ligne.
 * Ordre strict : tant que la file n'est pas vide, toute nouvelle action passe derrière.
 * Chaque action porte un clientActionId : un acquittement perdu => rejouée, et le serveur ignore le doublon.
 * `onRejected(response)` est appelé en cas de refus serveur (ok:false), `onAck(response)` à chaque réponse.
 */
export function emitOrQueue(eventType, payload, { onAck, onRejected } = {}) {
  const socket = getSocket();
  if (!socket?.connected || hasPendingActions()) {
    enqueueAction(eventType, payload);
    if (socket?.connected && hasValidSessionToken()) flushQueue(socket);
    return;
  }

  const clientActionId = newActionId();
  let settled = false;
  const ackTimer = setTimeout(() => {
    if (settled) return;
    settled = true;
    enqueueAction(eventType, payload, clientActionId);
  }, ACK_TIMEOUT_MS);

  socket.emit(eventType, { ...payload, clientActionId }, (response) => {
    clearTimeout(ackTimer);
    if (settled) return;
    settled = true;
    if (response && response.ok === false) onRejected?.(response);
    onAck?.(response);
  });
}
