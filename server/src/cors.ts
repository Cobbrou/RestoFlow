// Origines autorisées (HTTP + WebSocket), ex : CORS_ORIGIN="http://caisse.local:5173,http://192.168.1.20:5173"
export const ALLOWED_ORIGINS = (process.env.CORS_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
