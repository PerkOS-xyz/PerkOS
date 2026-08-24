/**
 * The authentication document, shared by the two paths that serve it.
 *
 * Readiness scanners fetch `/auth.md` at the ROOT; `/.well-known/auth.md` is
 * the tidier location and is where it was published first. Both answer, from
 * one source, so they cannot drift into disagreeing about how to sign in.
 */
const SITE = process.env.NEXT_PUBLIC_CANONICAL_URL ?? "https://perkos.xyz";
const ISSUER = process.env.NEXT_PUBLIC_PERKOS_OAUTH_URL ?? "https://oauth.perkos.xyz";

export const AUTH_MARKDOWN = `# Auth.md

<!--
  The H1 is the literal \`Auth.md\` the convention expects, not a prettier
  "Authentication". A readiness scan that found this file still reported it
  missing: "auth.md exists but is missing the expected Auth.md heading". The
  heading is the machine-readable part; the prose below is for the reader.
-->

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

## If you speak OAuth

There is an OAuth 2.0 authorization server at \`${ISSUER}\`, and it verifies the
same wallet signature described above — it is a façade over this flow, not a
second way to log in.

- [Authorization server metadata](\`${ISSUER}\`/.well-known/oauth-authorization-server)
- [Protected resource metadata](\`${SITE}\`/.well-known/oauth-protected-resource)

Get the nonce here, sign it, then exchange it at that server's token endpoint
with \`grant_type: urn:perkos:oauth:grant-type:wallet-signature\`. It issues no
\`id_token\`, so it is not an OpenID provider.
`;


export function authMarkdownResponse(): Response {
  return new Response(AUTH_MARKDOWN, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
