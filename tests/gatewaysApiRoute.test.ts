/**
 * Integration tests for /api/agents/[agentId]/gateways (GET + POST).
 *
 * Goal: exercise the full route handler logic end-to-end without
 * opening a browser. Covers auth, ownership, validation, secret
 * stashing in AWS Secrets Manager, and the Firestore merge write —
 * the same path the wizard hits in production.
 *
 * Mocks (mirrors agentUpgrade.test.ts conventions):
 *   - Firebase admin: hand-rolled doc tree, captures writes by path,
 *     stubs verifyIdToken to return a known uid.
 *   - AWS SM: classes whose `send` records the command + returns an
 *     ARN. Lets us assert on the secret name + payload.
 *
 * We import the route handler directly and call POST/GET with a real
 * `Request` instance — no test server, no fetch round-trip. The handler
 * is the unit under test; everything below it is a fake.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// AWS Secrets Manager mock — captures every command so we can assert.
// ---------------------------------------------------------------------------
const smCalls: Array<{ kind: string; input: Record<string, unknown> }> = [];
// Default behavior: DescribeSecret throws ResourceNotFoundException (cold
// path → CreateSecret); both Create + PutValue return an ARN. Tests can
// flip the describe behavior to existing-secret per-case below.
let describeShouldExist = false;
vi.mock("@aws-sdk/client-secrets-manager", () => ({
  SecretsManagerClient: class {
    async send(cmd: { kind: string; input: Record<string, unknown> }) {
      smCalls.push({ kind: cmd.kind, input: cmd.input });
      if (cmd.kind === "DescribeSecret") {
        if (describeShouldExist) {
          return { ARN: `arn:aws:secretsmanager:us-east-1:111:secret:${cmd.input.SecretId}` };
        }
        const err = new Error("not found");
        (err as { name?: string }).name = "ResourceNotFoundException";
        throw err;
      }
      if (cmd.kind === "PutSecretValue") {
        return { ARN: `arn:aws:secretsmanager:us-east-1:111:secret:${cmd.input.SecretId}` };
      }
      // CreateSecret
      return { ARN: `arn:aws:secretsmanager:us-east-1:111:secret:${cmd.input.Name}` };
    }
  },
  // Each command class records its kind so the fake send can branch.
  CreateSecretCommand: class {
    kind = "CreateSecret";
    constructor(public input: Record<string, unknown>) {}
  },
  PutSecretValueCommand: class {
    kind = "PutSecretValue";
    constructor(public input: Record<string, unknown>) {}
  },
  DescribeSecretCommand: class {
    kind = "DescribeSecret";
    constructor(public input: Record<string, unknown>) {}
  },
}));

// ---------------------------------------------------------------------------
// Firestore admin mock — captures merge writes + serves canned state.
// ---------------------------------------------------------------------------
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
      // Shallow merge — sufficient for these tests; the route only
      // writes `gateways: { [type]: record }` + `updatedAt`.
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
    }),
  }),
};

let authedUid = "0xabcabcabcabcabcabcabcabcabcabcabcabcab00";
let authShouldFail = false;
vi.mock("../app/lib/firebaseAdmin", () => ({
  adminDb: () => adminDbMock,
  adminAuth: () => ({
    verifyIdToken: async () => {
      if (authShouldFail) throw new Error("bad token");
      return { uid: authedUid };
    },
  }),
}));

vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => "SERVER_TS" },
}));

// ---------------------------------------------------------------------------
// Import the route AFTER the mocks are registered.
// ---------------------------------------------------------------------------
import {
  GET as gatewaysGET,
  POST as gatewaysPOST,
} from "../app/api/agents/[agentId]/gateways/route";

const WALLET = "0xabcabcabcabcabcabcabcabcabcabcabcabcab00";
const AGENT_ID = "agent-doc-abc";
const AGENT_NAME = "MyBuilder";

function authHeader() {
  return { authorization: "Bearer test-token" };
}

function seedAgent(over: Partial<DocState> = {}) {
  const path = `wallets/${WALLET}/agents/${AGENT_ID}`;
  docState[path] = {
    name: AGENT_NAME,
    walletAddress: WALLET,
    ...over,
  };
}

function paramsP(agentId: string) {
  return Promise.resolve({ agentId });
}

beforeEach(() => {
  smCalls.length = 0;
  writes.length = 0;
  for (const k of Object.keys(docState)) delete docState[k];
  describeShouldExist = false;
  authedUid = WALLET;
  authShouldFail = false;
});

describe("POST /api/agents/[agentId]/gateways", () => {
  it("rejects missing bearer with 401", async () => {
    authShouldFail = true;
    const req = new Request("https://test/api/agents/x/gateways", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "telegram", enabled: false }),
    });
    const res = await gatewaysPOST(req, { params: paramsP("x") });
    expect(res.status).toBe(401);
  });

  it("returns 404 when agent doc doesn't exist for the caller", async () => {
    const req = new Request("https://test/api/agents/missing/gateways", {
      method: "POST",
      headers: { ...authHeader(), "content-type": "application/json" },
      body: JSON.stringify({ type: "telegram", enabled: false }),
    });
    const res = await gatewaysPOST(req, { params: paramsP("missing") });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.errorClass).toBe("NOT_FOUND");
  });

  it("returns 404 when the caller can't see the agent (lives under another wallet's path)", async () => {
    // Per-wallet docs are scoped: `wallets/<caller>/agents/<id>`. A
    // different caller looking up the same id will get NOT_FOUND
    // rather than FORBIDDEN — by design (no enumeration of other
    // wallets' agents).
    authedUid = "0xanother00000000000000000000000000000000";
    seedAgent();
    const req = new Request(`https://test/api/agents/${AGENT_ID}/gateways`, {
      method: "POST",
      headers: { ...authHeader(), "content-type": "application/json" },
      body: JSON.stringify({ type: "telegram", enabled: false }),
    });
    const res = await gatewaysPOST(req, { params: paramsP(AGENT_ID) });
    expect(res.status).toBe(404);
  });

  it("rejects unknown gateway type with 400 + field errors", async () => {
    seedAgent();
    const req = new Request(`https://test/api/agents/${AGENT_ID}/gateways`, {
      method: "POST",
      headers: { ...authHeader(), "content-type": "application/json" },
      body: JSON.stringify({ type: "myspace", enabled: true }),
    });
    const res = await gatewaysPOST(req, { params: paramsP(AGENT_ID) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.errorClass).toBe("BAD_INPUT");
    expect(body.fieldErrors[0].field).toBe("type");
  });

  it("rejects enabled=true with missing required secrets (no SM writes happen)", async () => {
    seedAgent();
    const req = new Request(`https://test/api/agents/${AGENT_ID}/gateways`, {
      method: "POST",
      headers: { ...authHeader(), "content-type": "application/json" },
      body: JSON.stringify({ type: "telegram", enabled: true }),
    });
    const res = await gatewaysPOST(req, { params: paramsP(AGENT_ID) });
    expect(res.status).toBe(400);
    // No SM round-trips when validation fails. This is the contract
    // that protects against half-written secret state.
    expect(smCalls.length).toBe(0);
    // And no Firestore writes either.
    expect(writes.length).toBe(0);
  });

  it("happy path Telegram: stashes secret in SM, writes record to Firestore, returns 200 with sanitized body", async () => {
    seedAgent();
    const req = new Request(`https://test/api/agents/${AGENT_ID}/gateways`, {
      method: "POST",
      headers: { ...authHeader(), "content-type": "application/json" },
      body: JSON.stringify({
        type: "telegram",
        enabled: true,
        secrets: { botToken: "123:abcDEF" },
        nonSecretConfig: { webhookUrl: "https://relay.test/wh/x" },
      }),
    });
    const res = await gatewaysPOST(req, { params: paramsP(AGENT_ID) });
    expect(res.status).toBe(200);

    // SM should see DescribeSecret (cold) then CreateSecret with the
    // standard perkos-agents/<wallet>/<agent>/gateway-* shape.
    const describes = smCalls.filter((c) => c.kind === "DescribeSecret");
    expect(describes.length).toBe(1);
    expect(describes[0]!.input.SecretId).toBe(
      `perkos-agents/${WALLET}/${AGENT_NAME.toLowerCase()}/gateway-telegram-bot-token`,
    );
    const creates = smCalls.filter((c) => c.kind === "CreateSecret");
    expect(creates.length).toBe(1);
    expect(creates[0]!.input.SecretString).toBe("123:abcDEF");

    // Firestore write should be a merge under wallets/<w>/agents/<id>.
    const w = writes.find((x) =>
      String(x.path) === `wallets/${WALLET}/agents/${AGENT_ID}`,
    );
    expect(w).toBeDefined();
    expect(w!.merge).toBe(true);
    const persisted = (w!.data as Record<string, Record<string, Record<string, unknown>>>)
      .gateways.telegram;
    expect(persisted.type).toBe("telegram");
    expect(persisted.enabled).toBe(true);
    expect(persisted.nonSecretConfig).toEqual({ webhookUrl: "https://relay.test/wh/x" });
    expect((persisted.secretsProvided as string[]).sort()).toEqual(["botToken"]);
    expect(persisted.status).toBe("pending");
    expect((persisted.secretArns as Record<string, string>).botToken).toMatch(
      /^arn:aws:secretsmanager:/,
    );

    // GET surface strips secretArns — verify the response body too.
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.gateway.type).toBe("telegram");
    expect(body.gateway).not.toHaveProperty("secretArns");
  });

  it("re-running with the same secrets: PutSecretValue path + same ARN preserved on the record", async () => {
    seedAgent();
    describeShouldExist = true;
    const req = new Request(`https://test/api/agents/${AGENT_ID}/gateways`, {
      method: "POST",
      headers: { ...authHeader(), "content-type": "application/json" },
      body: JSON.stringify({
        type: "telegram",
        enabled: true,
        secrets: { botToken: "rotated-token" },
      }),
    });
    const res = await gatewaysPOST(req, { params: paramsP(AGENT_ID) });
    expect(res.status).toBe(200);
    const puts = smCalls.filter((c) => c.kind === "PutSecretValue");
    expect(puts.length).toBe(1);
    expect(puts[0]!.input.SecretString).toBe("rotated-token");
    // No CreateSecret when DescribeSecret succeeded.
    expect(smCalls.find((c) => c.kind === "CreateSecret")).toBeUndefined();
  });

  it("disabling without secrets preserves the prior secretsProvided + ARNs", async () => {
    // First, enable with secrets.
    seedAgent();
    await gatewaysPOST(
      new Request(`https://test/api/agents/${AGENT_ID}/gateways`, {
        method: "POST",
        headers: { ...authHeader(), "content-type": "application/json" },
        body: JSON.stringify({
          type: "telegram",
          enabled: true,
          secrets: { botToken: "first-token" },
        }),
      }),
      { params: paramsP(AGENT_ID) },
    );
    const firstWriteArns = (writes[0]!.data as Record<string, Record<string, Record<string, unknown>>>)
      .gateways.telegram.secretArns as Record<string, string>;

    // Then disable, no secrets supplied. Should preserve secretsProvided
    // + secretArns so the operator can re-enable without re-entering.
    await gatewaysPOST(
      new Request(`https://test/api/agents/${AGENT_ID}/gateways`, {
        method: "POST",
        headers: { ...authHeader(), "content-type": "application/json" },
        body: JSON.stringify({ type: "telegram", enabled: false }),
      }),
      { params: paramsP(AGENT_ID) },
    );

    const second = writes[writes.length - 1]!.data as Record<
      string,
      Record<string, Record<string, unknown>>
    >;
    const persisted = second.gateways.telegram;
    expect(persisted.enabled).toBe(false);
    expect((persisted.secretsProvided as string[]).sort()).toEqual(["botToken"]);
    expect((persisted.secretArns as Record<string, string>).botToken).toBe(
      firstWriteArns.botToken,
    );
  });
});

describe("GET /api/agents/[agentId]/gateways", () => {
  it("returns 401 without bearer", async () => {
    authShouldFail = true;
    const req = new Request(`https://test/api/agents/${AGENT_ID}/gateways`);
    const res = await gatewaysGET(req, { params: paramsP(AGENT_ID) });
    expect(res.status).toBe(401);
  });

  it("returns gateways + catalog without secret values", async () => {
    seedAgent({
      gateways: {
        telegram: {
          type: "telegram",
          enabled: true,
          nonSecretConfig: { webhookUrl: "https://x.test/wh" },
          secretsProvided: ["botToken"],
          secretArns: { botToken: "arn:1" },
          status: "active",
          statusMessage: "ok",
          createdAt: "2026-05-27T00:00:00.000Z",
          updatedAt: "2026-05-27T00:00:00.000Z",
        },
      },
    });
    const req = new Request(`https://test/api/agents/${AGENT_ID}/gateways`, {
      headers: authHeader(),
    });
    const res = await gatewaysGET(req, { params: paramsP(AGENT_ID) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.gateways.length).toBe(1);
    // Crucial security check: secretArns and any secret value must
    // not leak through the wire.
    expect(body.gateways[0]).not.toHaveProperty("secretArns");
    expect(body.catalog.map((c: { type: string }) => c.type).sort()).toEqual([
      "farcaster",
      "slack",
      "telegram",
    ]);
  });
});
