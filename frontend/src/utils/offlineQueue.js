/**
 * Offline sale queue backed by IndexedDB.
 *
 * Shops in Pakistan lose connectivity regularly, and a POS that refuses to
 * ring up a sale during an outage is worse than the paper register it replaces.
 * Sales made while offline are stored locally and pushed to the server once the
 * connection returns.
 *
 * Every queued sale carries a clientRef (idempotency key) so a retry that
 * crosses with a slow server response can't create a duplicate receipt.
 *
 * localStorage is deliberately not used: it's synchronous (janks the POS on
 * write) and capped around 5MB, which a busy day of queued sales could hit.
 */

const DB_NAME = 'retailpro-offline';
const DB_VERSION = 1;
const STORE = 'pending-sales';

const openDB = () =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'clientRef' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const withStore = async (mode, callback) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    const result = callback(store);
    tx.oncomplete = () => {
      db.close();
      resolve(result?.result !== undefined ? result.result : result);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
};

export const generateClientRef = () =>
  (crypto.randomUUID && crypto.randomUUID()) ||
  `ref-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export const queueSale = (sale) => withStore('readwrite', (store) => store.put(sale));

export const getQueuedSales = () => withStore('readonly', (store) => store.getAll());

export const removeQueuedSale = (clientRef) =>
  withStore('readwrite', (store) => store.delete(clientRef));

export const countQueuedSales = () => withStore('readonly', (store) => store.count());

/**
 * Flushes the queue. Returns { synced, failed, conflicts }.
 *
 * A sale that fails because stock ran out while offline is a genuine business
 * conflict, not a transient error - it's removed from the queue and reported
 * back so the shopkeeper can reconcile, rather than retrying forever.
 */
export const flushQueue = async (submitSale) => {
  const pending = await getQueuedSales();
  let synced = 0;
  const conflicts = [];
  let failed = 0;

  for (const sale of pending) {
    try {
      await submitSale({ ...sale.payload, clientRef: sale.clientRef, syncedFromOffline: true });
      await removeQueuedSale(sale.clientRef);
      synced += 1;
    } catch (err) {
      const status = err.response?.status;
      // 4xx (except 401/429) means the server rejected the sale on its merits -
      // retrying won't help, so surface it and stop holding the queue up.
      if (status >= 400 && status < 500 && status !== 401 && status !== 429) {
        conflicts.push({
          clientRef: sale.clientRef,
          queuedAt: sale.queuedAt,
          total: sale.payload?.displayTotal,
          reason: err.response?.data?.message || 'Rejected by server',
        });
        await removeQueuedSale(sale.clientRef);
      } else {
        failed += 1; // network or server error - keep it for the next attempt
      }
    }
  }

  return { synced, failed, conflicts };
};
