# Public launch dependency security, AP01

## Scope and decision

The public launch audit is approved for implementation. This first slice updates
the dependencies of the existing production candidate, without opening signup,
changing access grants, enabling payments, or modifying customer data. Main and
Development have diverged; the patch is based on Main and must be exercised in
Dev before a production rollout. Existing local edits are preserved.

Prefer compatible security updates and a refreshed lockfile over a major SDK
migration or `npm audit fix --force`. Keep all Dynamic packages on the same v4
release and Next with its matching ESLint configuration. React stays unchanged.
Retain CDP SDK 1.51.0, the previous production resolution, while refreshing other
compatible dependencies. CDP 1.58.0 adds optional x402 peer imports that Next
eagerly resolves, breaking the existing browser wallet build. Do not activate a
new payment stack to resolve that unrelated packaging issue.
The shadcn CLI/CSS is a build dependency: the compiled CSS still ships, but its
CLI dependencies should not be in the production dependency set.

## Verification and remaining gates

Re-audit production dependencies and report unresolved advisories explicitly.
Run the existing tests, typecheck and production build with synthetic public
configuration. Add lockfile regression checks for patched packages. Login tests
are not a substitute for browser acceptance of EVM, Solana and Google in Dev.
CI/container checks must confirm the actual standalone output.

Agent ownership, suspension/revocation, BYOK, fulfillment, quotas and launch
policy remain separate audit blocks. This change does not certify public launch.

## Local verification, 2026-10-10 UTC

- Production audit: 0 critical, 4 high, 59 moderate. The four high package nodes
  are the single unpatched `bigint-buffer` advisory and its Solana SDK parents.
  Public launch is still gated on resolving or formally mitigating that chain.
- Full regression: 912 passing tests, 26 skipped; Firestore/Storage demo emulator:
  33 passing tests. Typecheck and the synthetic production build pass.
- Full lint reports 49 errors in untouched application/test files. This patch
  does not suppress those rules or claim that the entire lint gate is green.
- Docker is not running locally. The existing production-container CI job must
  validate the actual image. Browser wallet/Google acceptance remains pending.
- Lockfiles refresh compatible ranges, not only direct dependencies. Overrides
  cover nested axios/ws/sharp and old gRPC pins; ws v7 stays on its own major.
  Shared Types keeps the same reviewed commit over HTTPS.
- Local standalone smoke: home and sign-in return HTTP 200. This is not a real
  wallet or Google authentication test; no credentials were used.
- Follow-up: the existing runtime Docker stage still installs worker dependencies
  outside the application lockfile. Review and audit the final image and make that
  worker layer reproducible before calling AP01 fully closed.
