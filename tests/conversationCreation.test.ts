import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ fetch: vi.fn(), getDoc: vi.fn(), updateDoc: vi.fn() }));
vi.mock("../app/lib/apiClient", () => ({ authedFetch: mocks.fetch }));
vi.mock("../app/lib/firebase", () => ({ firebaseDb: () => ({}) }));
vi.mock("firebase/firestore", () => ({
  collection: () => ({ withConverter: () => ({}) }), doc: () => ({ withConverter: () => ({}) }),
  getDoc: mocks.getDoc, updateDoc: mocks.updateDoc, deleteDoc: vi.fn(), query: vi.fn(), where: vi.fn(), serverTimestamp: () => "fixture-timestamp",
}));
import { createConversation, updateConversation } from "../app/lib/conversationsApi";
const wallet = `0x${"ab".repeat(20)}`;
const conv = { id: "server-created", kind: "dm" as const, title: "Fixture", participants: [`user:${wallet}`, "agent:Fixture"], historyHost: "agent:Fixture", pinned: false, archived: false };
beforeEach(() => vi.clearAllMocks());
describe("server-owned conversation creation", () => {
  it("sends only requested agents and presentation fields, not wallet/id authority", async () => {
    mocks.fetch.mockResolvedValue(new Response(JSON.stringify({ conversation: conv }), { status: 201 }));
    const result = await createConversation({ walletAddress: wallet, kind: "dm", participants: [`user:${wallet}`, "agent:Fixture"], title: "  Fixture  " });
    expect(result.id).toBe("server-created");
    expect(mocks.fetch.mock.calls[0][0]).toBe("/api/conversations");
    expect(JSON.parse(mocks.fetch.mock.calls[0][1].body)).toEqual({ kind: "dm", title: "Fixture", participants: ["agent:Fixture"] });
    expect(mocks.updateDoc).not.toHaveBeenCalled();
  });
  it("uses the existing project thread API without creating an alternate roster", async () => {
    mocks.fetch.mockResolvedValue(new Response(JSON.stringify({ convId: "server-created" }), { status: 201 }));
    mocks.getDoc.mockResolvedValue({ exists: () => true, data: () => ({ ...conv, kind: "channel", projectId: "fixture-project" }) });
    expect((await createConversation({ walletAddress: wallet, kind: "channel", participants: ["agent:Foreign"], projectId: "fixture-project" })).kind).toBe("channel");
    expect(mocks.fetch.mock.calls[0][0]).toBe("/api/projects/fixture-project/chat/new");
    expect(JSON.parse(mocks.fetch.mock.calls[0][1].body)).toEqual({});
  });
  it("does not create local metadata after a rejected API request", async () => {
    mocks.fetch.mockResolvedValue(new Response(JSON.stringify({ error: { message: "Not authorized" } }), { status: 403 }));
    await expect(createConversation({ walletAddress: wallet, kind: "dm", participants: ["agent:Foreign"] })).rejects.toThrow("Not authorized");
    expect(mocks.getDoc).not.toHaveBeenCalled(); expect(mocks.updateDoc).not.toHaveBeenCalled();
  });
  it("passes a project thread title to the server instead of patching authority metadata", async () => {
    mocks.fetch.mockResolvedValue(new Response(JSON.stringify({ convId: "server-created" }), { status: 201 }));
    mocks.getDoc.mockResolvedValue({ exists: () => true, data: () => ({ ...conv, kind: "channel", title: "Project discussion" }) });
    await createConversation({ walletAddress: wallet, kind: "channel", participants: [], projectId: "fixture-project", title: "  Project discussion  " });
    expect(JSON.parse(mocks.fetch.mock.calls[0][1].body)).toEqual({ title: "Project discussion" });
    expect(mocks.updateDoc).not.toHaveBeenCalled();
  });
  it("keeps client patches limited to presentation, even with extra runtime properties", async () => {
    await updateConversation({ walletAddress: wallet, convId: conv.id, title: " New title ", pinned: true, ...{ historyHost: "agent:Foreign" } });
    expect(mocks.updateDoc.mock.calls[0][1]).toEqual({ title: "New title", pinned: true, updatedAt: "fixture-timestamp" });
  });
});
