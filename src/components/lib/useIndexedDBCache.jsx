/**
 * useIndexedDBCache — Fase 3
 * Cache de segundo nível com IndexedDB para sessões longas.
 * Persiste dados entre recarregamentos (além do localStorage que é limitado a ~5MB).
 * API simples: get(key), set(key, value, ttlMs), clear()
 */

const DB_NAME = 'erp_cache_v1';
const STORE_NAME = 'query_cache';
const DB_VERSION = 1;

let _db = null;

async function openDB() {
  if (_db) return _db;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        store.createIndex('expires_at', 'expires_at', { unique: false });
      }
    };
    req.onsuccess = () => { _db = req.result; resolve(_db); };
    req.onerror = () => reject(req.error);
  });
}

export async function idbGet(key) {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => {
        const rec = req.result;
        if (!rec) return resolve(undefined);
        if (rec.expires_at && rec.expires_at < Date.now()) {
          // Expirado — remove assincronamente e retorna undefined
          idbDelete(key).catch(() => {});
          return resolve(undefined);
        }
        resolve(rec.value);
      };
      req.onerror = () => resolve(undefined);
    });
  } catch (_) { return undefined; }
}

export async function idbSet(key, value, ttlMs = 10 * 60 * 1000) {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put({
        key,
        value,
        stored_at: Date.now(),
        expires_at: Date.now() + ttlMs,
      });
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch (_) { return false; }
}

export async function idbDelete(key) {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch (_) { return false; }
}

export async function idbClearExpired() {
  try {
    const db = await openDB();
    const now = Date.now();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const idx = store.index('expires_at');
      const range = IDBKeyRange.upperBound(now);
      const req = idx.openCursor(range);
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) { cursor.delete(); cursor.continue(); }
      };
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch (_) { return false; }
}

/**
 * Hook React para usar o cache IDB diretamente
 * Retorna { get, set, clearExpired }
 */
export function useIndexedDBCache() {
  return { get: idbGet, set: idbSet, delete: idbDelete, clearExpired: idbClearExpired };
}

export default useIndexedDBCache;
