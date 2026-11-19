import type { Project } from '../engine/model/project.ts';

/**
 * Autosave in IndexedDB (bleibt lokal im Browser, kein Cloud-Dienst).
 * Ein Objektspeicher «projects» mit dem Schlüssel «autosave».
 */
const DB_NAME = 'filius-web';
const STORE = 'projects';
const AUTOSAVE_KEY = 'autosave';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB nicht verfügbar'));
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = run(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('IndexedDB-Fehler'));
    });
  } finally {
    db.close();
  }
}

export async function saveAutosave(project: Project): Promise<void> {
  await withStore('readwrite', (store) => store.put(JSON.stringify(project), AUTOSAVE_KEY));
}

export async function loadAutosave(): Promise<string | null> {
  if (typeof indexedDB === 'undefined') return null;
  const value = await withStore<unknown>('readonly', (store) => store.get(AUTOSAVE_KEY));
  return typeof value === 'string' ? value : null;
}
