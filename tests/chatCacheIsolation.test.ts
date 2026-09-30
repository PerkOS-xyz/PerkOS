// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { clearConv, getMessages, putMessages, type CachedMessage } from "../app/lib/chatCache";

const A = "So11111111111111111111111111111111111111112";
const B = "so11111111111111111111111111111111111111112";
const EVM = "0xABCDEFabcdef1234567890123456789012345678";
const DB = "perkos-chat-cache";
const message = (id = "shared-id", text = "private text", timestamp = "2026-01-01T00:00:00.000Z") => ({
  id, text, timestamp, from: "agent:fixture",
});
beforeEach(() => {
  vi.stubGlobal("indexedDB", new IDBFactory());
  vi.stubGlobal("IDBKeyRange", IDBKeyRange);
});
afterEach(() => { vi.unstubAllGlobals(); });

function request<T>(req: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function seedLegacy(records: CachedMessage[]) {
  const req = indexedDB.open(DB, 1);
  req.onupgradeneeded = () => {
    const store = req.result.createObjectStore("messages", { keyPath: "id" });
    store.createIndex("byConv", ["walletAddress", "convId"], { unique: false });
    records.forEach(record => store.put(record));
  };
  return request(req);
}
function cached(walletAddress: string, id: string): CachedMessage {
  return { ...message(id), walletAddress, convId: "shared-conv", replyTo: null, cachedAt: "2026-01-01T00:00:00.000Z" };
}

describe("scoped IndexedDB chat cache", () => {
  it("keeps the same message id independent across case-sensitive wallets and conversations", async () => {
    await putMessages(A, "shared-conv", [message("shared-id", "A only")]);
    await putMessages(B, "shared-conv", [message("shared-id", "B only")]);
    await putMessages(A, "other-conv", [message("shared-id", "other conversation")]);
    expect((await getMessages(A, "shared-conv")).messages.map(m => m.text)).toEqual(["A only"]);
    expect((await getMessages(B, "shared-conv")).messages.map(m => m.text)).toEqual(["B only"]);
    expect((await getMessages(A, "other-conv")).messages.map(m => m.text)).toEqual(["other conversation"]);
  });

  it("upserts optimistic messages only within the exact scope", async () => {
    await putMessages(A, "conv", [message("id", "optimistic")]);
    await putMessages(B, "conv", [message("id", "untouched")]);
    await putMessages(A, "conv", [message("id", "confirmed")]);
    expect((await getMessages(A, "conv")).messages.map(m => m.text)).toEqual(["confirmed"]);
    expect((await getMessages(B, "conv")).messages.map(m => m.text)).toEqual(["untouched"]);
  });

  it("continues to canonicalize EVM identities", async () => {
    await putMessages(EVM, "conv", [message()]);
    expect((await getMessages(EVM.toLowerCase(), "conv")).messages).toHaveLength(1);
    await clearConv(EVM.toLowerCase(), "conv");
    expect((await getMessages(EVM, "conv")).messages).toEqual([]);
  });

  it("clears only the requested wallet and conversation and waits for commit", async () => {
    await putMessages(A, "conv", [message()]);
    await putMessages(B, "conv", [message()]);
    await putMessages(A, "other", [message()]);
    await clearConv(A, "conv");
    expect((await getMessages(A, "conv")).messages).toEqual([]);
    expect((await getMessages(B, "conv")).messages).toHaveLength(1);
    expect((await getMessages(A, "other")).messages).toHaveLength(1);
  });

  it("prunes only the overflowing conversation, even with colliding ids", async () => {
    const records = Array.from({ length: 1002 }, (_, i) => message(`id-${i}`, `text-${i}`, new Date(i * 1000).toISOString()));
    await putMessages(B, "conv", [records[0]]);
    await putMessages(A, "other", [records[0]]);
    await putMessages(A, "conv", records);
    expect((await getMessages(A, "conv", { before: records[2].timestamp })).messages).toEqual([]);
    expect((await getMessages(B, "conv")).messages[0].id).toBe("id-0");
    expect((await getMessages(A, "other")).messages[0].id).toBe("id-0");
    const latest = await getMessages(A, "conv", { limit: 500 });
    const older = await getMessages(A, "conv", { limit: 500, before: latest.messages[0].timestamp });
    expect(latest.hasMore).toBe(true);
    expect(older.hasMore).toBe(false);
    expect(latest.messages.length + older.messages.length).toBe(1000);
  });

  it("migrates existing records atomically and preserves their wallet ownership", async () => {
    const legacy = await seedLegacy([cached(A, "A-id"), cached(B, "B-id"), cached(EVM, "EVM-id")]);
    legacy.close();
    expect((await getMessages(A, "shared-conv")).messages).toEqual([cached(A, "A-id")]);
    expect((await getMessages(B, "shared-conv")).messages).toEqual([cached(B, "B-id")]);
    expect((await getMessages(EVM.toLowerCase(), "shared-conv")).messages[0].walletAddress).toBe(EVM.toLowerCase());
    const db = await request(indexedDB.open(DB, 2));
    expect(Array.from(db.objectStoreNames)).toEqual(["messages"]);
    expect(db.transaction("messages").objectStore("messages").keyPath).toEqual(["walletAddress", "convId", "id"]);
    db.close();
  });

  it("retains messages after reloading the cache module", async () => {
    await putMessages(A, "conv", [message("shared-id", "A")]);
    await putMessages(B, "conv", [message("shared-id", "B")]);
    vi.resetModules();
    const reloaded = await import("../app/lib/chatCache");
    expect((await reloaded.getMessages(A, "conv")).messages[0].text).toBe("A");
    expect((await reloaded.getMessages(B, "conv")).messages[0].text).toBe("B");
  });

  it("rolls back the entire upgrade rather than discarding a malformed legacy record", async () => {
    const malformed = { ...cached(A, "bad-id"), convId: undefined } as unknown as CachedMessage;
    const legacy = await seedLegacy([cached(A, "good-id"), malformed]);
    legacy.close();
    await expect(getMessages(A, "shared-conv")).rejects.toHaveProperty("name", "AbortError");
    const db = await request(indexedDB.open(DB, 1));
    expect(db.version).toBe(1);
    const store = db.transaction("messages").objectStore("messages");
    expect(store.keyPath).toBe("id");
    expect(await request(store.count())).toBe(2);
    db.close();
  });

  it("reports an old tab blocking migration and recovers after it closes", async () => {
    const legacy = await seedLegacy([cached(A, "id")]);
    await expect(getMessages(A, "shared-conv")).rejects.toThrow("Close older PerkOS tabs");
    legacy.close();
    expect((await getMessages(A, "shared-conv")).messages).toHaveLength(1);
  });

  it("closes connections so a subsequent version upgrade is not blocked", async () => {
    await putMessages(A, "conv", [message()]);
    await getMessages(A, "conv");
    await clearConv(A, "conv");
    const req = indexedDB.open(DB, 3);
    const blocked = vi.fn();
    req.onblocked = blocked;
    const db = await request(req);
    expect(blocked).not.toHaveBeenCalled();
    db.close();
  });

  it("gracefully handles browsers without IndexedDB", async () => {
    vi.stubGlobal("indexedDB", undefined);
    await putMessages(A, "conv", [message()]);
    await clearConv(A, "conv");
    expect(await getMessages(A, "conv")).toEqual({ messages: [], hasMore: false });
  });
});
