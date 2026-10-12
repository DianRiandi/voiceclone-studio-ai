const DB_NAME = 'voiceclone-studio-ai';
const DB_VERSION = 1;
let dbPromise;
function database() {
  if (!('indexedDB' in window)) return Promise.reject(new Error('IndexedDB tidak tersedia di browser ini.'));
  if (!dbPromise) dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('voices')) db.createObjectStore('voices', { keyPath:'id' });
      if (!db.objectStoreNames.contains('history')) db.createObjectStore('history', { keyPath:'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}
async function request(store, mode, fn) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const result = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(result?.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Database transaction dibatalkan'));
  });
}
export const getVoices = () => request('voices','readonly', s => s.getAll());
export const saveVoice = record => request('voices','readwrite', s => s.put(record));
export const deleteVoice = id => request('voices','readwrite', s => s.delete(id));
export const getHistory = () => request('history','readonly', s => s.getAll());
export const saveHistory = record => request('history','readwrite', s => s.put(record));
export const deleteHistory = id => request('history','readwrite', s => s.delete(id));
