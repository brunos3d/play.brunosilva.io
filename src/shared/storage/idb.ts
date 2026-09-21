/**
 * Minimal promise wrapper over IndexedDB.
 *
 * Every call degrades to a no-op when IndexedDB is missing or blocked (private
 * windows, server rendering), so the game stays playable without persistence.
 */

const DB_NAME = "minigames";
const DB_VERSION = 1;

export const STORES = {
  /** In-progress and finished boards, keyed by puzzle id. */
  games: "games",
  /** One record per completed daily puzzle, keyed by Pacific date. */
  daily: "daily",
  /** Best times and counters, keyed by a stat name. */
  stats: "stats",
} as const;

export type StoreName = (typeof STORES)[keyof typeof STORES];

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        for (const store of Object.values(STORES)) {
          if (!db.objectStoreNames.contains(store)) db.createObjectStore(store);
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        resolve(db);
      };
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

function run<T>(
  store: StoreName,
  mode: IDBTransactionMode,
  operation: (objectStore: IDBObjectStore) => IDBRequest<T>,
): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise<T | undefined>((resolve) => {
        if (!db) return resolve(undefined);
        try {
          const tx = db.transaction(store, mode);
          const request = operation(tx.objectStore(store));
          let result: T | undefined;
          request.onsuccess = () => {
            result = request.result;
          };
          tx.oncomplete = () => resolve(result);
          tx.onerror = () => resolve(undefined);
          tx.onabort = () => resolve(undefined);
        } catch {
          resolve(undefined);
        }
      }),
  );
}

export function idbGet<T>(store: StoreName, key: string): Promise<T | undefined> {
  return run<T>(store, "readonly", (s) => s.get(key) as IDBRequest<T>);
}

export async function idbSet<T>(store: StoreName, key: string, value: T): Promise<void> {
  await run(store, "readwrite", (s) => s.put(value, key));
}

export async function idbDelete(store: StoreName, key: string): Promise<void> {
  await run(store, "readwrite", (s) => s.delete(key));
}

export async function idbGetAll<T>(store: StoreName): Promise<T[]> {
  return (await run<T[]>(store, "readonly", (s) => s.getAll() as IDBRequest<T[]>)) ?? [];
}

export async function idbKeys(store: StoreName): Promise<string[]> {
  const keys = await run<IDBValidKey[]>(store, "readonly", (s) => s.getAllKeys());
  return (keys ?? []).map(String);
}

/** Test hook: forget the cached connection so a fresh database can be opened. */
export function resetIdbConnection(): void {
  dbPromise = null;
}
