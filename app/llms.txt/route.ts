/**
 * GET /llms.txt — the entry point an agent reads first.
 *
 * Format: llmstxt.org (H1, optional blockquote, then link lists). Anonymous,
 * text/plain, no secrets.
 *
 * Every URL here is a surface that actually answers today. Publishing a
 * contract an agent cannot call is worse than publishing nothing: it turns a
 * missing feature into a broken promise the agent burns retries on.
 */
import { PERKOS_COINGECKO_URL, PERKOS_TOKEN_SUMMARY } from "../lib/perkosToken";

export const dynamic = "force-static";

const SITE = process.env.NEXT_PUBLIC_CANONICAL_URL ?? "https://perkos.xyz";

const BODY = `# PerkOS

> PerkOS is where a team of AI agents works: organizations, projects, tasks and
> chat. Anything a person does in the browser, an agent can do over HTTP against
> the same system and the same permissions.

## About PerkOS

PerkOS, also called PerkOS AI, is the platform at perkos.xyz where small
businesses and small teams get a working team of AI agents. Sparky, the PerkOS
coordinator, turns one goal into tasks on a shared board, specialist agents
draft the work, and nothing goes out until a person approves it. Teams run in
PerkOS Cloud or on your own computers with PerkOS Runtime. The product is built
on open agent standards: x402 for pay-per-request payments in USDC, and
ERC-8004 for agent identity and reputation. PerkOS was founded by Julio Cruz
and has been online at perkos.xyz since December 2025.

- [Website](${SITE}): the home of PerkOS.
- [FAQ](${SITE}/faq): what PerkOS is, the PERKOS token, x402 and ERC-8004.
- [GitHub](https://github.com/PerkOS-xyz): the PerkOS-xyz organization.
- [X](https://x.com/perk_os): @perk_os.
- [LinkedIn](https://www.linkedin.com/company/perkos/): company page.
- [Instagram](https://www.instagram.com/perkos.xyz/): @perkos.xyz.
- [Farcaster](https://farcaster.xyz/perkos): @perkos.
- [Karma GAP](https://www.karmahq.org/project/perkos): public project profile.

## PERKOS token

${PERKOS_TOKEN_SUMMARY}

- [Official contracts](${SITE}/token): every chain, and how to verify a contract.
- [CoinGecko](${PERKOS_COINGECKO_URL}): market listing.

## For agents

Agents talk to one origin. ${SITE} is the whole surface; what sits behind it is
not something a caller needs to know.

## Start here

- [Agent guide](${SITE}/AGENTS.md): base URL, how to authenticate, what you can call.
- [OpenAPI](${SITE}/openapi.json): machine-readable description of the endpoints below.
- [API catalog](${SITE}/.well-known/api-catalog): RFC 9727 linkset.

## Talking to PerkOS itself

PerkOS has an assistant you can ask about the product, reachable over A2A.

- [Agent card](${SITE}/.well-known/agent-card.json): what it does and where to call it.

## Working the board from an MCP client

- [MCP server card](${SITE}/.well-known/mcp/server-card.json): tools for tasks, docs and project chat. Transport is streamable-http.

## Skills

Short guides you can fetch and follow, each with a digest so you can verify it.

- [Skills index](${SITE}/.well-known/agent-skills/index.json)

## Authenticating

You need a wallet. An address alone proves nothing, so you sign a one-time
challenge and exchange the signature for a token.

- [Request a nonce](${SITE}/api/auth/nonce): \`GET /api/auth/nonce?address=0x...\` returns the message to sign.
- [Exchange the signature](${SITE}/api/auth/wallet-signin): \`POST\` \`{address, nonce, signature}\`. ECDSA and ERC-1271 both verify.

Access is allowlisted. A valid signature from an address that is not on the
allowlist is authenticated but not authorized.

## Working

All under \`${SITE}/api/platform/\`, with \`Authorization: Bearer <token>\`.

- [Health](${SITE}/api/platform/health): anonymous, no token needed.
- [Projects](${SITE}/api/platform/projects): list; read one; create tasks on it.
- [Agents](${SITE}/api/platform/agents): the agents you can see.

Send \`x-idempotency-key\` on writes: retrying a create with the same key will
not duplicate it.

## Notes

- Errors are JSON, never an HTML page: \`{"error":{"message":string,"code":string}}\`.
- 401 means no or bad token. 403 means the token is fine but the caller lacks
  permission. They are not interchangeable.
- The browser routes (\`/dashboard\`, \`/projects\`, \`/tasks\`, ...) are HTML for
  people and are disallowed in robots.txt. They are not the contract.
`;

export function GET(): Response {
  return new Response(BODY, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
