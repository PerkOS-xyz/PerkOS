<div align="center">
  <img src="public/perkos-header.png" alt="PerkOS" width="240" />

  <h1>PerkOS — MiniApp</h1>

  <p>
    <b>Run a team of AI agents that actually ship work.</b><br/>
    Wallet-native workspace for project rooms, kanban boards, and multi-channel AI agents.
  </p>

  <p>
    <a href="https://perkos.xyz">perkos.xyz</a> ·
    <a href="https://github.com/PerkOS-xyz">GitHub org</a> ·
    <a href="https://x.com/perk_os">X</a> ·
    <a href="https://farcaster.xyz/perkos">Farcaster</a>
  </p>
</div>

---

## What is this

The **PerkOS MiniApp** is the user-facing surface of PerkOS — a Farcaster / Base App Mini App that lets a wallet owner spin up an AI workforce: launch agents (Hermes or OpenClaw runtime), create project rooms with a live kanban, chat with agents 1-on-1 or in a group, and route them to channels like Telegram, Discord, WhatsApp, Slack, X and Email.

- **Wallet-native** — sign in with a Base smart wallet (email + passkey) or any injected wallet. The wallet *is* the account.
- **Multi-runtime** — pick Hermes (chat + tooling) or OpenClaw (autonomous executor) per agent.
- **BYOK or managed** — bring your own OpenAI / Anthropic / OpenRouter keys, or use PerkOS LLM services.
- **Multi-chain** — Base + Celo (testnets first, mainnet on the roadmap).
- **Open source** — see [LICENSE](./LICENSE) (TBD).

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js **16.2.6** (App Router, Turbopack) |
| Runtime | React **19.2.4**, TypeScript strict |
| Styling | Tailwind **4**, shadcn-style primitives, lucide-react, Poppins |
| Wallets | wagmi v3 + `@base-org/account` + injected |
| Data | Firebase **Firestore** (client SDK + Admin SDK) |
| Auth | Wallet → SIWE-style nonce → Firebase custom token (`uid = walletAddress.toLowerCase()`) |
| LLM | OpenAI / Anthropic via `/api/assistant/chat`, BYOK per wallet |

> **Heads-up for AI coding assistants:** this Next.js version has breaking changes vs. older training data. When writing routing or server code, consult `node_modules/next/dist/docs/` rather than relying on memory. See [`AGENTS.md`](./AGENTS.md).

## Getting started

```bash
# install
npm install

# copy env template and fill it in
cp .env.example .env

# run dev (Turbopack)
npm run dev
```

Open <http://localhost:3000>.

### Required environment

See [`.env.example`](./.env.example) for the full list. Minimum to boot:

- `NEXT_PUBLIC_SITE_URL` — canonical origin (used in OG tags, sitemap, Farcaster manifest).
- `NEXT_PUBLIC_FIREBASE_*` — Firebase web SDK config (public).
- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` — Admin SDK (server only).
- `NEXT_PUBLIC_PERKOS_WHITELIST` — comma-separated wallet allowlist for the private alpha. **If empty, no wallet has access.**
- `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` — optional. If neither is set, `/api/assistant/chat` returns a stub reply (useful in dev).

Secrets live in `.secrets/service-account.json` (gitignored). Never commit `.env`.

## Project layout

```
app/
  page.tsx                  Public landing page
  layout.tsx                Root layout + Mini App frame metadata
  providers.tsx             wagmi + React Query + onboarding context
  .well-known/farcaster.json/route.ts   Mini App manifest
  (auth)/                   /sign-in, /sign-up — wallet connect + AccessGate
  onboarding/               welcome → workspace → agent → project
  (app)/                    Authed workspace: dashboard, projects, tasks, agents, chat, settings, notifications, organizations
  api/
    auth/nonce              Issues a sign-in nonce per wallet
    auth/wallet-signin      Verifies signature, mints Firebase custom token
    agents/launch           Provisions an agent runtime (ECS / Cloud Run)
    assistant/chat          PerkOS Agent + per-agent chat (buffered or SSE)
    contact, request-access Public form handlers
  lib/
    perkosApi.ts            Firestore-backed data layer (Project / Task / Agent / ChatMessage)
    firebase.ts             Client SDK init
    firebaseAdmin.ts        Admin SDK init
    walletAuth.ts           Wallet → Firebase sign-in dance
    wagmi.ts                Base + Base Sepolia config
components/ui/              shadcn primitives
scripts/                    Admin SDK utilities (allowlist seed / list)
docs/
  API.md                    Canonical backend contract
  E2E-CHECKLIST.md          Manual QA checklist
firestore.rules             Per-wallet access rules
firebase.json               Firestore deploy config
```

See [`docs/API.md`](./docs/API.md) for the full request/response contract.

## Auth flow

```
1. User connects wallet (wagmi)
2. Client → POST /api/auth/nonce?address=0x…  → returns { nonce, message }
3. Wallet signs the message
4. Client → POST /api/auth/wallet-signin       → server verifies sig, mints Firebase custom token
5. Client signInWithCustomToken(token)         → uid = walletAddress.toLowerCase()
6. Firestore rules enforce isSelf(walletAddress) over /wallets/{addr}/**
```

## Mini App / Farcaster

The Mini App manifest is served from `/.well-known/farcaster.json` and the `fc:frame:*` meta tags are set in `app/layout.tsx`. Before listing in the Mini App directory:

1. Generate a signed `accountAssociation` payload at <https://farcaster.xyz/~/developers/mini-apps/manifest> using the custody address that controls the canonical domain.
2. Drop the `header` / `payload` / `signature` into `app/.well-known/farcaster.json/route.ts`.
3. Flip `noindex: true` → `false` once you're ready to be discoverable.

## Scripts

```bash
npm run dev       # next dev (Turbopack)
npm run build     # next build
npm run start     # next start
npm run lint      # eslint
```

Admin-only utilities:

```bash
# Seed the Firestore allowlist from a CSV / env var
npx tsx scripts/seed-allowlist.ts

# List who's currently approved
npx tsx scripts/list-allowlist.ts
```

## Firebase deploy

```bash
# Firestore rules + indexes
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

Rules are in [`firestore.rules`](./firestore.rules). The Admin SDK bypasses all rules — keep it server-side only.

## Testing

There's no automated suite yet. Run the manual happy-path before any release:

```bash
rm -rf .next && npm run dev
```

Then walk through [`docs/E2E-CHECKLIST.md`](./docs/E2E-CHECKLIST.md). Reset state between runs by clearing `localStorage` keys with the `swarm.` prefix.

## The PerkOS stack

PerkOS doesn't run alone. Sister products:

| Repo | What it does |
|---|---|
| [Stack](https://github.com/PerkOS-xyz/Stack) | x402 facilitator, payment verification, agent registry, multi-chain settlement |
| [Spark](https://github.com/PerkOS-xyz/Spark) | No-code single-agent launcher |
| [Aura](https://github.com/PerkOS-xyz/PerkOS-Aura) | 20+ vision / NLP / developer APIs your agents can call |

## Contributing

This repo is in private alpha. If you want to build on PerkOS, reach out:

- General — contact@perkos.xyz
- Partnerships — partner@perkos.xyz
- Investors — invest@perkos.xyz

## License

TBD.
