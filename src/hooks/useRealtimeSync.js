import { useEffect } from "react";
import { getSocket, hasValidSessionToken } from "../services/socket.js";
import { flushQueue } from "../services/actionQueue.js";

const upsertById = (list, item) =>
  list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item];

/**
 * Synchronisation temps réel Socket.IO : applique les diffusions du serveur à l'état local,
 * notifie (toasts / bips) et rejoue la file hors-ligne une fois la session confirmée.
 */
export function useRealtimeSync(store, { pushToast, beep, soundOn, onAuthRequired }) {
  const {
    setTables, setOrders, setReservations, setHistory, setProducts, setMenus, setStaff, setRoles,
    setIngredients, setRecipes, setStockMovements, setClosings, setConfig, applyServerState, requestSync,
  } = store;

  useEffect(() => {
    const socket = getSocket();
    const ring = (freq) => {
      if (soundOn) beep(freq);
    };
    const tablesToast = (verb, payload) => {
      const from = payload?.sourceTableNumber ?? payload?.fromTableNumber;
      const to = payload?.targetTableNumber ?? payload?.toTableNumber;
      if (from && to) pushToast(verb(from, to), "server");
    };

    const handlers = {
      "sync:init": applyServerState,
      "table:updated": (table) => setTables((prev) => prev.map((t) => (t.id === table.id ? table : t))),
      "order:updated": (order) => setOrders((prev) => upsertById(prev, order)),
      "order:closed": ({ orderId }) => setOrders((prev) => prev.filter((o) => o.id !== orderId)),

      "history:new_entry": (entry) => {
        if (!entry) return;
        setHistory((prev) => {
          const match = (h) =>
            h.id === entry.id ||
            (entry.orderId && h.orderId && h.orderId === entry.orderId) ||
            (entry.ticketNumber && h.ticketNumber && h.ticketNumber === entry.ticketNumber);
          return prev.some(match) ? prev.map((h) => (match(h) ? entry : h)) : [entry, ...prev];
        });
      },

      "kitchen:new_ticket": ({ tableNumber, server }) => {
        pushToast(`🔔 Nouvelle commande — Table ${tableNumber} (${server})`, "kitchen");
        ring(760);
      },
      "server:order_ready": ({ tableNumber }) => {
        pushToast(`🔔 Commande de la Table ${tableNumber} prête !`, "server");
        ring(980);
      },
      "catalog:product_86": ({ name, available, by }) => {
        pushToast(available ? `✅ ${name} de nouveau disponible` : `⛔ 86 — ${name} en rupture${by ? ` (${by})` : ""}`, available ? "server" : "warn");
        if (!available) ring(440);
      },
      "kitchen:call_course": ({ tableNumber, courseLabel, course, server }) => {
        pushToast(`🔔 Table ${tableNumber} — Réclame : ${courseLabel ? courseLabel.toUpperCase() : course} (${server})`, "kitchen");
        ring(840);
      },

      "reservation:created": (reservation) => {
        setReservations((prev) => [reservation, ...prev.filter((r) => r.id !== reservation.id)]);
        pushToast(`📅 Réservation créée : ${reservation.customerName} (${reservation.guests}p à ${reservation.time})`, "server");
      },
      "reservation:updated": (reservation) =>
        setReservations((prev) => prev.map((r) => (r.id === reservation.id ? reservation : r))),
      "reservation:deleted": ({ id }) => setReservations((prev) => prev.filter((r) => r.id !== id)),

      "tables:transferred": (p) => tablesToast((from, to) => `↔️ Table ${from} transférée vers Table ${to}`, p),
      "tables:merged": (p) => tablesToast((from, to) => `🔗 Table ${from} fusionnée dans Table ${to}`, p),

      "stock:updated": setIngredients,
      "recipe:updated": setRecipes,
      "stock:movements_updated": setStockMovements,
      "catalog:products_updated": setProducts,
      "stock:alert": ({ message }) => {
        pushToast(message, "warn");
        ring(620);
      },

      "config:updated": (cfg) => {
        if (cfg) setConfig(cfg);
      },
      "config:modules_updated": (modules) => {
        if (modules) setConfig((prev) => ({ ...prev, modulesConfig: modules }));
      },

      "closing:new_z": (closing) => {
        if (!closing) return;
        setClosings((prev) => [closing, ...prev.filter((c) => c.id !== closing.id)]);
        setHistory((prev) =>
          prev.map((h) => {
            if (!h.closedInZId && closing.periodStart && closing.periodEnd) {
              const t = new Date(h.createdAt).getTime();
              if (t >= new Date(closing.periodStart).getTime() && t <= new Date(closing.periodEnd).getTime()) {
                return { ...h, closedInZId: closing.id };
              }
            }
            return h;
          })
        );
        pushToast(`Clôture ${closing.reportNumber || "Z"} enregistrée`, "server");
      },

      "tables:list": setTables,
      "menus:list": setMenus,
      "staff:list": setStaff,
      "roles:list": setRoles,

      // Le serveur confirme la session (auth:ok) avant tout rejeu : sinon les actions seraient rejetées puis perdues
      "auth:ok": async () => {
        try {
          const syncResult = await flushQueue(socket);
          if (syncResult && syncResult.flushed > 0) {
            pushToast(`Reconnexion réussie — ${syncResult.flushed} action(s) synchronisée(s)`, "server");
          }
        } catch (err) {
          console.warn("[App] Erreur vidage file au retour en ligne :", err);
        }
        requestSync();
      },
      // Session absente/expirée côté serveur : retour à l'écran PIN (sans reconnexion, évite une boucle)
      "auth:required": onAuthRequired,
      // Erreurs levées par les guards serveur (droits insuffisants, session invalide)
      exception: (err) => pushToast(err?.message || "Action refusée par le serveur", "warn"),
    };

    for (const [event, handler] of Object.entries(handlers)) socket.on(event, handler);
    if (socket.connected && hasValidSessionToken()) flushQueue(socket);

    return () => {
      for (const [event, handler] of Object.entries(handlers)) socket.off(event, handler);
    };
  }, [
    soundOn, beep, pushToast, onAuthRequired,
    // Stables (setters React et useCallback du store)
    setTables, setOrders, setReservations, setHistory, setProducts, setMenus, setStaff, setRoles,
    setIngredients, setRecipes, setStockMovements, setClosings, setConfig, applyServerState, requestSync,
  ]);
}
