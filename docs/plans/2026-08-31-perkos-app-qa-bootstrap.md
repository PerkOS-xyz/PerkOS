# PerkOS App QA bootstrap

**Status:** Configuration ready; infrastructure pending authentication  
**Release candidate:** `3106ec9ae2ffa986b5637b1031c279d6f26a9a29`

## Boundaries

| Boundary | QA value |
|---|---|
| Git branch | `qa` (protected) |
| App | `qa.perkos.xyz` |
| API | `qa.api.perkos.xyz` |
| Chat | `qa.chat.perkos.xyz` |
| Firebase | `perkos-app-qa` |
| Payments | `test.pay.perkos.xyz` / Stripe Test Mode |
| Crypto | testnets only |

QA must never reuse mutable Development state or any Production credential. The
release candidate is promoted from `development` by PR and fixes found in QA go
back through a feature branch; servers are not patched directly.

## Promotion path

`feature/*` → `development` → `qa` → `main`

The `qa` branch requires a pull request, one approving review, resolved
conversations, and disallows deletion and force-push, including for admins.

## Provisioning checklist

- [ ] Authenticate the PerkOS AWS account and record its account ID.
- [ ] Provision isolated QA ECS cluster, task/execution roles, secrets, storage,
      networking, logs, alarms, and least-privilege policies.
- [ ] Create Firebase project `perkos-app-qa`, Web App, Firestore, Auth providers,
      authorized domains, rules, and indexes.
- [ ] Create `qa.api.perkos.xyz`, `qa.chat.perkos.xyz`, and `qa.perkos.xyz` DNS only
      after their actual targets exist.
- [ ] Inject `.env.qa` through the QA secret/deployment system; never commit it.
- [ ] Verify `test.pay.perkos.xyz` sessions are audience-bound to QA and cannot
      credit Development or Production ledgers.
- [ ] Run authenticated E2E in English and Spanish, including agent lifecycle,
      project/task completion, hibernation, billing layout, and mobile screens.
- [ ] Promote the exact QA-tested commit or immutable image digest to `main`.

## Current QA findings

The release-candidate agent detail passed bilingual validation for specialized
voice, credentials, hibernation, and runtime-update surfaces. In Spanish, three
global shell labels still appear in English: `Log out`, the global search prompt,
and `Available now`. Track these as a QA localization defect before Production.

Docker dependency installation also reports deprecated MetaMask, WalletConnect,
UUID, QR, Safe SDK, and Prometheus packages. These warnings are non-blocking for
the bootstrap but require a separately tested dependency-upgrade initiative.
