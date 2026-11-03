// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PATCH } from "../app/api/agent-appearance/[agentId]/route";

const mocks = vi.hoisted(() => ({
  verify: vi.fn(), collection: vi.fn(), doc: vi.fn(), get: vi.fn(), update: vi.fn(), transaction: vi.fn(),
}));
vi.mock("@/app/lib/firebaseAdmin", () => ({
  adminAuth: () => ({ verifyIdToken: mocks.verify }),
  adminDb: () => ({ collection: mocks.collection, runTransaction: mocks.transaction }),
}));

const owner = "0x0000000000000000000000000000000000000001";
const foreign = "0x0000000000000000000000000000000000000002";
const input = (body: unknown, token = "fixture-token", agentId = "fixture-agent") => PATCH(
  new Request("http://localhost/api/agent-appearance/fixture-agent", {
    method: "PATCH", headers: { Authorization: token ? `Bearer ${token}` : "" }, body: JSON.stringify(body),
  }),
  { params: Promise.resolve({ agentId }) },
);

beforeEach(() => {
  vi.resetAllMocks();
  mocks.verify.mockResolvedValue({ uid: owner });
  mocks.collection.mockReturnValue({ doc: mocks.doc });
  mocks.doc.mockReturnValue({ collection: mocks.collection });
  mocks.get.mockResolvedValue({ exists: true });
  mocks.transaction.mockImplementation((run) => run({ get: mocks.get, update: mocks.update }));
});

describe("agent appearance route", () => {
  it("writes only appearance, using the authenticated wallet even if the body supplies another", async () => {
    const result = await input({ appearance: 8, owner: foreign, runtime: "injected", status: "injected" });
    expect(result.status).toBe(200);
    expect(mocks.doc).toHaveBeenNthCalledWith(1, owner);
    expect(mocks.doc).toHaveBeenNthCalledWith(2, "fixture-agent");
    expect(mocks.update).toHaveBeenCalledWith(expect.anything(), { avatarAppearance: 8 });
  });

  it("allows reset without changing agent identity", async () => {
    expect((await input({ appearance: null })).status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith(expect.anything(), { avatarAppearance: null });
  });

  it("rejects missing and invalid authentication before touching Firestore", async () => {
    expect((await input({ appearance: 8 }, "")).status).toBe(401);
    mocks.verify.mockRejectedValueOnce(new Error("Invalid token"));
    expect((await input({ appearance: 8 })).status).toBe(401);
    expect(mocks.collection).not.toHaveBeenCalled();
  });

  it("never creates a missing agent or reaches another owner's records", async () => {
    mocks.get.mockResolvedValueOnce({ exists: false });
    expect((await input({ appearance: 8, owner: foreign })).status).toBe(404);
    expect(mocks.doc).not.toHaveBeenCalledWith(foreign);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it.each([{}, { appearance: 31 }, { appearance: "https://tracker.test/img" }, { appearance: "data:image/svg+xml;base64,AAAA" }])("rejects unapproved image input %j", async (body) => {
    expect((await input(body)).status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects oversized images and document path injection", async () => {
    expect((await input({ appearance: "A".repeat(25_000) })).status).toBe(413);
    expect((await input({ appearance: 1 }, "fixture-token", "nested/path")).status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
