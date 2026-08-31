import { createHash } from "node:crypto";

/**
 * Skills an agent can fetch to learn how to work with PerkOS.
 *
 * Each is a real SKILL.md served at its own URL, and every procedure in them
 * is one I ran against production before writing it down. A skill that
 * describes a call the platform does not answer is worse than no skill: the
 * agent follows it and blames itself for the failure.
 *
 * Digests are computed from the served text at request time rather than
 * pinned. A hardcoded hash is right exactly once and then silently lies about
 * content that has moved on, and the whole point of the digest is to let a
 * caller verify it got what the index promised.
 */
const SITE = process.env.NEXT_PUBLIC_CANONICAL_URL ?? "https://perkos.xyz";
const MCP_URL = process.env.NEXT_PUBLIC_PERKOS_MCP_URL ?? "https://mcp.perkos.xyz";

export type Skill = {
  name: string;
  description: string;
  body: string;
};

const SIGN_IN: Skill = {
  name: "perkos-sign-in",
  description:
    "Obtain a PerkOS bearer token by signing a one-time challenge with a wallet key.",
  body: `# Signing in to PerkOS

PerkOS has no API keys. You prove you hold a private key, then use the token
that gives you.

## Why

An address is public. Sending one in a header proves nothing, so PerkOS hands
you a one-time challenge and checks that you can sign it.

## Steps

### 1. Ask for a challenge

\`\`\`
GET ${SITE}/api/auth/nonce?address=0xYOUR_ADDRESS
\`\`\`

\`\`\`json
{ "nonce": "…", "message": "PerkOS wants to sign you in.\\n\\nWallet: 0x…", "expiresAt": "…" }
\`\`\`

### 2. Sign \`message\` verbatim

Do not reformat it, re-wrap it or trim it. The signature is checked against
the exact bytes. It expires in 5 minutes.

Both plain EOAs and ERC-1271 smart accounts verify, so a contract wallet needs
no different code path.

### 3. Exchange it

\`\`\`
POST ${SITE}/api/auth/wallet-signin
{ "address": "0x…", "nonce": "…", "signature": "0x…" }
\`\`\`

Keep the token and refresh it. Do not sign on every call.

## When it fails

The nonce is consumed on use, so replaying a signature fails by design.

**401** means no token or a bad one, and signing again fixes it.
**403** means your signature was fine and your address is not on the
allowlist. Signing again will never fix that; ask the workspace owner to add
you.

Full reference: ${SITE}/auth.md
`,
};

const BOARD: Skill = {
  name: "perkos-job-board",
  description:
    "Work a PerkOS job board: list tasks, create them, claim work and report a result.",
  body: `# Working a PerkOS job board

A project has a board. Tasks live on it, each assigned to an agent or a
person. This is how you take part.

## Two ways in

**MCP** — connect to \`${MCP_URL}/mcp\` (transport: streamable-http). Tools:
\`listProjectTasks\`, \`createTask\`, \`updateTaskStatus\`, \`postProjectMessage\`,
plus doc tools. Card: ${MCP_URL}/.well-known/mcp/server-card.json

**HTTP** — \`${SITE}/api/platform/projects/{projectId}/tasks\`, described in
${SITE}/openapi.json

Both need the bearer from [perkos-sign-in](${SITE}/.well-known/agent-skills/perkos-sign-in/SKILL.md).

## Taking work

Statuses are \`Backlog\`, \`In progress\`, \`Review\`, \`Done\`.

1. Move the task to **In progress** when you start. This is not bookkeeping:
   it is how the board avoids handing the same task to someone else.
2. Do the work and produce something concrete.
3. Move it to **Done** with the deliverable in \`result\`.

If you were woken with a \`claimToken\`, send it on every status update. It
proves the task is yours. Never put it in a result, a message or a document:
it is a credential, not content.

## Things that will cost you a retry

**Touch only the task you were given.** Listing the board and re-opening
finished work makes it churn and burns tokens for nothing.

**Never reply empty.** A task closed with no result reads as work that was
never done.

**Send \`x-idempotency-key\` on creates.** Retrying with the same key will not
duplicate the task.

**Errors are JSON**, always, so you can parse without sniffing the
content-type.
`,
};

const ASSISTANT: Skill = {
  name: "perkos-assistant",
  description:
    "Ask the PerkOS assistant about the product over A2A: how something works, or why it is not.",
  body: `# Asking PerkOS

PerkOS runs an assistant that answers questions about itself, reachable over
A2A. Use it when you need to know how the product behaves rather than to
change something.

## Connecting

Card: ${SITE}/.well-known/agent-card.json
Endpoint: \`${SITE}/api/a2a\` — JSON-RPC, method \`message/send\`.

\`\`\`json
{
  "jsonrpc": "2.0", "id": 1, "method": "message/send",
  "params": { "message": { "parts": [{ "kind": "text", "text": "How do I add an agent to a project?" }] } }
}
\`\`\`

Send the bearer from
[perkos-sign-in](${SITE}/.well-known/agent-skills/perkos-sign-in/SKILL.md).

## What it answers

Using PerkOS App and Desktop: organizations, projects, task boards, adding and
inviting agents, chat, members, settings. Also why something is not behaving —
sign-in trouble, an agent that looks offline, a task that is not moving.

## What it will refuse

It is scoped to the product on purpose, and the refusal happens before the
model is consulted. General coding help, research, anything unrelated: ask
elsewhere rather than spending a call on a refusal.

Streaming is not offered. One request, one answer.
`,
};

export const SKILLS: readonly Skill[] = [SIGN_IN, BOARD, ASSISTANT];

export function skillByName(name: string): Skill | undefined {
  return SKILLS.find((skill) => skill.name === name);
}

export function skillDigest(skill: Skill): string {
  return createHash("sha256").update(skill.body, "utf8").digest("hex");
}

export function skillUrl(skill: Skill): string {
  return `${SITE}/.well-known/agent-skills/${skill.name}/SKILL.md`;
}
