// Tiny promise wrapper around IndexedDB.

const DB_NAME = 'mathfacts';
const DB_VERSION = 1;

let dbPromise = null;

function upgrade(db) {
  if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings');
  if (!db.objectStoreNames.contains('presets')) db.createObjectStore('presets', { keyPath: 'id' });
  if (!db.objectStoreNames.contains('sessions')) {
    const s = db.createObjectStore('sessions', { keyPath: 'id' });
    s.createIndex('startedAt', 'startedAt');
  }
  if (!db.objectStoreNames.contains('answers')) {
    const a = db.createObjectStore('answers', { keyPath: 'id' });
    a.createIndex('sessionId', 'sessionId');
    a.createIndex('ts', 'ts');
    a.createIndex('factKey', 'factKey');
    a.createIndex('skillId', 'skillId');
  }
  if (!db.objectStoreNames.contains('factStats')) db.createObjectStore('factStats', { keyPath: 'factKey' });
}

export function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => upgrade(req.result);
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => db.close();
        resolve(db);
      };
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('Database is open in another tab'));
    });
  }
  return dbPromise;
}

export const STORES = ['settings', 'presets', 'sessions', 'answers', 'factStats'];

function promisify(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Run `fn(stores)` inside one transaction; resolves with fn's result once
 * the transaction commits.
 */
export async function transact(names, mode, fn) {
  const db = await openDb();
  const list = Array.isArray(names) ? names : [names];
  const tx = db.transaction(list, mode);
  const stores = Object.fromEntries(list.map((n) => [n, tx.objectStore(n)]));
  const done = new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
  });
  const result = await fn(stores, promisify);
  await done;
  return result;
}

export function get(store, key) {
  return transact(store, 'readonly', (s) => promisify(s[store].get(key)));
}

export function getAll(store, indexName, range) {
  return transact(store, 'readonly', (s) => {
    const src = indexName ? s[store].index(indexName) : s[store];
    return promisify(src.getAll(range));
  });
}

export function put(store, value, key) {
  return transact(store, 'readwrite', (s) => promisify(key === undefined ? s[store].put(value) : s[store].put(value, key)));
}

export function del(store, key) {
  return transact(store, 'readwrite', (s) => promisify(s[store].delete(key)));
}

export function count(store) {
  return transact(store, 'readonly', (s) => promisify(s[store].count()));
}
