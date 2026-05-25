/**
 * Client for the PerkOS-LLM gateway's agent key registry.
 *
 * The LLM gateway at api.llm.perkos.xyz now accepts per-agent Bearer
 * tokens on /v1/* and /api/* (PerkOS-LLM PR #3). This module is how
 * /api/agents/launch mints a key for each freshly provisioned agent
 * — POSTs to the admin endpoint with our shared admin token, gets a
 * fresh `pllm_…` key back, hands it to the caller for storage in
 * Secrets Manager and injection into the runtime container.
 *
 * Auth: the gateway's /admin/* endpoints are gated by ADMIN_TOKEN
 * (Bearer). We read it from `PERKOS_LLM_ADMIN_TOKEN`. The miniapp's
 * production env on the Hetzner VPS has the matching value; for dev
 * it's optional — if missing, `registerLlmAgent` throws and the
 * caller can degrade gracefully.
 */

import "server-only";

const GATEWAY_URL =
  process.env.PERKOS_LLM_GATEWAY_URL ?? "https://api.llm.perkos.xyz";
const ADMIN_TOKEN = process.env.PERKOS_LLM_ADMIN_TOKEN ?? "";

export type LlmRegistration = {
  /** Plaintext key — only available on the registration response.
   *  Must be persisted (e.g. AWS Secrets Manager) before the next hop. */
  key: string;
  /** Last 4 chars of the key — safe to log + show in admin UIs. */
  last4: string;
};

function ensureAdminToken(): string {
  if (!ADMIN_TOKEN) {
    throw new Error(
      "PERKOS_LLM_ADMIN_TOKEN is not set — cannot talk to LLM gateway admin API",
    );
  }
  return ADMIN_TOKEN;
}

export async function registerLlmAgent(
  agentName: string,
): Promise<LlmRegistration> {
  const token = ensureAdminToken();
  const res = await fetch(`${GATEWAY_URL}/admin/agents/register`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ agent: agentName }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `LLM gateway registration failed (${res.status}): ${text.slice(0, 200)}`,
    );
  }

  const json = (await res.json()) as {
    ok?: boolean;
    agent?: string;
    key?: string;
    last4?: string;
    error?: string;
  };
  if (!json.ok || !json.key || !json.last4) {
    throw new Error(
      `LLM gateway registration returned malformed body: ${JSON.stringify(json).slice(0, 200)}`,
    );
  }
  return { key: json.key, last4: json.last4 };
}

export async function revokeLlmAgent(agentName: string): Promise<void> {
  const token = ensureAdminToken();
  const res = await fetch(`${GATEWAY_URL}/admin/agents/revoke`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ agent: agentName }),
  });

  if (!res.ok && res.status !== 404) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `LLM gateway revoke failed (${res.status}): ${text.slice(0, 200)}`,
    );
  }
}
