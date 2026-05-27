/**
 * Unit tests for the messaging-gateways data layer.
 *
 * Scope: only the pure module (catalog, validation, env materialization,
 * secret-name composition). The HTTP route + AWS + Firestore writes
 * are integration-tested separately.
 */
import { describe, expect, it } from "vitest";

import {
  GATEWAY_CATALOG,
  type AgentGatewayRecord,
  gatewayRuntimeEnv,
  gatewaySecretName,
  validateGatewayUpsert,
} from "../app/lib/agentGateways";

describe("GATEWAY_CATALOG", () => {
  it("declares both MVP gateways with required env contracts", () => {
    expect(Object.keys(GATEWAY_CATALOG).sort()).toEqual(["farcaster", "telegram"]);
    expect(GATEWAY_CATALOG.telegram.secrets.botToken.envVar).toBe("TELEGRAM_BOT_TOKEN");
    expect(GATEWAY_CATALOG.farcaster.secrets.neynarApiKey.envVar).toBe("FARCASTER_NEYNAR_API_KEY");
    expect(GATEWAY_CATALOG.farcaster.nonSecretConfig.fid.required).toBe(true);
  });

  it("uses the perkos-agents/* prefix convention in secret kinds", () => {
    // Every secretKind must be namespaced so the existing IAM policy
    // (GetSecretValue on perkos-agents/*) covers it without changes.
    for (const spec of Object.values(GATEWAY_CATALOG)) {
      for (const meta of Object.values(spec.secrets)) {
        expect(meta.secretKind).toMatch(/^gateway-[a-z-]+$/);
      }
    }
  });
});

describe("validateGatewayUpsert", () => {
  it("accepts a fully-formed Telegram enable", () => {
    const result = validateGatewayUpsert({
      type: "telegram",
      enabled: true,
      secrets: { botToken: "123:abcDEF" },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.clean.secrets?.botToken).toBe("123:abcDEF");
    }
  });

  it("requires every secret + required non-secret when enabling", () => {
    const result = validateGatewayUpsert({
      type: "farcaster",
      enabled: true,
      secrets: { neynarApiKey: "key" }, // missing signerUuid + webhookSecret
      // missing fid
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const fields = result.errors.map((e) => e.field).sort();
      expect(fields).toContain("secrets.signerUuid");
      expect(fields).toContain("secrets.webhookSecret");
      expect(fields).toContain("nonSecretConfig.fid");
    }
  });

  it("allows disabling without supplying secrets", () => {
    const result = validateGatewayUpsert({
      type: "telegram",
      enabled: false,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects unknown gateway type", () => {
    const result = validateGatewayUpsert({
      type: "myspace" as never,
      enabled: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]!.field).toBe("type");
    }
  });

  it("strips keys that aren't in the catalog (defense in depth)", () => {
    const result = validateGatewayUpsert({
      type: "telegram",
      enabled: true,
      secrets: { botToken: "ok", evilExtraSecret: "drop me" } as Record<string, string>,
      nonSecretConfig: { webhookUrl: "https://x.test/y", junk: "drop me" } as Record<string, string>,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.keys(result.clean.secrets ?? {})).toEqual(["botToken"]);
      expect(Object.keys(result.clean.nonSecretConfig ?? {})).toEqual(["webhookUrl"]);
    }
  });

  it("treats whitespace-only values as missing", () => {
    const result = validateGatewayUpsert({
      type: "telegram",
      enabled: true,
      secrets: { botToken: "   " },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]!.field).toBe("secrets.botToken");
    }
  });
});

describe("gatewayRuntimeEnv", () => {
  const baseRecord: AgentGatewayRecord = {
    type: "farcaster",
    enabled: true,
    nonSecretConfig: { fid: "12345", replyVisibility: "mentions" },
    secretsProvided: ["neynarApiKey", "signerUuid"],
    status: "pending",
    createdAt: "2026-05-27T00:00:00.000Z",
    updatedAt: "2026-05-27T00:00:00.000Z",
  };

  it("emits the enabled flag + non-secret env + secret refs in matched order", () => {
    const { env, secrets } = gatewayRuntimeEnv(baseRecord, {
      neynarApiKey: "arn:aws:secretsmanager:us-east-1:123:secret:neynar-key",
      signerUuid: "arn:aws:secretsmanager:us-east-1:123:secret:signer",
      webhookSecret: "arn:aws:secretsmanager:us-east-1:123:secret:hmac",
    });
    const envNames = env.map((e) => e.name).sort();
    expect(envNames).toEqual(["FARCASTER_ENABLED", "FARCASTER_FID", "FARCASTER_REPLY_VISIBILITY"]);
    const secretNames = secrets.map((s) => s.name).sort();
    expect(secretNames).toEqual([
      "FARCASTER_NEYNAR_API_KEY",
      "FARCASTER_SIGNER_UUID",
      "FARCASTER_WEBHOOK_SECRET",
    ]);
  });

  it("omits the enabled flag when record is disabled", () => {
    const { env } = gatewayRuntimeEnv({ ...baseRecord, enabled: false }, {});
    expect(env.find((e) => e.name === "FARCASTER_ENABLED")).toBeUndefined();
  });

  it("silently skips secret refs we don't have ARNs for", () => {
    // Real production case: user enabled the gateway with only the
    // required secrets; an optional secret like webhookSecret may not
    // be set. The materializer must not invent an ARN.
    const { secrets } = gatewayRuntimeEnv(baseRecord, {
      neynarApiKey: "arn:1",
    });
    expect(secrets.map((s) => s.name)).toEqual(["FARCASTER_NEYNAR_API_KEY"]);
  });

  it("returns empty arrays for unknown gateway types (defensive)", () => {
    const garbage = { ...baseRecord, type: "unknown" as never };
    const out = gatewayRuntimeEnv(garbage, {});
    expect(out.env).toEqual([]);
    expect(out.secrets).toEqual([]);
  });
});

describe("end-to-end materialization (ecsProvision integration shape)", () => {
  // Mirrors what ecsProvision now does for every enabled gateway on
  // an agent doc. The point is to catch the case where a future
  // catalog change shifts the env contract and silently breaks the
  // task-def shape without anyone noticing — the integration site
  // only does `runtimeEnv.push(...materialized.env)` so a bug here
  // would surface as a runtime error in a real ECS task, not in tests.
  it("materializes a multi-gateway agent doc into a full env+secrets bundle", () => {
    const telegramRecord: AgentGatewayRecord = {
      type: "telegram",
      enabled: true,
      nonSecretConfig: { webhookUrl: "https://relay.perkos.xyz/wh/agent-1" },
      secretsProvided: ["botToken"],
      secretArns: { botToken: "arn:aws:secretsmanager:us-east-1:123:secret:telegram-bot-token" },
      status: "pending",
      createdAt: "2026-05-27T00:00:00.000Z",
      updatedAt: "2026-05-27T00:00:00.000Z",
    };
    const farcasterRecord: AgentGatewayRecord = {
      type: "farcaster",
      enabled: true,
      nonSecretConfig: { fid: "987", replyVisibility: "mentions" },
      secretsProvided: ["neynarApiKey", "signerUuid"],
      secretArns: {
        neynarApiKey: "arn:aws:secretsmanager:us-east-1:123:secret:fc-key",
        signerUuid: "arn:aws:secretsmanager:us-east-1:123:secret:fc-signer",
      },
      status: "active",
      createdAt: "2026-05-27T00:00:00.000Z",
      updatedAt: "2026-05-27T00:00:00.000Z",
    };

    const envOut: Array<{ name: string; value: string }> = [];
    const secretsOut: Array<{ name: string; valueFrom: string }> = [];
    for (const record of [telegramRecord, farcasterRecord]) {
      const m = gatewayRuntimeEnv(record, record.secretArns ?? {});
      envOut.push(...m.env);
      secretsOut.push(...m.secrets);
    }

    const envNames = envOut.map((e) => e.name).sort();
    expect(envNames).toEqual([
      "FARCASTER_ENABLED",
      "FARCASTER_FID",
      "FARCASTER_REPLY_VISIBILITY",
      "TELEGRAM_ENABLED",
      "TELEGRAM_WEBHOOK_URL",
    ]);
    const secretNames = secretsOut.map((s) => s.name).sort();
    expect(secretNames).toEqual([
      "FARCASTER_NEYNAR_API_KEY",
      "FARCASTER_SIGNER_UUID",
      "TELEGRAM_BOT_TOKEN",
    ]);
  });

  it("a disabled gateway contributes nothing to the task def", () => {
    const disabled: AgentGatewayRecord = {
      type: "telegram",
      enabled: false,
      nonSecretConfig: { webhookUrl: "https://x.test/wh" },
      secretsProvided: ["botToken"],
      secretArns: { botToken: "arn:1" },
      status: "pending",
      createdAt: "2026-05-27T00:00:00.000Z",
      updatedAt: "2026-05-27T00:00:00.000Z",
    };
    const m = gatewayRuntimeEnv(disabled, disabled.secretArns ?? {});
    expect(m.env.find((e) => e.name === "TELEGRAM_ENABLED")).toBeUndefined();
    // We do still materialize the non-secret env and the secret ref,
    // matching the gatewayRuntimeEnv contract — but the entrypoint
    // gates plugin-staging on TELEGRAM_ENABLED so the gateway is
    // effectively off. Test documents that contract.
    expect(m.secrets.length).toBe(1);
  });
});

describe("gatewaySecretName", () => {
  it("matches the existing perkos-agents/*/*/kind convention", () => {
    const name = gatewaySecretName(
      "0xABCDEF1234567890",
      "MyBuilder",
      "telegram",
      "botToken",
    );
    expect(name).toBe("perkos-agents/0xabcdef1234567890/mybuilder/gateway-telegram-bot-token");
  });

  it("throws on unknown gateway type", () => {
    expect(() =>
      gatewaySecretName("0x1", "X", "bogus" as never, "k"),
    ).toThrow(/unknown gateway type/);
  });

  it("throws on unknown form key for a real type", () => {
    expect(() =>
      gatewaySecretName("0x1", "X", "telegram", "passwordHash"),
    ).toThrow(/unknown secret formKey/);
  });
});
