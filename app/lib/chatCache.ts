/**
 * IndexedDB cache for chat messages (C-hybrid privacy model, browser layer).
 *
 * The canonical store is the host agent's `messages.jsonl` (PerkOS-A2A).
 * This cache is a per-device convenience so the user can scroll back when
 * the host agent is offline.
 *
 * Layout — one database `perkos-chat-cache`, one object store `messages`:
 *
 *   keyPath: "id"  (message id, UUID — unique across wallets/convs)
 *   index: byConv  on `[walletAddress, convId]`     non-unique
 *
 * Records carry `walletAddress` so the cache stays correctly partitioned if
 * a single browser holds sessions for multiple wallets over time.
 */

const DB_NAME = "perkos-chat-cache";
const STORE = "messages";
const VERSION = 1;
const MAX_PER_CONV = 1000;

export interface CachedMessage {
  id: string;
  walletAddress: string;
  convId: string;
  from: string;
  text: string;
  timestamp: string;
  replyTo: string | null;
  /** When this record was last written/seen locally. */
  cachedAt: string;
}

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onerror = () => reject(req.error ?? new Error("indexedDB open failed"));
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("byConv", ["walletAddress", "convId"], { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
  });
}

function tx(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(STORE, mode).objectStore(STORE);
}

function promiseRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("indexedDB request failed"));
  });
}

/**
 * Upsert one or more messages. Safe to call repeatedly — duplicate ids are
 * overwritten (so server timestamps take precedence over optimistic locals).
 */
export async function putMessages(
  walletAddress: string,
  convId: string,
  messages: Array<{
    id: string;
    from: string;
    text: string;
    timestamp: string;
    replyTo?: string | null;
  }>,
): Promise<void> {
  if (!messages.length) return;
  const db = await openDb();
  if (!db) return;

  const store = tx(db, "readwrite");
  const now = new Date().toISOString();
  for (const m of messages) {
    const record: CachedMessage = {
      id: m.id,
      walletAddress: walletAddress.toLowerCase(),
      convId,
      from: m.from,
      text: m.text,
      timestamp: m.timestamp,
      replyTo: m.replyTo ?? null,
      cachedAt: now,
    };
    store.put(record);
  }
  await txDone(store.transaction);

  // Trim if the conv has exceeded MAX_PER_CONV: drop oldest entries.
  await pruneOldest(walletAddress, convId).catch(() => {});
}

/**
 * Read up to `limit` messages for a conv, optionally older than `before`.
 * Returns chronological-ascending order (oldest of the page first), matching
 * the wire-protocol expectation.
 */
export async function getMessages(
  walletAddress: string,
  convId: string,
  opts: { before?: string | null; limit?: number } = {},
): Promise<{ messages: CachedMessage[]; hasMore: boolean }> {
  const db = await openDb();
  if (!db) return { messages: [], hasMore: false };

  const limit = Math.max(1, Math.min(500, opts.limit ?? 50));
  const before = opts.before ?? null;

  const all = await collectByConv(db, walletAddress, convId);
  // Sort descending so we can pull the latest `limit` filtered by `before`.
  all.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  const filtered: CachedMessage[] = [];
  for (const m of all) {
    if (before && m.timestamp >= before) continue;
    if (filtered.length >= limit) break;
    filtered.push(m);
  }

  const hasMore = filtered.length === limit && all.some((m) => {
    if (filtered.length === 0) return false;
    const oldest = filtered[filtered.length - 1].timestamp;
    return m.timestamp < oldest;
  });

  return {
    messages: filtered.reverse(),
    hasMore,
  };
}

/** Wipe all cached messages for one conversation. */
export async function clearConv(
  walletAddress: string,
  convId: string,
): Promise<void> {
  const db = await openDb();
  if (!db) return;
  const store = tx(db, "readwrite");
  const idx = store.index("byConv");
  const range = IDBKeyRange.only([walletAddress.toLowerCase(), convId]);
  await new Promise<void>((resolve, reject) => {
    const cursorReq = idx.openCursor(range);
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      } else {
        resolve();
      }
    };
    cursorReq.onerror = () => reject(cursorReq.error ?? new Error("cursor failed"));
  });
}

// ---------------------------------------------------------------------------

async function collectByConv(
  db: IDBDatabase,
  walletAddress: string,
  convId: string,
): Promise<CachedMessage[]> {
  const store = tx(db, "readonly");
  const idx = store.index("byConv");
  const range = IDBKeyRange.only([walletAddress.toLowerCase(), convId]);
  return promiseRequest(idx.getAll(range)) as Promise<CachedMessage[]>;
}

async function pruneOldest(walletAddress: string, convId: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  const all = await collectByConv(db, walletAddress, convId);
  if (all.length <= MAX_PER_CONV) return;
  all.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const toDrop = all.slice(0, all.length - MAX_PER_CONV);

  const store = tx(db, "readwrite");
  for (const m of toDrop) store.delete(m.id);
  await txDone(store.transaction);
}

function txDone(t: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error ?? new Error("indexedDB tx failed"));
    t.onabort = () => reject(t.error ?? new Error("indexedDB tx aborted"));
  });
}
