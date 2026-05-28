/**
 * Integration tests for /api/agents/[agentId]/gateways/[type]/status.
 *
 * This endpoint is called by the bridge sidecar (PerkOS/A2A v0.11.0
 * gateway-health reporter), not by a logged-in wallet. It's
 * authenticated by Bearer <relayApiKey> + an x-agent-name header so
 * the route can look up the global /agents/<name> doc to verify the
 * key matches. The endpoint may ONLY flip status + statusMessage +
 * updatedAt for one named gateway; it cannot touch secrets, the
 * enabled flag, or the non-secret config.
 *
 * These tests exercise the full handler with mocked Firestore — no
 * real network, no real DB. The handler is the unit under test.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type DocState = Record<string, unknown>;
const docState: Record<string, DocState> = {};
const writes: Array<{ path: string; data: DocState; merge?: boolean }> = [];

function fakeDoc(path: string) {
  return {
    get: async () => ({
      exists: Boolean(docState[path]),
      data: () => docState[path],
    }),
    set: async (data: DocState, opts?: { merge?: boolean }) => {
      writes.push({ path, data, merge: opts?.merge });
      docState[path] = opts?.merge
        ? deepMerge(docState[path] ?? {}, data)
        : data;
    },
  };
}

function deepMerge(a: DocState, b: DocState): DocState {
  const out: DocState = { ...a };
  for (const [k, v] of Object.entries(b)) {
    if (v && typeof v === "object" && !Array.isArray(v) && typeof a[k] === "object") {
      out[k] = deepMerge(a[k] as DocState, v as DocState);
    } else {
      out[k] = v;
    }
  }
  return out;
}

const adminDbMock = {
  collection: (c1: string) => ({
    doc: (d1: string) => ({
      collection: (c2: string) => ({
        doc: (d2: string) => fakeDoc(`${c1}/${d1}/${c2}/${d2}`),
      }),
      // global /agents/<name> usage on the status route
      get: async () => ({
        exists: Boolean(docState[`${c1}/${d1}`]),
        data: () => docState[`${c1}/${d1}`],
      }),
    }),
  }),
};

vi.mock("../app/lib/firebaseAdmin", () => ({
  adminDb: () => adminDbMock,
  // The status route doesn't use adminAuth, but the import lives in
  // the same module — mock it anyway so the import chain resolves.
  adminAuth: () => ({ verifyIdToken: async () => ({ uid: "n/a" }) }),
}));

vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => "SERVER_TS" },
}));

import { POST as statusPOST } from "../app/api/agents/[agentId]/gateways/[type]/status/route";

const WALLET = "0xabcabcabcabcabcabcabcabcabcabcabcabcab00";
const AGENT_ID = "agent-doc-abc";
const AGENT_NAME = "MyBuilder";
const RELAY_KEY = "rk-1234567890";

function paramsP(agentId: string, type: string) {
  return Promise.resolve({ agentId, type });
}

function seedGlobal(over: Partial<DocState> = {}) {
  docState[`agents/${AGENT_NAME}`] = {
    name: AGENT_NAME,
    walletAddress: WALLET,
    agentId: AGENT_ID,
    relayApiKey: RELAY_KEY,
    ...over,
  };
}

function seedPerWallet(over: Partial<DocState> = {}) {
  docState[`wallets/${WALLET}/agents/${AGENT_ID}`] = {
    name: AGENT_NAME,
    walletAddress: WALLET,
    gateways: {
      telegram: {
        type: "telegram",
        enabled: true,
        nonSecretConfig: {},
        secretsProvided: ["botToken"],
        status: "pending",
        statusMessage: "Saved — will take effect on next restart.",
        createdAt: "2026-05-27T00:00:00.000Z",
        updatedAt: "2026-05-27T00:00:00.000Z",
      },
    },
    ...over,
  };
}

function reqWith(
  bearer: string | null,
  agentName: string | null,
  body: unknown,
): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (bearer) headers.authorization = `Bearer ${bearer}`;
  if (agentName) headers["x-agent-name"] = agentName;
  return new Request("https://test/status", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  writes.length = 0;
  for (const k of Object.keys(docState)) delete docState[k];
});

describe("POST /api/agents/[agentId]/gateways/[type]/status", () => {
  it("rejects unknown gateway type with 400", async () => {
    seedGlobal();
    const res = await statusPOST(reqWith(RELAY_KEY, AGENT_NAME, { status: "active" }), {
      params: paramsP(AGENT_ID, "bogus"),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).errorClass).toBe("BAD_INPUT");
  });

  it("401 without a bearer token", async () => {
    seedGlobal();
    const res = await statusPOST(reqWith(null, AGENT_NAME, { status: "active" }), {
      params: paramsP(AGENT_ID, "telegram"),
    });
    expect(res.status).toBe(401);
  });

  it("400 without x-agent-name", async () => {
    seedGlobal();
    const res = await statusPOST(reqWith(RELAY_KEY, null, { status: "active" }), {
      params: paramsP(AGENT_ID, "telegram"),
    });
    expect(res.status).toBe(400);
  });

  it("404 when the named agent doesn't exist", async () => {
    const res = await statusPOST(reqWith(RELAY_KEY, "Ghost", { status: "active" }), {
      params: paramsP(AGENT_ID, "telegram"),
    });
    expect(res.status).toBe(404);
  });

  it("401 when relayApiKey doesn't match the global doc", async () => {
    seedGlobal({ relayApiKey: "different-key" });
    const res = await statusPOST(reqWith(RELAY_KEY, AGENT_NAME, { status: "active" }), {
      params: paramsP(AGENT_ID, "telegram"),
    });
    expect(res.status).toBe(401);
  });

  it("403 when agentId in path doesn't match the named agent's id", async () => {
    seedGlobal({ agentId: "some-other-id" });
    const res = await statusPOST(reqWith(RELAY_KEY, AGENT_NAME, { status: "active" }), {
      params: paramsP(AGENT_ID, "telegram"),
    });
    expect(res.status).toBe(403);
  });

  it("400 on invalid status value", async () => {
    seedGlobal();
    seedPerWallet();
    const res = await statusPOST(reqWith(RELAY_KEY, AGENT_NAME, { status: "borked" }), {
      params: paramsP(AGENT_ID, "telegram"),
    });
    expect(res.status).toBe(400);
  });

  it("happy path: flips status from pending to active + writes only the status fields", async () => {
    seedGlobal();
    seedPerWallet();
    const res = await statusPOST(reqWith(RELAY_KEY, AGENT_NAME, { status: "active" }), {
      params: paramsP(AGENT_ID, "telegram"),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, type: "telegram", status: "active" });

    // Exactly one write — under the per-wallet agent doc, merge=true.
    expect(writes.length).toBe(1);
    expect(writes[0]!.path).toBe(`wallets/${WALLET}/agents/${AGENT_ID}`);
    expect(writes[0]!.merge).toBe(true);

    // The write must touch only status + statusMessage + updatedAt
    // inside gateways.telegram. Most importantly: enabled, secretsProvided,
    // nonSecretConfig, secretArns are NOT in the merge payload.
    const ttGateway = (writes[0]!.data as Record<string, Record<string, DocState>>)
      .gateways.telegram;
    expect(ttGateway.status).toBe("active");
    expect(ttGateway).not.toHaveProperty("enabled");
    expect(ttGateway).not.toHaveProperty("secretsProvided");
    expect(ttGateway).not.toHaveProperty("nonSecretConfig");
    expect(ttGateway).not.toHaveProperty("secretArns");
  });

  it("truncates a long status message at 500 chars + ellipsis", async () => {
    seedGlobal();
    seedPerWallet();
    const long = "x".repeat(800);
    await statusPOST(reqWith(RELAY_KEY, AGENT_NAME, { status: "error", message: long }), {
      params: paramsP(AGENT_ID, "telegram"),
    });
    const written = (writes[0]!.data as Record<string, Record<string, DocState>>)
      .gateways.telegram;
    expect(typeof written.statusMessage).toBe("string");
    expect((written.statusMessage as string).length).toBe(500);
    expect((written.statusMessage as string).endsWith("...")).toBe(true);
  });
});
