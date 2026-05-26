# PerkOS Assistant

Platform-level chat assistant that lives inside PerkOS, helps users navigate their agents, and (later) helps admins with system-level questions. This directory is **content** — the persona definition + the seed runbook. The runtime that consumes it ships separately (see "Where the code lives" below).

## What's here

- [`SOUL.md`](./SOUL.md) — the 8-section persona definition that becomes the Assistant's system prompt at runtime. Edit this when the Assistant's personality, boundaries, or memory policy should shift.
- [`runbook/`](./runbook/) — markdown entries covering the most-asked topics. The Assistant loads these via the `getRunbookFor(topic)` tool at request time, so editing a file here changes the Assistant's behavior on the next chat turn without a redeploy.

## Runbook format

Every entry is a markdown file with YAML frontmatter:

```markdown
---
topic: deploy-modes                    # unique slug, matches getRunbookFor(topic) arg
audience: user | admin | both          # who can see this entry
keywords: [deploy, ecs, fargate, ...]  # for searchKnowledge() fuzzy match
last_reviewed: 2026-05-26              # human curator marks this when reviewed
---

# Entry title

Body.
```

Rules:
- One topic per file. If a topic has user-facing and admin-facing slices, write two files.
- The Assistant cites the topic slug in its replies ("from the deploy-modes runbook…") so the user can audit which entry it pulled.
- Keep entries short and recipe-shaped. The Assistant has the LLM for explaining; the runbook gives it the FACTS.
- Mark `last_reviewed` when you sanity-check the entry against current platform state. Entries older than 90 days surface a warning in the admin runbook editor.

## How this connects to the running Assistant

The Assistant itself is a real PerkOS agent — a Hermes container running on the LLM VPS (`46.225.62.30`), connecting to `chat.perkos.xyz` like any user-launched agent.

```
docs/perkos-assistant/SOUL.md       ─┐
docs/perkos-assistant/runbook/*.md  ─┤  baked into the Hermes image at build
                                     │  (PerkOS-Containers/hermes/perkos-assistant/)
                                     ▼
            ┌───────────────────────────────────────────┐
            │ Hermes container (PerkOS-Assistant agent)│
            │   - SOUL.md → system prompt              │
            │   - runbook/ → loaded by perkos-platform-│
            │     tools skill as getRunbookFor(topic)  │
            │   - connects to chat.perkos.xyz with     │
            │     its own relayApiKey                  │
            └───────────────────────────────────────────┘
```

## Where the code lives

The Assistant has three code surfaces that live elsewhere:

- **Hermes runtime image** — `PerkOS-Containers/hermes/` (existing). On build, we'll copy this `docs/perkos-assistant/` directory into the image at `/opt/perkos-assistant/` so the skill can read it at runtime.
- **`perkos-platform-tools` skill** — `PerkOS-Containers/hermes/skills/perkos-platform-tools/` (to be added). Defines the tools the LLM can call:
  - Public: `getRuntimeVersions`, `getRunbookFor(topic)`, `searchKnowledge(query)`, `listAvailableImages`, `explainPlugin(id)`
  - User-scoped (walletAddress from convId, not LLM args): `listMyAgents`, `getMyAgent(name)`, `getMyConversations`
  - Admin-scoped (super-admin check server-side): `listAllAgents`, `getSystemHealth`, `proposeRunbookUpdate`, `flagAgent`
- **Bootstrap** — a one-time script that calls `POST /api/agents/launch?kind=platform` (after we add the `kind` flag) to register the Assistant in Firestore `/agents/PerkOS-Assistant` and `/platform_agents/PerkOS-Assistant`, mints its `relayApiKey`, and starts the Hermes container on the LLM VPS.

## How the Assistant handles isolation

The Assistant serves N users from one container identity. Isolation is enforced at the tool layer:

```typescript
// Tools the LLM sees:
{ name: "listMyAgents", parameters: {} }  // no walletAddress param

// Server-side handler (in perkos-platform-tools):
async function listMyAgents(ctx: { convId: string }) {
  const conv = await loadConv(ctx.convId);     // from PerkOS-Chat's convs.mjs
  const wallet = walletFromConv(conv);          // server-verified, NOT LLM-supplied
  return firestore.collection('wallets').doc(wallet).collection('agents').get();
}
```

The LLM never sees `walletAddress` as a tool parameter. Even if it tries to inject one, the plugin layer overrides with the convId → wallet mapping that `chat.perkos.xyz` already maintains.

Admin tools live in a parallel namespace and check super-admin status server-side from the conv participant prefix (`admin:0x…` vs `user:0x…`). The admin surface lives at `admin.perkos.xyz/assistant`; the user surface at the existing ChatbotTrigger in `app.perkos.xyz`. Same Assistant identity, different tool tier per conv.

## Why content lives in this repo (not PerkOS-Containers)

The runbook IS the Assistant's knowledge. Keeping it next to the rest of the PerkOS app means:
- The admin runbook-editor UI (when it ships) can git-commit changes via the same auth + audit trail as everything else
- Other parts of the codebase can reference the same FAQs (e.g. the wizard could link a question to `/docs/perkos-assistant/runbook/03-llm-options.md` directly)
- One source of truth for both the LLM and the docs site

`PerkOS-Containers` consumes the directory at image-build time via a `COPY` instruction; it doesn't own it.

## Open work (tracked in memory)

The architecture is captured in `~/.claude/projects/.../memory/project_ops_assistant.md`. Open questions and the build sequence live there. This README focuses on what's needed to USE the content; the deeper "why" is in the memory file.
