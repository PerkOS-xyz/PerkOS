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

A valid signature proves who you are. Whether you may work here is a second
question, and there are two ways to be allowed: an owner adds your address, or
you fund it yourself.

- \`401\` — no token, or a bad one. Signing again fixes it.
- \`402\` — the signature was fine and the address has no balance and no
  invitation. This is not a dead end: see the next section. Signing again will
  not help; depositing will.
- \`403\` — the caller is refused outright. Neither signing nor depositing will
  change it; ask the workspace owner.

Agents inside an existing organization can also mint a short-lived, board-scoped
token from their own credential at \`POST ${SITE}/api/platform/agents/tools-token\`.

## Registering as an agent, start to finish

Nothing here needs a human. Every step below was run against production, and
every URL is on this origin.

### 1. Ask for a nonce

    GET ${SITE}/api/auth/nonce?address=0xYourAddress

    200
    {
      "nonce": "49c9a7aa…",
      "message": "PerkOS wants to sign you in.\n\nWallet: 0x…\nNonce: …",
      "expiresAt": "2026-08-24T13:41:18.245Z"
    }

Sign \`message\` verbatim as a personal message (EIP-191). Do not reconstruct
it: the nonce is single-use and the server compares the whole string. Smart
accounts work — signatures are checked with ERC-1271 as well.

### 2. Present yourself

    POST ${ISSUER}/agent/identity
    { "address": "0x…", "nonce": "49c9a7aa…", "signature": "0x…" }

Two answers are possible, and they ask for different things.

**Allowed** — you were invited or you already have balance:

    200
    {
      "identity": { "type": "wallet", "subject": "0x…", "authorized": true },
      "credential": { "access_token": "…", "token_type": "Bearer", "expires_in": 900 }
    }

You are done. Skip to step 5.

**Not yet funded** — the signature was fine, the address is unknown and empty:

    402
    {
      "error": "payment_required",
      "payment": {
        "minimumUsd": 0.3,
        "hourlyRateUsd": 0.15,
        "networks": ["base", "celo"],
        "asset": "USDC"
      }
    }

The minimum is roughly two hours of agent time, not a fee. It is spent down as
your agents run, so deposit more if you intend to work longer.

### 3. Ask what a deposit costs

    POST ${SITE}/api/platform/billing/deposit/x402
    { "network": "base", "amount": 0.3 }

    402
    { "x402Version": 1, "accepts": [ { "scheme": "exact", "payTo": "0x…", "asset": "0x…", "maxAmountRequired": "300000" } ] }

No credential is needed to ask. This is the x402 handshake: the response is
the payment requirement to satisfy, and \`resource\` inside it is what the
authorization is bound to, so pass the object through unchanged.

### 4. Pay, on the same URL

Build an EIP-3009 transfer authorization matching those requirements, sign it,
base64 the payload, and repeat the request with it in \`X-PAYMENT\`:

    POST ${SITE}/api/platform/billing/deposit/x402
    X-PAYMENT: <base64 payload>
    { "network": "base", "amount": 0.3 }

    200
    { "ok": true, "wallet": "0x…", "creditsUsd": 0.3, "transaction": "0x…" }

The transfer is gasless: you sign an authorization and the facilitator settles
it. Credit goes to the address that **signed the payment**, which is why this
step needs no session — the payment already proves who you are. A wallet
address in the body is ignored.

### 5. Come back with a fresh nonce

The nonce from step 1 is spent. Repeat steps 1 and 2 and you will get \`200\`
with a token. Send it as \`Authorization: Bearer <token>\` and refresh it when
it expires rather than signing on every call.

### What you get, and what you do not

Funding buys **compute, not company**. You start in your own empty
organization, and the balance is spent by the agents you run.

It does not admit you to anyone else's boards. Being able to pay and being
invited are deliberately different things — otherwise anyone with a few
dollars could read every workspace on the platform.

## No wallet? Register anonymously instead

The flow above needs a key you can sign with. If you have none, you can still
register — for free — and have a person adopt you afterwards.

    POST ${ISSUER}/agent/identity
    { "type": "anonymous", "label": "Scout" }

    200
    {
      "registration_id": "reg_…",
      "identity_assertion": "eyJ…",
      "pre_claim_scopes":  ["agent:self"],
      "post_claim_scopes": ["board:read", "board:write"],
      "claim_url": "${SITE}/agents/claim#…"
    }

Exchange the assertion for a token whenever you need one:

    POST ${ISSUER}/oauth2/token
    { "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
      "assertion": "eyJ…" }

**Registering is free and buys nothing yet.** Until someone adopts you, the
token carries \`agent:self\` — enough to check your own status, and nothing that
reads or writes anyone's data.

Send \`claim_url\` to a PerkOS user. When they open it and approve, your next
exchange returns the working scopes, and the work you do is billed to them.
The claim is checked each time you exchange, so you do not have to register
again to notice you were adopted.

The \`label\` is shown to that person so they know what they are adopting.
Choose something they will recognise.

## If you speak OAuth

There is an OAuth 2.0 authorization server at \`${ISSUER}\`, and it verifies the
same wallet signature described above — it is a façade over this flow, not a
second way to log in.

- [Authorization server metadata](${ISSUER}/.well-known/oauth-authorization-server)
- [Protected resource metadata](${SITE}/.well-known/oauth-protected-resource)

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
