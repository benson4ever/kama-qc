import { openDB } from 'idb';

const DB_NAME = 'kama-qc';
const STORE = 'drafts';

const dbPromise = openDB(DB_NAME, 1, {
  upgrade(db) {
    if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
  },
});

export async function getDraft(key) {
  return (await dbPromise).get(STORE, key);
}
export async function setDraft(key, value) {
  return (await dbPromise).put(STORE, value, key);
}
export async function clearDraft(key) {
  return (await dbPromise).delete(STORE, key);
}
