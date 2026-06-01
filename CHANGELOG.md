# Changelog

PerkOS App (`app.perkos.xyz`). One entry per release dated by deploy day.
Phase numbering tracks `MIGRATION-PLAN-v2.md` in the workspace root.

## 2026-06-01 — BYOK endpoint overrides in the provisioner

Ported the BYOK ("bring your own model") endpoint overrides into
`app/lib/ecsProvision.ts` (+ `provisionJobs.ts`, `worker/processJob.ts`)
to keep it in sync with PerkOS-API's provisioner. When `llmSource === "byok"`
and `llmBaseUrl` is set, the runtime now points at the user's own
OpenAI-compatible endpoint+model instead of the gateway+kimi, emitting
`PERKOS_LLM_API=openai-completions` and `PERKOS_LLM_PROVIDER=byok` for
OpenClaw. The `byok` provider name is deliberate: a provider named `openai`
+ the official `api.openai.com` baseUrl makes OpenClaw route through the
Codex/Responses runtime, which ignores the config apiKey → 401. Additive —
existing perkos-mode launches are unaffected.

Note: the live provisioner is now PerkOS-API's worker (the miniapp worker
was retired 2026-05-31), so this code path is currently inactive here; the
change keeps the two provisioners consistent for when/if the miniapp worker
returns.

## 2026-05-30 — Real-PM workflow E2E (Hermes plans, Hermes + OpenClaw work)

The full PM workflow the user asked for is live, end-to-end, against
real LLMs. Project `Multi-Agent-Swarm-Test`
(id `QBMeFh7dQd17BDIB3vSp`), wallet `0xc2564e41…8228f`.

### What runs in the loop

```
USER
  ↓ (chat DM, real Hermes LLM)
PM = PerkOS-Tester-v3 (Hermes, role=pm)
  • given a goal + PM system prompt, outputs a strict JSON plan
    `{ plan: [{ name, assigned_to, prompt }, ...] }`
  • picks the right worker per task (researcher vs analyst)

ORCHESTRATOR (script)
  • writes 1 Firestore task doc per plan entry, status=Pending
  • dispatches each task via A2A relay (single persistent connection
    as Test-Delegation-Driver, multiplexed by task id)

PerkOS-Imported-v1 (Hermes, role=researcher)   PerkOS-Claw-v1 (OpenClaw, role=analyst)
  • runtime processes the prompt, returns text  • runtime processes, returns text
  • A2A task_response payload now carries the   • same — see PerkOS-A2A 0.12.5–0.12.7
    real text, not a delivery placeholder
    (PerkOS-A2A 0.12.5–0.12.7)

ORCHESTRATOR
  • for each result: Firestore task → status=Done, result=<text>,
    logs=[dispatched via A2A relay, worker, elapsed]
  • sends completion summary to PM via DM

PM (Hermes)
  • generates a one-sentence acknowledgement (real LLM)

ORCHESTRATOR
  • posts the PM ack + per-task summary to the project's group conv
    → all 3 agents see it (delivered=3)
```

The PM is real (Hermes LLM does the planning). Workers are real
(Hermes + OpenClaw LLMs do the work). Firestore task lifecycle is
real (Pending → Done with captured result text + logs). A2A relay
is real (`wss://transport.perkos.xyz/a2a`, single connection
multiplexed). Group chat broadcast is real (`wss://chat.perkos.xyz`,
3 delivered).

### Live run output

```
[1/8] ensure DM with PM
[2/8] PM replied in 5.0s  ← real Hermes LLM planning
      plan = 2 tasks
        "Explain sidecar pattern"     → PerkOS-Imported-v1 (researcher)
        "Calculate hosting savings"   → PerkOS-Claw-v1 (analyst)
[3/8] created 2 Firestore task docs, status=Pending
[4/8] dispatch via A2A (single persistent connection)
      [OK] PerkOS-Imported-v1 +5.2s
      [OK] PerkOS-Claw-v1     +5.2s
[5/8] Firestore: both tasks Done
[6/8] PM ack in 3.3s  ← real Hermes LLM acknowledgement
      "Sprint complete — thanks to the team for the solid work."
[7/8] group conv summary delivered=3
[8/8] DONE
```

### Worker output samples (captured to Firestore)

`PerkOS-Imported-v1 / Hermes / researcher` (781 chars):

> The sidecar pattern is when you run a helper container right next
> to your main application container so they share the same network
> and storage, but each handles different jobs. It is like a
> motorcyc… [truncated]

`PerkOS-Claw-v1 / OpenClaw / analyst` (508 chars):

> **Self-hosting:**\n- $5/month × 12 months = **$60/year**\n
> **Managed service:**\n- $18/month × 12 months = **$216/year**\n
> **Total one-year savings:**\n- $216 − …

Both are real LLM output, persisted to
`wallets/<wallet>/projects/QBMeFh7dQd17BDIB3vSp/tasks/<id>`.

### Three PerkOS-A2A fixes shipped to make this work

- **0.12.5** — A2A `task_response` carries the runtime's actual
  reply text. Previously the bridge in BYO mode pushed a fixed
  "Delivered to Hermes API Server." artifact and returned, so a2a
  callers saw that placeholder instead of the answer.
  `completeTaskWithReply` is now called after reading the runtime's
  body.
- **0.12.6** — `waitForLocalTaskTerminal` default 45 s → 240 s
  (+ `A2A_TASK_WAIT_MS` env override). OpenClaw analysis prompts
  routinely exceed 45 s; the prior default would expire and the
  relay would emit a non-terminal `task_response` with the
  intermediate "Task queued: …workspace/memory/…md" artifact.
- **0.12.7** — `buildRuntimeMessage` short-circuits to a clean
  prompt when auto-reply is on. The original A2A prompt forced the
  model to prefix its reply with a literal `[A2A_RESULT:<uuid>]`
  marker and repeat task/context IDs. Hermes interpreted that
  rigidly and 50% of the time returned just the marker + nothing.
  New prompt is `Agent <from> (PerkOS A2A task <id>):\n\n<text>` —
  same lesson as 0.12.4's `buildChatMessage` fix.

### Honest scope statement

- The PM's **planning** and **acknowledgement** are real LLM work.
  The **dispatch/persist/notify glue** is a Node script
  (`/tmp/pm-workflow.mjs`) — productizing this as a wallet-facing
  background worker is a separate ticket.
- Workers don't autonomously call `update_task_status` — the
  orchestrator does. A real `agent-tools` API in PerkOS-API would
  let workers do this themselves; designed but not built today.
- Kimi-K2.6 (Hermes default model) returns the literal string
  "(empty)" when asked about specific terms it doesn't know (e.g.
  "PerkOS-A2A bridge"). The PM prompt now steers it to use general
  concepts. Real product would lean on a model with better
  fallback ("I don't know, but here's a guess") OR provide PerkOS
  context in the prompt.

## 2026-05-30 — Multi-agent swarm fully live (OpenClaw broadcast fix + A2A delegation)

Both gaps from the earlier swarm entry are closed. Same 3-agent swarm
(`Multi-Agent-Swarm-Test`, project `QBMeFh7dQd17BDIB3vSp`), same wallet.

### Fixes shipped (PerkOS-A2A 0.12.4)

1. **OpenClaw chat replies through `chat.perkos.xyz` now work** (~15 s,
   not 60+ s of apology paragraphs). Root cause: the bridge prepended
   "POST to 127.0.0.1:5060/chat/reply with…" instructions to every chat
   message. Hermes ignored those; OpenClaw is action-oriented and
   actually tried to honor them via its tool registry, found no
   `perkos-chat` channel registered, and spent the LLM's entire time
   budget retrying tool calls. Fixed in `buildChatMessage` —
   short-circuit to a sender label + the user's text when
   `A2A_HERMES_AUTO_REPLY` is on (the BYO default). The bridge handles
   routing.
2. **`tryHandleAgenticTask` wired into `bridge-agent.ts`.** The
   `agentic-actions.ts` module (sendTask, peer discovery, arrow-route
   parser, @mention detector) already existed but was only reachable
   from the OpenClaw-plugin entry path (`agent.ts`). The chat-enabled
   standalone bridge — what all BYO agents run — had no hook. Wired
   in. BYO agents can now delegate to peers via the relay.
3. **OpenClaw is a first-class runtimeKind in bridge mode.**
   Previously threw "Standalone runtime 'openclaw' is not supported";
   now uses the same `deliverToHermes` path with the bundle's
   `HERMES_API_ENDPOINT` override (already set to
   `/v1/chat/completions` per the OpenClaw fix earlier today).

### Smoke 1 — group broadcast, all 3 agents reply

```
ack delivered=3
<- agent:PerkOS-Tester-v3     +4.6s   OPENCLAW_FIXED
<- agent:PerkOS-Imported-v1   +8.6s   OPENCLAW_FIXED
<- agent:PerkOS-Claw-v1       +14.9s  OPENCLAW_FIXED
PASS  replies: 3
```

OpenClaw replies with the literal text requested in ~15 s — clean,
no more "I'm having trouble finding the reply endpoint" apologies.
Compare to before: 0 / 3 replies from OpenClaw inside a 90 s window.

### Smoke 2 — A2A delegation, multi-hop, mixed runtimes

`Test-Delegation-Driver` (a synthetic sender registered as
`/agents/Test-Delegation-Driver` in Firestore) connects to the relay
`wss://transport.perkos.xyz/a2a`, sends an A2A task to
`PerkOS-Tester-v3` with the body:

> Hand this task to PerkOS-Imported-v1. PerkOS-Imported-v1 should
> reply with the literal text A2A_HOP_OK only.

What happens behind the scenes (parsed from the returned task
artifacts):

```
Test-Delegation-Driver
  → A2A task
PerkOS-Tester-v3  (Hermes, self-hosted, role=pm)
  bridge tryHandleAgenticTask:
    "Route: PerkOS-Tester-v3 -> PerkOS-Imported-v1 -> PerkOS-Claw-v1"
  → server.sendTask
PerkOS-Imported-v1  (Hermes, imported, role=researcher)
  bridge tryHandleAgenticTask: route continues
  → server.sendTask
PerkOS-Claw-v1  (OpenClaw, imported, role=analyst)
  emits: "**A2A_HOP_OK**\nTRI_HERMES_DONE"
  ↓ reply target = PerkOS-Claw-v1 (terminal node)
Final task_response → Test-Delegation-Driver  after 13.9s
```

Two A2A hops across 3 BYO agents of mixed runtimes (Hermes →
Hermes → OpenClaw), the terminal node — an OpenClaw — emits the
literal `A2A_HOP_OK` the user asked for. Whole multi-hop chain
completes in **13.9 s**.

### What this means for the product story

The BYO bundle is now genuinely a **swarm-ready** sidecar, not just
a relay attach point:
- Any user-running Hermes or OpenClaw can be invited as a swarm
  member, reply in chat, AND delegate work to peers via A2A.
- The OpenClaw "tool action" mismatch that blocked the original
  multi-agent test no longer exists — both runtimes get a clean
  prompt and the bridge brokers the reply.
- Cross-runtime delegation (Hermes ↔ OpenClaw) goes through the same
  relay frame shape — no runtime-specific glue per hop.

Pending product work, NOT shipped today (honest scope):
- A Hermes-as-PM orchestrator prompt template (the BYO PM is still a
  one-shot Hermes; coordination still needs the user to drive
  `Test-Delegation-Driver` or equivalent).
- Auto-completion writeback (runtime reply → Firestore
  `task.result`). Today the PM-script does this.

## 2026-05-30 — Multi-agent swarm project (3 agents, mixed runtimes)

Stress-test of the project + swarm + task model with the 3 BYO agents
from earlier in the day. Validates what works today AND surfaces a
concrete architectural gap I owe you. Test wallet
`0xc2564e41…8228f`, project `Multi-Agent-Swarm-Test`
(id `QBMeFh7dQd17BDIB3vSp`).

### Swarm roster

| handle     | agent                | runtime                  | role       |
|------------|----------------------|--------------------------|------------|
| pm         | PerkOS-Tester-v3     | Hermes (self-hosted)     | pm         |
| researcher | PerkOS-Imported-v1   | Hermes (imported)        | researcher |
| analyst    | PerkOS-Claw-v1       | OpenClaw (imported)      | analyst    |

Project doc carries the full `swarm: { version:"1", roster:[…] }`
shape that `app/lib/swarm.ts validateSwarm()` accepts. `agentIds`
+ `members` arrays mirror it for the projects-list UI.

### Group conversation broadcast — works for Hermes, gap for OpenClaw

Created a 4-participant conversation
(`project-QBMeFh7dQd17BDIB3vSp-group`,
kind `channel`, participants `user + 3 agents`). One user `send` →
chat router returned `ack delivered=3` (proves backend broadcast),
both Hermes agents replied in ~21–23s with `chat_message` frames.

**OpenClaw runtime did NOT reply through the broadcast path.** Logs
on `perkos-perkos` (the council OpenClaw) show it understood the
message and generated a reply, but tried to route it through an
OpenClaw "tool action" with `channel: "perkos-chat"` — that channel
isn't registered in the council's tool registry, so the reply
landed as an internal `Unknown channel: perkos-chat` error and never
came back to `chat.sendReply`. Hermes works because the bridge
sidecar uses the `A2A_HERMES_AUTO_REPLY` shortcut to read the
runtime's HTTP response body directly and post a `chat_reply` frame
itself — OpenClaw needs an analogous `perkos-chat` tool registration
inside the OpenClaw runtime, or a similar HTTP-response-shortcut in
the bridge that knows OpenClaw's response shape.

For now: **group-chat broadcasts reach all 3 bridges, Hermes agents
reply correctly, OpenClaw agents are still reachable via DM only.**

### Per-agent task dispatch (PM-as-script)

PerkOS does not ship a runtime-side PM orchestrator yet — the
`agentic-actions.ts` in `@perkos/perkos-a2a` HAS the routing
primitives (`sendTask`, `discoverPeers`, arrow-route parser, mention
detector) but is only wired into `agent.ts` (the OpenClaw plugin
path), NOT into `bridge-agent.ts` (the chat-enabled standalone bridge
the BYO agents run). So the "PM" role in this test is a **node
script** (`/tmp/dispatch-tasks.mjs`), not a Hermes LLM agent acting
as PM. That's a real product gap.

What the script does:
1. `POST /agents/<id>/ensure-conv` for each of the 3 agents (parallel).
2. For each conv, send `task.prompt` over `wss://chat.perkos.xyz/chat`.
3. Wait up to 90 s for a `chat_message from=agent:<name>`.
4. Write the captured reply back to Firestore as `task.result` and
   flip `task.status: "Done"`.

### Live results — all 3 tasks completed

```
[OK] pm         (PerkOS-Tester-v3)   +22.5s
     "Ship one complete, end-to-end user feature to staging and
      validate it with a live smoke test before end of day."
[OK] researcher (PerkOS-Imported-v1) +19.9s
     (empty reply — Hermes returned blank text; still wrote Done so
      the lifecycle is observable. Real-world: a PM would re-prompt.)
[OK] analyst    (PerkOS-Claw-v1)     +4.6s
     "No, but $5/mo Hermes is cheaper than $18/mo Fargate, though
      for a hobby project you might not need either if a free tier
      or local setup works."
```

Firestore final state: project has `agents: 3, tasks: 3`. Three task
docs under
`wallets/<wallet>/projects/QBMeFh7dQd17BDIB3vSp/tasks/` carry
`status: "Done"`, the captured `result`, and per-task `logs`
(`dispatched via DM at convId=…`, `elapsed=Xms`).

### Honest scope statement

This test proves: real swarm + group conv + task lifecycle work as
plumbing today. It does NOT prove: a Hermes agent autonomously
decomposing a goal into tasks, agents delegating to each other via
the A2A relay from BYO bridge mode, or auto-completion writeback from
runtime to Firestore. Those require wiring `tryHandleAgenticTask`
into `bridge-agent.ts` (small) + a PM-prompt template +
runtime-to-Firestore result hook (medium), all separate from this
deploy.

## 2026-05-30 — OpenClaw BYO end-to-end (imported runtime)

Same wallet, third runtime variant proven: a **real OpenClaw runtime**
plugged into PerkOS via the imported-bundle flow. Distinct from the
Hermes path because OpenClaw's API shape is incompatible by default.

### Two bridge-bundle bugs caught + fixed (see PerkOS-API CHANGELOG)

1. **Wrong endpoint**: bundle defaulted to `/v1/responses` (Hermes).
   OpenClaw exposes `/v1/chat/completions`. Fixed in
   `deployBundle.ts` — now emits
   `HERMES_API_ENDPOINT: /v1/chat/completions` when
   `runtimeKind === "openclaw"`.
2. **Wrong model field**: bridge's `deliverToHermes` defaulted to
   `model: "hermes-agent"` in the request body. OpenClaw strictly
   validates `openclaw` or `openclaw/<id>` and 400s on anything else.
   Fixed by baking `HERMES_MODEL: openclaw` into the OpenClaw
   bundle's compose env.
3. **Wrong port** (self-hosted only): OpenClaw listens on
   `:3000`, not `:8642` like Hermes. Self-hosted compose now wires
   `HERMES_API_URL: http://perkos-runtime:3000` for OpenClaw.

### Live proof

- Existing OpenClaw runtime: `perkos-perkos` (council-perkos)
  already running on port 3005 of the LLM VPS host. Treated as a
  third-party Hermes-equivalent — bridge connects via
  `host.docker.internal:3005` with `OPENCLAW_TOKEN=perkos-agent-2026`
  baked into the bundle's `API_SERVER_KEY`.
- Imported launch: agent `PerkOS-Claw-v1`
  (id `eIlhEZ0cPwxiurZPs1g8`), `runtime: "OpenClaw"`,
  `runtimeKind: "openclaw"`, `deployMode: "imported"`.
- Heartbeat: 200 → `bridgeConnected: true`,
  `runtimeVersion: "0.12.3"`, `runtimeKind: "openclaw"`.
- Chat round-trip: sent `"Reply with the literal word
  OPENCLAW_LIVE only."`, agent replied **`OPENCLAW_LIVE` in 7.8s**
  via `chat_message from=agent:PerkOS-Claw-v1`. ~3× faster than
  Hermes (the council OpenClaw runtimes are warm + co-located).
- Bundle regenerated post-fix as `PerkOS-Claw-v3`
  (id `eyKoHo2c5Nt2Ou44gNer`) — compose ships
  `HERMES_API_ENDPOINT: /v1/chat/completions` +
  `HERMES_MODEL: openclaw` natively, no manual patch needed.

### What this proves

The bridge sidecar is genuinely **runtime-agnostic**: same image, same
heartbeat path, same chat WSS — the bundle just rewires three env
vars (endpoint, model, port) per runtimeKind. Users with an existing
OpenClaw fleet can join PerkOS without modifying their runtime.

## 2026-05-30 — BYO end-to-end chat round-trip + project membership

Full user-visible loop validated against `app.perkos.xyz` for BOTH
self-hosted and imported deploy modes. Test wallet
`0xc2564e41…8228f` on the LLM VPS (`46.225.62.30`).

### Mode 2 — self-hosted (full stack)

- Agent: `PerkOS-Tester-v3` (id `vgXgI79rBap1F2ELkfhP`).
- Compose: `perkos-assistant-hermes:local` runtime + locally-built
  `perkos-tester-bridge:local` (perkos-a2a `0.12.3`) sidecar.
- Heartbeat: 200 → `bridgeConnected: true`,
  `runtimeVersion: "0.12.3"`.
- Chat round-trip: `POST /agents/<id>/ensure-conv` → user opened WSS
  to `wss://chat.perkos.xyz/chat`, sent `"Reply with the literal
  word PINGBACK"`, agent replied `PINGBACK` in ~19s via
  `chat_message from=agent:PerkOS-Tester-v3`.
- Project: `BYO-Validation-Test` (id `0c9HmCsdxKNwGQZaF28e`) created
  with `agentIds: [vgXgI79rBap1F2ELkfhP]`. Visible under `/projects`
  for the test wallet.

### Mode 3 — imported (bridge sidecar only, existing Hermes)

- "Existing" Hermes simulated as a SEPARATE compose project on the
  LLM VPS (`existing-hermes-for-imported-test`, host port 18642) —
  represents a Hermes the user already has running outside any
  PerkOS-issued bundle.
- Imported launch: agent `PerkOS-Imported-v1`
  (id `NmXyZaKeQS8gSVSgo68k`) with `deployMode: "imported"`,
  `runtimeKind: "hermes"`,
  `hermesApiUrl: "http://host.docker.internal:18642"`.
- Bundle: bridge-only compose (no runtime container) +
  `API_SERVER_KEY` shared between bridge and external Hermes — the
  bundle ships with `API_SERVER_KEY=` blank and the
  INSTRUCTIONS.md tells the operator to generate one and set it on
  both sides; we did exactly that.
- Heartbeat: 200 → `bridgeConnected: true`,
  `lastBridgeSeenAt: 2026-05-30T04:42:18Z`,
  `runtimeVersion: "0.12.3"`.
- Chat round-trip: same `ensure-conv` → WSS auth → send flow. Agent
  replied `IMPORTED_OK` in ~25s, proving the bridge sidecar
  successfully forwarded the chat frame from `chat.perkos.xyz` to
  the unrelated Hermes process on `host.docker.internal:18642` and
  pushed the reply back through `chat.sendReply`.
- Project: `Imported-Only-Project` (id `bXKb27hUnGhFh4qBzrBE`)
  created with `agentIds: [NmXyZaKeQS8gSVSgo68k]`, plus
  `BYO-Validation-Test` extended to include BOTH agents
  (`agentIds: [vgXgI79rBap1F2ELkfhP, NmXyZaKeQS8gSVSgo68k]`,
  `members` ranked owner / collaborator). Confirms a single project
  can mix managed + BYO + imported agents transparently.

### Test scripts left in `/tmp/` for re-runs

- `/tmp/chat-roundtrip-test.mjs` — minimal ws client that takes
  `AGENT_ID` + `TEST_MSG` env and asserts a `chat_message` from
  `agent:<name>` lands within 90 s. Self-contained; only needs
  `/tmp/perkos-tester-id-token.txt` + the `ws` npm package.
- `/tmp/mint-tester-token.js` — mints a Firebase ID token for the
  test wallet by exec'ing inside the `perkos-api` container (the
  Firebase Admin creds are already in env there). Web API key
  passed as `FIREBASE_PUBLIC_API_KEY=`.

## 2026-05-30 — BYO end-to-end validated on LLM VPS

End-to-end smoke against a fresh `self-hosted` launch on the LLM VPS
(`46.225.62.30`). Agent: `PerkOS-Tester-v3` (id `vgXgI79rBap1F2ELkfhP`).
No App code changes — this entry just records what the wizard now
produces in production.

### Verified

- `POST /agents/launch` with `deployMode: "self-hosted"` returns a
  bundle that bakes `PERKOS_LLM_API_KEY=allowlisted-vps-temporary`
  (PerkOS-managed LLM source default) and pins the bridge image to
  `0.12.3`. Both regressions were on `0.12.2`.
- Bridge boot fires `POST <api>/agents/<id>/heartbeat` and lands a
  `200`. The body shape (`runtimeKind: "hermes"`, `ts: <epoch ms>`)
  matches `HeartbeatRequestSchema`; the 0.12.2 shape was rejected
  with `400` because it sent `"hermes-api"` + ISO string.
- `GET /agents/<id>` after the first heartbeat returns
  `bridgeConnected: true`, `lastBridgeSeenAt: <ISO>`,
  `runtimeVersion: "0.12.3"`. The wizard's polling card flips to
  "Online ✓" off this.
- Hermes runtime `POST /v1/responses` against the LLM gateway returns
  a Kimi-K2.6 reply, confirming the LLM hop works through the BYO
  compose network.

### Infra note (LLM gateway)

- `api.llm.perkos.xyz` nginx allowlist widened from `172.20.0.0/16`
  (the Assistant's specific compose network) to `172.16.0.0/12`
  (covers every Docker default-bridge subnet). Without this, each new
  BYO launch picks a fresh `/16` and 403s on the LLM gateway. The
  magic key `allowlisted-vps-temporary` still gates on source IP, so
  no untrusted process outside this single host can use it.

## 2026-05-29 — BYO (bring-your-own infra) agent wizard

### Added

- **Step 3 in `/agents/new` now offers three deploy modes**:
  - **PerkOS infra (AWS ECS)** — unchanged platform-managed path.
  - **Self-hosted (your infra)** — generates a docker-compose bundle
    (Hermes/OpenClaw runtime + perkos-a2a bridge sidecar). Bridge dials
    OUT to chat + transport, so no inbound ports / NAT / SSH needed.
  - **Import an existing agent** — bridge-only bundle for users who
    already have a Hermes / OpenClaw / custom runtime process running.
    Optional `HERMES_API_URL` override when the runtime isn't on the
    default port.
- **`DeployBundleScreen`** (`app/components/DeployBundleScreen.tsx`).
  Post-launch modal for BYO flows. Tabs: `docker-compose`, `.env`,
  `docker run` (one-liner), `INSTRUCTIONS.md`. Copy-per-tab + download
  whole bundle as a single text file. Polls `GET /api/agents/<id>`
  every 5s for `bridgeConnected: true` and flips a "Waiting for first
  ping…" card to "Online ✓" once the bridge phones home. 10-minute
  timeout fallback with a refresh button.
- **`fetchAgent(agentId)`** helper in `app/lib/perkosApi.ts` — read
  one agent's projection including the new 0.2.0 BYO fields.
- **`launchAgent` extended** to pass `deployMode`, `runtimeKind`, and
  `hermesApiUrl` through to `POST /api/agents/launch`. Capture the
  `deployBundle` from the response when present.

### Removed

- **`vpsIp` / `vpsSshKey` fields from wizard `State`.** The old VPS
  card asked for an SSH endpoint + public key so the platform could
  push the install script; the bridge dial-out pattern makes that
  obsolete. Existing Firestore agent docs may still carry the fields
  (Zod drops unknown keys on read); no migration needed.
- **`ipv4Schema` / `sshPublicKeySchema` validator imports** from
  `app/lib/validators.ts` (the schemas themselves stay in shared-client
  for now; just no longer used by this wizard).
- **`ipError` / `sshError` useMemo blocks** in the wizard.
- **Legacy "Run on a VPS I own" and "Run on my machine" cards**
  (both replaced by the unified "Self-hosted" + "Imported" cards;
  the bridge dial-out works for both).

### Migration notes

- `@perkos/shared-types` peer bumped to `^0.2.0`. Re-install before
  building (`npm install ../../PerkOS-Shared-Types/perkos-shared-types-0.2.0.tgz --no-save --legacy-peer-deps` locally until the package is published).
- Legacy `deployMode: "vps"` / `"local"` values on existing wizard
  drafts (saved in localStorage by older builds — unlikely since we
  removed `useFormDraft` already) would map to `"self-hosted"` on
  the server; safe to ignore.

## 2026-05-29 — Legacy `/api/*` route deletion (Phase 1.3)

### Removed

Now that every authenticated client call goes through `apiClient` →
`api.perkos.xyz` (Phase 1.2.b shipped same-day), the corresponding
same-origin Next route handlers under `app/api/*` are dead code. They
were the rollback target during the overlap window; the platform API
has been stable in prod, so they are deleted to:

- enforce the architectural law that **wallet sign-in is the only
  authenticated server logic that lives in App** — every other call
  flows through the platform API,
- remove ~15 stale route files that drifted from their platform-side
  equivalents and were a footgun for anyone editing both,
- shrink the Docker image and the cold-start surface area.

Deleted directories (PerkOS App):

- `app/api/access/ecs-check/`
- `app/api/access/llm-check/`
- `app/api/agents/` (entire tree — `[agentId]/{ensure-awake,ensure-conv,gateways,gateways/[type]/status,hibernate,hibernation,upgrade,wake,route}`, `jobs/[jobId]/`, `launch/`)
- `app/api/assistant/chat/`
- `app/api/concierge/ensure-conv/`
- `app/api/metrics/` (Grafana scrape endpoint — moved to platform API)
- `app/api/runtimes/`

Kept:

- `app/api/auth/nonce/` + `app/api/auth/wallet-signin/` — wallet
  sign-in carve-out, by architectural law.
- `app/api/request-access/` — still called directly (not via
  `authedFetch`) from `app/components/AccessGate.tsx`. Unauthenticated
  pre-login path; not yet ported to the platform API. Left in place.
- `app/api/contact/` — still called directly from
  `app/components/landing/ContactForm.tsx`. Public landing-page form,
  unauthenticated; not yet ported. Left in place.

Also deleted: `tests/gatewaysApiRoute.test.ts` and
`tests/gatewayStatusRoute.test.ts` — they imported handler functions
from the now-deleted route files. Equivalent coverage lives in the
platform-API repo's test suite.

### Rollback

`git revert` the deletion commit and redeploy. The handlers are
self-contained and their dependencies (`app/lib/*`, AWS SDK, Firebase
admin) are still on disk for the auth + carve-out routes — the
restored files compile without further changes. Note the
`NEXT_PUBLIC_PERKOS_API_URL=""` env-var rollback documented in the
Phase 1.2.b entry is no longer sufficient on its own: if the platform
API is broken AND you've already deployed past this commit, restore
the route files first, then flip the env var.

### Verified

- `npm run typecheck` clean (after clearing stale `.next/types`).
- `npm run test` — 22 suites, 200 cases green.
- `npm run build` clean (Next standalone output). Build manifest
  shows only the four kept routes under `/api/*`.

## 2026-05-29 — Platform-API migration (Phase 1.1 + 1.2.b, auth carved out)

### Architectural law (verified in prod)

> **Wallet sign-in stays in App.** The browser + Farcaster MiniApp +
> Base App flow is complex enough that we explicitly keep its client
> code and `/api/auth/*` routes in App, untouched by the shared lib.
> Once Firebase is signed in, every other authenticated call goes to
> `api.perkos.xyz`.

### Added

- **`@perkos/shared-types ^0.1.0`** + **`@perkos/shared-client ^0.1.0`**
  as runtime deps. Lib code that's NOT in the sign-in critical path
  now flows through the platform packages.

### Changed

- **`app/lib/firebase.ts`** delegates to `initFirebase` from
  `@perkos/shared-client`. Public surface (`firebaseAuth()`,
  `firebaseDb()`) unchanged so component code is untouched.
- **`app/lib/walletAuth.ts`** — **kept as the original same-origin
  flow** (POST `/api/auth/nonce` → sign → POST
  `/api/auth/wallet-signin` with `{ address, nonce, signature }`).
  An earlier Phase 1.2 attempt to route this through shared-client +
  api.perkos.xyz was reverted same-day because it broke Farcaster
  MiniApp / Base App signin and lost the in-flight signature mutex.
- **`app/lib/useWalletSession.ts`** — **kept as the original native
  hook** with its module-level `pendingSignIn` mutex (de-dupes the
  signature prompt across multiple hook instances) and the
  wagmi-disconnect → Firebase signOut effect. Phase 1.1 wrapper was
  reverted same-day for the same reason as walletAuth.
- **`app/lib/apiClient.ts`** swaps the previous same-origin fetch for
  the shared `createApiClient` and rewrites legacy `/api/*` paths
  (e.g. `/api/agents/launch`) to platform-API paths
  (`/agents/launch`) when `NEXT_PUBLIC_PERKOS_API_URL` is set
  (defaults to `https://api.perkos.xyz`). All POST-auth data calls
  (agents, runtimes, concierge, jobs, access checks) now hit
  `api.perkos.xyz` instead of App's own Next routes.
- **`app/lib/validators.ts`** + **`app/lib/format.ts`** are now
  pure re-exports of the shared helpers.
- **`app/lib/useFirebaseUser.ts`** + **`app/lib/useWalletSession.ts`**
  wrap the shared React hooks. The wallet-session wrapper maps
  `signing` → `syncing` and `error: Error → string` so call sites
  in `sign-in/page.tsx`, `/continue`, the layout guard, and
  `DevAuthIndicator` need no changes.
- **`app/lib/perkosApi.ts`** re-exports `Agent`, `AgentRuntime`,
  `LaunchAgentCredentials` from `@perkos/shared-types`. App's
  `LaunchAgentResponse` stays local (slimmer projection).
- **Custom token claims widened** by the platform sign-in:
  Firebase ID tokens now carry `{ walletAddress, role, ecs, llm }`
  instead of just `walletAddress`. Existing consumers ignore the
  new claims — additive, non-breaking.

### Deploy / infra

- **`deploy/Dockerfile`** adds `--legacy-peer-deps` to both
  `npm ci` and `npm install` layers. `@perkos/shared-client@0.1.0`
  peers `firebase ^10 || ^11` while App is on `^12`; runtime APIs
  are stable across all three majors. **0.1.1** of shared-client
  widens the peer range — drop the flag whenever
  `package-lock.json` is regenerated against it.
- Two new explicit deps to replace transitive peers that
  `--legacy-peer-deps` no longer auto-installs:
  - `@wagmi/core ^2.22.1` (peer of `@farcaster/miniapp-wagmi-connector`)
  - `@testing-library/dom ^10.4.1` (peer of `@testing-library/react`)

### Rollback

- Setting `NEXT_PUBLIC_PERKOS_API_URL=""` at build time reverts
  both `walletAuth` and `apiClient` to App's own same-origin
  `/api/*` routes. Local routes stay in place during the overlap
  window — Phase 1.3 will delete them once api.perkos.xyz has a
  stable release.

### Verified

- `npm run typecheck` clean.
- `npm run test` — 24 suites, 219 cases green.
- `npm run build` clean (Next standalone output).
- CORS preflight from `app.perkos.xyz` against
  `api.perkos.xyz/auth/wallet-signin` returns 204 with the
  expected `access-control-allow-origin: https://app.perkos.xyz`.
- Deployed; both `/sign-in` and `/dashboard` return 200; the
  miniapp container reports `healthy`.

## 2026-05-28 — Chat panel deadlock fix (#90)

### Fixed

- **`app/components/ChatbotProvider.tsx`** — "Opening chat…"
  deadlock. Removed `loadingConv` from the `useEffect` deps so
  the `setLoadingConv(true)` call no longer re-triggers the
  effect (which cancelled its own fetch and left the flag
  pinned high forever). The cancelled guard around the success
  path remains; the `.finally` always resets `loadingConv` now.
- Regression test added in `tests/chatbotProvider.test.tsx`.

### Why

The chat panel would open, briefly show "Opening chat…", and
then hang forever for any wallet whose Assistant conversation
hadn't been created yet. The effect re-ran on its own state
write, cancelled the in-flight `ensureAssistantConv`, and the
finally branch was gated by `!cancelled` so the loading flag
never cleared. The fix is one line in the deps array.
