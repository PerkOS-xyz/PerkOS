/**
 * Messaging gateways for a single agent.
 *
 *   GET  /api/agents/[agentId]/gateways
 *     Returns the sanitized gateway records on the agent's Firestore
 *     doc. Never returns secret VALUES — only `secretsProvided` keys
 *     so the wizard can render "Token: configured".
 *
 *   POST /api/agents/[agentId]/gateways
 *     Upsert a single gateway. Body: GatewayUpsertInput. Stashes any
 *     supplied secrets in AWS Secrets Manager (prefix matches the
 *     existing perkos-agents/* convention) and updates
 *     `agents/{agentId}.gateways.<type>` on the wallet's agent doc.
 *     Status starts as "pending" — the runtime flips it to "active"
 *     on first successful platform connect (separate health-report
 *     PR).
 *
 * Auth: Firebase ID token; caller must own the agent. The wallet is
 * derived from the Firebase uid — never accepted from the body.
 *
 * This route does NOT trigger a redeploy. The follow-up
 * ecsProvision change (next PR in the series) reads the persisted
 * gateways during the next provision/wake cycle. Operators can
 * trigger that via the existing `/api/agents/[agentId]/upgrade`
 * endpoint, which already preserves state.
 */
import {
  CreateSecretCommand,
  DescribeSecretCommand,
  PutSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import {
  GATEWAY_CATALOG,
  type AgentGatewayRecord,
  type GatewayType,
  type GatewayUpsertInput,
  gatewaySecretName,
  validateGatewayUpsert,
} from "../../../../lib/agentGateways";
import { adminAuth, adminDb } from "../../../../lib/firebaseAdmin";

const AWS_REGION = process.env.AWS_REGION || "us-east-1";

let _sm: SecretsManagerClient | null = null;
function sm(): SecretsManagerClient {
  if (!_sm) _sm = new SecretsManagerClient({ region: AWS_REGION });
  return _sm;
}

async function requireAuth(request: Request): Promise<string> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new Error("Missing Authorization bearer token.");
  const decoded = await adminAuth().verifyIdToken(token);
  return decoded.uid.toLowerCase();
}

/**
 * Idempotent secret stash for a single gateway secret.
 *
 * Mirrors the shape of ecsProvision.ensureAgentSecret but kept here
 * because that helper's `kind` union is closed to the LLM secret
 * kinds. Sharing one implementation later (post-MVP) is fine; the
 * runtime contract is what matters.
 */
async function stashSecret(name: string, value: string, description: string): Promise<string> {
  try {
    const existing = await sm().send(new DescribeSecretCommand({ SecretId: name }));
    await sm().send(new PutSecretValueCommand({ SecretId: name, SecretString: value }));
    if (!existing.ARN) throw new Error("Secrets Manager returned no ARN.");
    return existing.ARN;
  } catch (err) {
    const code = (err as { name?: string }).name;
    if (code !== "ResourceNotFoundException") throw err;
    const created = await sm().send(
      new CreateSecretCommand({ Name: name, SecretString: value, Description: description }),
    );
    if (!created.ARN) throw new Error("Secrets Manager create returned no ARN.");
    return created.ARN;
  }
}

type AgentDoc = {
  name?: string;
  walletAddress?: string;
  gateways?: Record<string, AgentGatewayRecord>;
};

/**
 * Sanitize a raw record from Firestore for the wire. Today this is
 * the identity function (we never write secrets onto the doc) — the
 * function exists so an accidental future write of a sensitive field
 * still gets stripped before it leaves the server.
 */
function publicGateway(record: AgentGatewayRecord): AgentGatewayRecord {
  // Note: secretArns is internal infra plumbing; the GET surface
  // doesn't need it. The wizard only needs to know WHICH secrets are
  // stored (via secretsProvided). The ARNs stay server-side so
  // misuse (e.g. crafting fake bearer headers with ARN values) has
  // zero attack surface.
  return {
    type: record.type,
    enabled: record.enabled,
    nonSecretConfig: { ...record.nonSecretConfig },
    secretsProvided: [...record.secretsProvided],
    status: record.status,
    statusMessage: record.statusMessage,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

async function readAgent(caller: string, agentId: string) {
  const ref = adminDb()
    .collection("wallets")
    .doc(caller)
    .collection("agents")
    .doc(agentId);
  const snap = await ref.get();
  if (!snap.exists) return { ref, doc: null as AgentDoc | null };
  return { ref, doc: snap.data() as AgentDoc };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> },
) {
  let caller: string;
  try {
    caller = await requireAuth(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { agentId } = await params;
  const { doc } = await readAgent(caller, agentId);
  if (!doc) {
    return NextResponse.json({ error: "Agent not found", errorClass: "NOT_FOUND" }, { status: 404 });
  }
  if (doc.walletAddress && doc.walletAddress.toLowerCase() !== caller) {
    return NextResponse.json({ error: "You don't own this agent.", errorClass: "FORBIDDEN" }, { status: 403 });
  }

  const records = doc.gateways ?? {};
  const gateways = Object.values(records).map(publicGateway);
  // Also surface the catalog so the wizard / admin UIs render a
  // consistent set of "configurable" gateways regardless of which
  // ones the agent has enabled.
  const catalog = Object.values(GATEWAY_CATALOG).map((spec) => ({
    type: spec.type,
    label: spec.label,
    secretKeys: Object.keys(spec.secrets),
    configKeys: Object.entries(spec.nonSecretConfig).map(([key, meta]) => ({
      key,
      required: meta.required,
    })),
  }));
  return NextResponse.json({ ok: true, gateways, catalog });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> },
) {
  let caller: string;
  try {
    caller = await requireAuth(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { agentId } = await params;
  let body: GatewayUpsertInput;
  try {
    body = (await request.json()) as GatewayUpsertInput;
  } catch {
    return NextResponse.json(
      { error: "Body must be JSON", errorClass: "BAD_INPUT" },
      { status: 400 },
    );
  }

  const validation = validateGatewayUpsert(body);
  if (!validation.ok) {
    return NextResponse.json(
      { error: "Validation failed", errorClass: "BAD_INPUT", fieldErrors: validation.errors },
      { status: 400 },
    );
  }
  const { clean } = validation;

  const { ref, doc } = await readAgent(caller, agentId);
  if (!doc) {
    return NextResponse.json({ error: "Agent not found", errorClass: "NOT_FOUND" }, { status: 404 });
  }
  if (doc.walletAddress && doc.walletAddress.toLowerCase() !== caller) {
    return NextResponse.json({ error: "You don't own this agent.", errorClass: "FORBIDDEN" }, { status: 403 });
  }
  if (!doc.name) {
    return NextResponse.json(
      { error: "Agent doc missing `name`", errorClass: "BAD_INPUT" },
      { status: 500 },
    );
  }

  // Stash every supplied secret in Secrets Manager. We do this BEFORE
  // touching Firestore so a half-failure leaves Firestore unchanged
  // and the operator can simply retry — no orphaned doc state
  // referencing a non-existent secret.
  const supplied = Object.entries(clean.secrets ?? {});
  const freshArns: Record<string, string> = {};
  for (const [formKey, value] of supplied) {
    const name = gatewaySecretName(caller, doc.name, clean.type as GatewayType, formKey);
    freshArns[formKey] = await stashSecret(
      name,
      value,
      `Gateway secret for ${doc.name}/${clean.type}/${formKey}`,
    );
  }

  // Merge with whatever was previously persisted: enabling without
  // supplying secrets keeps the old `secretsProvided` set + ARNs;
  // disabling wipes nothing (operator can re-enable without
  // re-entering). New secrets supplied this turn overwrite the
  // matching ARN entries.
  const existing = doc.gateways?.[clean.type as GatewayType];
  const now = new Date().toISOString();
  const mergedProvided = new Set<string>(existing?.secretsProvided ?? []);
  for (const [formKey] of supplied) mergedProvided.add(formKey);
  const mergedArns: Record<string, string> = { ...(existing?.secretArns ?? {}), ...freshArns };

  const record: AgentGatewayRecord = {
    type: clean.type,
    enabled: clean.enabled,
    nonSecretConfig: clean.nonSecretConfig ?? {},
    secretsProvided: Array.from(mergedProvided),
    secretArns: mergedArns,
    status: "pending",
    statusMessage: clean.enabled
      ? "Saved — will take effect on next agent restart/wake."
      : "Disabled — secrets retained for re-enable.",
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  await ref.set(
    {
      gateways: { [clean.type]: record },
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return NextResponse.json({ ok: true, gateway: publicGateway(record) });
}
