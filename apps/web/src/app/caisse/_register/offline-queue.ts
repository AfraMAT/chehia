/**
 * Offline sale queue (IndexedDB). When the register is offline, a completed sale
 * is stored here with its FROZEN priced lines + total (the cash was collected at
 * that price) and the cashier gets a provisional receipt. On reconnect the queue
 * drains through register-order (replaying the frozen prices — never repricing)
 * + settle-order, both idempotent (client_ref / paid_at), so a re-drain can't
 * double-post or double-charge, and a menu/price edit during the offline window
 * can't change what the customer already paid. A sale that the server
 * PERMANENTLY rejects (deleted item, inactive venue) is moved to `failed-sales`
 * for the cashier to reconcile — never retried forever, never silently lost.
 */

const DB_NAME = "chehia-caisse";
const STORE = "pending-sales";
const FAILED = "failed-sales";
const VERSION = 2;

/** A line frozen at sale time (mirrors the order_items snapshot shape). */
export interface FrozenLine {
  item_id: string;
  qty: number;
  unit_price_millimes: number;
  name_snapshot: unknown;
  modifiers_snapshot: unknown[];
  note: string;
}

export interface PendingSale {
  id: string; // local id (uuid) — also the provisional ticket number
  client_ref: string; // idempotency for register-order
  settle_ref: string; // idempotency for settle-order
  table_id: string;
  order_type: string;
  note: string;
  lines: FrozenLine[]; // FROZEN priced lines — replayed as-is, never repriced
  subtotal_millimes: number; // FROZEN total the customer actually paid
  method: string;
  tendered_millimes: number | null;
  at: number;
  attempts: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(FAILED)) db.createObjectStore(FAILED, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const os = db.transaction(store, mode).objectStore(store);
    const req = fn(os);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function enqueueSale(sale: PendingSale): Promise<void> {
  await tx(STORE, "readwrite", (s) => s.put(sale));
}

export async function allSales(): Promise<PendingSale[]> {
  try {
    const rows = await tx<PendingSale[]>(STORE, "readonly", (s) => s.getAll() as IDBRequest<PendingSale[]>);
    return rows.sort((a, b) => a.at - b.at);
  } catch {
    return [];
  }
}

export async function updateSale(sale: PendingSale): Promise<void> {
  await tx(STORE, "readwrite", (s) => s.put(sale));
}

export async function removeSale(id: string): Promise<void> {
  await tx(STORE, "readwrite", (s) => s.delete(id));
}

export async function pendingCount(): Promise<number> {
  try {
    return await tx<number>(STORE, "readonly", (s) => s.count());
  } catch {
    return 0;
  }
}

/** Move a sale the server permanently rejected out of the retry loop. */
export async function deadLetter(sale: PendingSale, reason: string): Promise<void> {
  await tx(FAILED, "readwrite", (s) => s.put({ ...sale, failed_reason: reason, failed_at: Date.now() }));
  await removeSale(sale.id);
}

export async function failedCount(): Promise<number> {
  try {
    return await tx<number>(FAILED, "readonly", (s) => s.count());
  } catch {
    return 0;
  }
}
