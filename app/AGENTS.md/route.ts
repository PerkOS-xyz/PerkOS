/**
 * GET /AGENTS.md — the agent-facing guide, in markdown.
 *
 * Vercel's Agent Readability spec looks for this file; isitagentready counts a
 * markdown surface under Content Accessibility. Same rule as llms.txt: only
 * endpoints that answer today.
 */
export const dynamic = "force-static";

const SITE = process.env.NEXT_PUBLIC_CANONICAL_URL ?? "https://perkos.xyz";

const BODY = `# Working with PerkOS as an agent

PerkOS runs a team's work: organizations, projects, tasks and chat. A person
uses the browser. An agent uses HTTP against the same system, the same data and
the same permissions.

One origin: \`${SITE}\`. You never need another hostname.

## 1. Get a wallet on the allowlist

Access is allowlisted, the same way it is for people. Ask the workspace owner to
add your address.

An address is public, so sending one in a header proves nothing. You prove you
hold the key by signing a challenge.

## 2. Sign in

\`\`\`
GET ${SITE}/api/auth/nonce?address=0xYOUR_ADDRESS
\`\`\`

Returns a one-time \`nonce\`, the exact \`message\` to sign, and \`expiresAt\`
(5 minutes). Sign the message verbatim.

\`\`\`
POST ${SITE}/api/auth/wallet-signin
{ "address": "0x...", "nonce": "...", "signature": "0x..." }
\`\`\`

The signature is verified for both plain EOAs and ERC-1271 smart accounts. The
nonce is consumed, so a replay of the same signature fails.

Keep the token. Refresh it rather than signing on every call.

## 3. Call the platform

Everything lives under \`${SITE}/api/platform/\` with
\`Authorization: Bearer <token>\`.

| Method | Path | What it does |
|---|---|---|
| GET | \`/api/platform/health\` | Liveness. No token required. |
| GET | \`/api/platform/projects\` | Projects you can see. |
| GET | \`/api/platform/projects/{id}/tasks\` | Tasks on a board. |
| POST | \`/api/platform/projects/{id}/tasks\` | Create tasks. |
| PATCH | \`/api/platform/projects/{id}/tasks/{taskId}\` | Rename, reprioritise, reassign, move status. |
| GET | \`/api/platform/agents\` | Agents you can see. |

Machine-readable: [\`/openapi.json\`](${SITE}/openapi.json).

## 4. Rules that will save you a retry loop

**Idempotency.** Send \`x-idempotency-key\` on writes. Retrying a create with the
same key does not duplicate it.

**Errors are JSON.** Always \`{"error":{"message":string,"code":string}}\`. You
will never get an HTML landing page from these paths, so you can parse without
sniffing.

**401 is not 403.** 401 means no or bad token. 403 means the token is valid and
the caller is not allowed. Re-signing fixes the first and never the second.

**Payment.** \`x-payment\` is forwarded and \`x-payment-response\` is returned, so
a job that requires payment can answer 402 and be retried. Which jobs charge is
a product decision and is not settled; treat 402 as possible, not as promised.

## 5. What is not here

The browser routes (\`/dashboard\`, \`/projects\`, \`/tasks\`, \`/chat\`, ...) are HTML
for people and are disallowed in \`robots.txt\`. Scraping them is not the
contract and they will not be stable for you.
`;

export function GET(): Response {
  return new Response(BODY, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
