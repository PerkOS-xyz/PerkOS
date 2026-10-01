import { expect, it, vi } from "vitest";
const { db } = vi.hoisted(() => ({ db: vi.fn(() => { throw new Error("No database access expected"); }) }));
vi.mock("../app/lib/firebaseAdmin", () => ({ adminDb: db }));
import { resolveAndPersistAvatar } from "../app/lib/resolveAvatar";
import { resolveOnchainAvatars } from "../app/lib/avatarResolveCore";

it("does not resolve ENS or write a lowercased Solana profile", async () => {
  const fetchMock = vi.fn(() => { throw new Error("No RPC expected"); });
  vi.stubGlobal("fetch", fetchMock);
  try {
    for (const wallet of ["So11111111111111111111111111111111111111112", "so11111111111111111111111111111111111111112"]) {
      expect(await resolveAndPersistAvatar(wallet, { force: true })).toBeNull();
      expect(await resolveOnchainAvatars(wallet)).toEqual({ ensName: null, ensAvatarUrl: null, basename: null, basenameAvatarUrl: null });
    }
    expect(db).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  } finally { vi.unstubAllGlobals(); }
});
