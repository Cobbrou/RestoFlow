import { openDB } from "idb";

const DB_NAME = "restoflow_db";
const DB_VERSION = 1;

let dbPromise = null;

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Store pour l'état applicatif complet (snapshot & collections)
        if (!db.objectStoreNames.contains("state")) {
          db.createObjectStore("state");
        }

        // Store pour la file d'attente d'actions hors-ligne persistée
        if (!db.objectStoreNames.contains("offline_actions")) {
          const actionStore = db.createObjectStore("offline_actions", { keyPath: "id" });
          actionStore.createIndex("timestamp", "timestamp");
          actionStore.createIndex("status", "status");
        }

        // Store pour l'authentification & sessions locales
        if (!db.objectStoreNames.contains("auth")) {
          db.createObjectStore("auth");
        }
      },
    });
  }
  return dbPromise;
}

// ── Gestion de l'état applicatif ────────────────────────────

const STATE_KEYS = [
  "tables",
  "orders",
  "reservations",
  "history",
  "products",
  "menus",
  "staff",
  "roles",
  "ingredients",
  "recipes",
  "stockMovements",
  "config",
  "lastSync",
];

/**
 * Sauvegarde complète de l'état applicatif en une transaction atomique IndexedDB.
 */
export async function saveFullState(fullState) {
  if (!fullState || typeof fullState !== "object") return;
  try {
    const db = await getDB();
    const tx = db.transaction("state", "readwrite");
    const store = tx.objectStore("state");

    for (const key of STATE_KEYS) {
      if (fullState[key] !== undefined) {
        await store.put(fullState[key], key);
      }
    }
    await store.put(Date.now(), "lastSync");
    await tx.done;
  } catch (err) {
    console.warn("[IndexedDB] Erreur lors de la sauvegarde complète de l'état :", err);
  }
}

/**
 * Sauvegarde d'une seule collection (ex: 'tables', 'orders', 'stockMovements').
 */
export async function saveCollection(collectionName, data) {
  try {
    const db = await getDB();
    await db.put("state", data, collectionName);
  } catch (err) {
    console.warn(`[IndexedDB] Erreur sauvegarde collection ${collectionName} :`, err);
  }
}

/**
 * Charge tout l'état disponible dans IndexedDB au démarrage.
 * Renvoie null si aucune donnée n'a encore été persistée.
 */
export async function loadCachedState() {
  try {
    const db = await getDB();
    const tx = db.transaction("state", "readonly");
    const store = tx.objectStore("state");

    const result = {};
    let hasData = false;

    for (const key of STATE_KEYS) {
      const val = await store.get(key);
      if (val !== undefined) {
        result[key] = val;
        if (Array.isArray(val) && val.length > 0) hasData = true;
        if (typeof val === "object" && val !== null && Object.keys(val).length > 0) hasData = true;
      }
    }
    await tx.done;

    return hasData ? result : null;
  } catch (err) {
    console.warn("[IndexedDB] Erreur chargement de l'état en cache :", err);
    return null;
  }
}

// ── Gestion de la file d'attente d'actions hors-ligne ────────

/**
 * Récupère toutes les actions hors-ligne triées par timestamp ascendant.
 */
export async function getOfflineActionsFromDB() {
  try {
    const db = await getDB();
    const actions = await db.getAllFromIndex("offline_actions", "timestamp");
    return actions || [];
  } catch (err) {
    console.warn("[IndexedDB] Erreur lecture actions offline :", err);
    return [];
  }
}

/**
 * Ajoute ou met à jour une action hors-ligne dans IndexedDB.
 */
export async function saveOfflineActionToDB(action) {
  try {
    const db = await getDB();
    await db.put("offline_actions", action);
  } catch (err) {
    console.warn("[IndexedDB] Erreur ajout action offline :", err);
  }
}

/**
 * Supprime une action hors-ligne d'IndexedDB une fois acquittée ou abandonnée.
 */
export async function removeOfflineActionFromDB(id) {
  try {
    const db = await getDB();
    await db.delete("offline_actions", id);
  } catch (err) {
    console.warn("[IndexedDB] Erreur suppression action offline :", err);
  }
}

/**
 * Met à jour le statut ou les tentatives d'une action hors-ligne.
 */
export async function updateOfflineActionInDB(id, patch) {
  try {
    const db = await getDB();
    const existing = await db.get("offline_actions", id);
    if (existing) {
      await db.put("offline_actions", { ...existing, ...patch });
    }
  } catch (err) {
    console.warn("[IndexedDB] Erreur mise à jour action offline :", err);
  }
}

/**
 * Vide toutes les actions hors-ligne (ex: purge manuelle).
 */
export async function clearOfflineActionsFromDB() {
  try {
    const db = await getDB();
    await db.clear("offline_actions");
  } catch (err) {
    console.warn("[IndexedDB] Erreur purge actions offline :", err);
  }
}

// ── Gestion du cache d'authentification hors-ligne ──────────

export async function saveCachedAuth(currentStaff, sessionToken = null) {
  try {
    const db = await getDB();
    await db.put("auth", currentStaff, "currentStaff");
    if (sessionToken) {
      await db.put("auth", sessionToken, "sessionToken");
    }
  } catch (err) {
    console.warn("[IndexedDB] Erreur sauvegarde cache auth :", err);
  }
}

export async function loadCachedAuth() {
  try {
    const db = await getDB();
    const currentStaff = await db.get("auth", "currentStaff");
    const sessionToken = await db.get("auth", "sessionToken");
    return { currentStaff: currentStaff || null, sessionToken: sessionToken || null };
  } catch (err) {
    console.warn("[IndexedDB] Erreur chargement cache auth :", err);
    return { currentStaff: null, sessionToken: null };
  }
}

// ── Cache & Vérification des PINs pour le mode hors-ligne ───

async function hashPin(pin, salt = "restoflow_pin_salt_v1") {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const enc = new TextEncoder();
    const data = enc.encode(`${salt}:${pin}`);
    const hashBuf = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hashBuf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  let h = 0;
  const str = `${salt}:${pin}`;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return h.toString(16);
}

export async function saveStaffOfflinePin(staffId, pin, staff) {
  try {
    const db = await getDB();
    const pinHash = await hashPin(pin);
    await db.put("auth", { staffId, pinHash, staff, updatedAt: Date.now() }, `staff_pin_${staffId}`);
  } catch (err) {
    console.warn("[IndexedDB] Erreur sauvegarde PIN offline :", err);
  }
}

export async function verifyStaffOfflinePin(staffId, candidatePin) {
  try {
    const db = await getDB();
    const record = await db.get("auth", `staff_pin_${staffId}`);
    if (!record) return null;
    const candidateHash = await hashPin(candidatePin);
    if (record.pinHash === candidateHash) {
      return record.staff;
    }
    return null;
  } catch (err) {
    console.warn("[IndexedDB] Erreur vérification PIN offline :", err);
    return null;
  }
}

