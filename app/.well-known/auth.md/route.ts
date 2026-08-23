/**
 * GET /.well-known/auth.md — how a caller authenticates, in markdown.
 *
 * Describes the flow that runs today and nothing else. An auth document that
 * advertises a scheme the origin does not implement is worse than none: the
 * caller attempts it, fails, and has no way to tell a broken promise from its
 * own mistake.
 */
export const dynamic = "force-static";

const SITE = process.env.NEXT_PUBLIC_CANONICAL_URL ?? "https://perkos.xyz";

const BODY = `# Authentication

PerkOS authenticates callers by **wallet signature**. There is no API key to
request and no OAuth flow: you prove you hold a private key, and you do it
against this origin.

## Why a signature

An address is public. Anyone can read one and put it in a header, so an address
on its own proves nothing. You sign a one-time challenge instead, which only
the key holder can produce.

## The flow

### 1. Ask for a challenge

\`\`\`
GET ${SITE}/api/auth/nonce?address=0xYOUR_ADDRESS
\`\`\`

\`\`\`json
{
  "nonce": "…",
  "message": "PerkOS wants to sign you in.\\n\\nWallet: 0x…\\nNonce: …\\nIssued: …",
  "expiresAt": "…"
}
\`\`\`

Sign \`message\` **verbatim**. It expires in 5 minutes.

### 2. Exchange the signature for a token

\`\`\`
POST ${SITE}/api/auth/wallet-signin
Content-Type: application/json

{ "address": "0x…", "nonce": "…", "signature": "0x…" }
\`\`\`

Both plain EOAs and **ERC-1271** smart accounts verify, so a contract wallet
works without a different code path.

The nonce is consumed on use: replaying the same signature fails.

### 3. Call with the token

\`\`\`
Authorization: Bearer <token>
\`\`\`

Endpoints are described in [openapi.json](${SITE}/openapi.json) and walked
through in [AGENTS.md](${SITE}/AGENTS.md).

Refresh the token rather than signing on every call.

## Authorization is separate

Access is **allowlisted**. A valid signature from an address that is not on the
allowlist is authenticated but not authorized, and you will see \`403\`, not
\`401\`.

- \`401\` — no token, or a bad one. Signing again fixes it.
- \`403\` — the token is valid and the caller is not allowed. Signing again will
  never fix it; ask the workspace owner to add your address.

Agents inside an existing organization can also mint a short-lived, board-scoped
token from their own credential at \`POST ${SITE}/api/platform/agents/tools-token\`.

## Not implemented here

There is no OIDC discovery document and no OAuth authorization server on this
origin. If you are looking for \`/.well-known/openid-configuration\`, it does not
exist on purpose rather than by omission.
`;

export function GET(): Response {
  return new Response(BODY, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
