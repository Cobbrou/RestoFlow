import { io } from "socket.io-client";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";

let socket = null;
const statusListeners = new Set();
let isConnected = false;

export function getSocket() {
  if (!socket) {
    socket = io(BACKEND_URL, {
      transports: ["websocket", "polling"],
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

export function emitEvent(event, data, ackTimeout = 5000) {
  const s = getSocket();
  return new Promise((resolve, reject) => {
    if (!s || !s.connected) {
      reject(new Error("Socket not connected"));
      return;
    }

    let timer = null;
    if (ackTimeout > 0) {
      timer = setTimeout(() => {
        reject(new Error(`Timeout waiting for ack on ${event}`));
      }, ackTimeout);
    }

    s.emit(event, data, (response) => {
      if (timer) clearTimeout(timer);
      resolve(response);
    });
  });
}
