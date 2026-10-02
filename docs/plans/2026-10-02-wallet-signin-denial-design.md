# Shared terminal wallet sign-in state

Approved scope: stop repeated login-message signatures after access denial or
signature rejection. No allowlist, credentials, provider configuration, funding,
or Solana activation changes.

## Evidence and decision

The production hook shares only a pending promise. Joining consumers swallow its
rejection without recording denial. Main propagates concurrent errors better,
but a consumer mounted after rejection still starts a new attempt. Two regression
tests reproduce this on main with mock wallets and no authentication service.

Use an account-bound terminal failure in the existing shared coordinator. All
consumers observe the same immutable result, including route remounts and wallet
restoration. Only explicit retry, disconnect, or selecting another account clears
it. Cancellation and obsolete completions cannot create terminal failures.

UI-only error copy would not stop repeated requests. An additional unauthenticated
allowlist preflight would add an API dependency and would not solve concurrency,
so neither replaces the shared state fix.

## Verification and rollout

Test late consumers, full route remount, signature rejection, access denial,
explicit retry, account switching, stale completion and existing logout/commit
serialization. Use synthetic addresses only. Failure state stays in page memory,
not localStorage or the database; a full page reload starts a new login attempt.

App deployment is held until this correction is reviewed and merged. The image
being prepared from the previous main is not the corrected release. Chat/Tools
remain healthy with Solana closed. No real wallet signature is automated.
