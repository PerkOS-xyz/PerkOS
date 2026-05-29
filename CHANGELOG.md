# Changelog

PerkOS App (`app.perkos.xyz`). One entry per release dated by deploy day.
Phase numbering tracks `MIGRATION-PLAN-v2.md` in the workspace root.

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
