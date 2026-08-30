# PerkOS App Development environment

**Status:** Approved and partially provisioned  
**Date:** 2026-08-29

## Decision

PerkOS App Development is isolated from production at every stateful boundary.
The `development` branch deploys to `dev.perkos.xyz`, uses the dedicated Firebase
project `perkos-app-dev`, calls `dev.api.perkos.xyz`, and redirects hosted payment
sessions to `test.pay.perkos.xyz`.

## Environment map

| Boundary | Development | Production |
|---|---|---|
| Git branch | `development` | `main` |
| App | `dev.perkos.xyz` | `perkos.xyz` |
| API and ledger | `dev.api.perkos.xyz` | production API |
| Firebase | `perkos-app-dev` | `perkos-app` |
| Payments | `test.pay.perkos.xyz` | `pay.perkos.xyz` |
| Stripe | Test Mode | Live Mode |
| Crypto | Stack testnets | approved mainnets |

`test.api.perkos.xyz` is intentionally not used. A shared test API would couple
Development and future QA data. QA should receive `qa.api.perkos.xyz` and its own
database when that stage is introduced.

## Firebase boundary

Development has a separate Firebase project and Web App registration. Firestore,
Authentication, Storage, authorized domains, indexes, and rules must be enabled
inside that project. The browser Firebase identifiers may be committed as a
template; Admin SDK credentials must be injected from the deployment secret store.

The aliases in `.firebaserc` require explicit targets:

```bash
firebase deploy --only firestore:rules,firestore:indexes --project dev
firebase deploy --only storage --project dev
```

Production deployments must always specify `--project prod`. No development
runtime may receive a production Firebase Admin key.

Provisioning completed on 2026-08-29:

- Firebase project `perkos-app-dev` (project number `859889415321`);
- Web App `1:859889415321:web:26484d337a2c2de9d1b408`;
- Firestore Native `(default)` in `nam7`;
- the repository's Firestore rules and indexes deployed successfully;
- Firebase Authentication initialized with `localhost`, `dev.perkos.xyz`,
  `perkos-app-dev.firebaseapp.com`, and `perkos-app-dev.web.app` authorized.

Cloud Storage is not yet provisioned. Firebase now requires new default Storage
buckets to use the Blaze plan. Enabling billing is a separate financial action;
after it is approved, create `perkos-app-dev.firebasestorage.app` and deploy
`storage.rules`. Provider-specific Auth settings remain to be configured before
sign-in testing. No production users were copied. PerkOS wallet authentication
uses Firebase custom tokens, so Development also needs the Development API's
Admin SDK identity before end-to-end sign-in can work.

## API and payment boundary

The App's current card top-up flow calls the platform API directly. Migration to
PerkOS Pay requires a server-created, short-lived billing session before browser
redirection. The session must bind the authenticated principal, billing account,
`development` environment, allowed return URL, nonce, and expiry. Merely changing
the browser URL would be insecure and is therefore deferred until the Development
API implements that contract.

`test.pay.perkos.xyz` must accept only non-live Stripe objects and testnet payment
capabilities. Its verified webhook or settlement event credits only the Development
ledger at `dev.api.perkos.xyz`; it must never call the production ledger.

### API readiness analysis

The current PerkOS API deployment is production-specific and must not simply be
cloned with its existing `.env`:

- Docker Compose fixes production container names and shares the production proxy
  network;
- Firebase is selected by Admin credentials, so Dev needs its own service identity;
- CORS must allow `https://dev.perkos.xyz` but not wildcard origins;
- Stripe keys and webhook secrets are read directly from environment variables and
  currently have no immutable environment assertion;
- x402 defaults to `https://stack.perkos.xyz`, a production-facing default;
- Celo defaults to mainnet and AWS defaults to the production `perkos` ECS cluster;
- Chat, Transport, LLM, Privy, treasury wallets, KMS keys, and workers can all mutate
  external state and therefore need explicit Dev resources or must remain disabled.

Before deployment, PerkOS API needs an explicit `PERKOS_ENVIRONMENT` value, a
Development-specific Compose project and container names, fail-closed testnet
payment configuration, and separate Firebase/AWS/Privy/service credentials. Workers
that lack isolated downstream resources should not start in the first Dev release.

## Deployment order

1. Provision Firebase Dev services, Auth providers, rules, indexes, and secrets.
2. Deploy an isolated PerkOS API/ledger and expose `dev.api.perkos.xyz`.
3. Configure `test.pay.perkos.xyz` with the Development API audience and webhook.
4. Deploy `development` to `dev.perkos.xyz` with `.env.dev` values supplied by CI.
5. Run authentication, Firestore rules, card webhook idempotency, crypto testnet,
   refund, replay, CORS, redirect allowlist, and production-isolation tests.

## Promotion gates

- Development contains no production Firebase, Stripe, treasury, or Admin secrets.
- A test payment credits exactly one Development ledger entry.
- Replayed webhooks and transactions do not duplicate credit.
- Return URLs are server allowlisted to Development origins.
- Firestore and Storage rules pass emulator and integration tests.
- Production is unreachable from Development credentials and service identities.
- QA is added as a distinct environment instead of reusing Development state.
