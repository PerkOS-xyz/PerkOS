# Agent ownership boundary

## Scope

AP02 of the approved public-launch audit. Base: merged dependency-security main.
The current browser edits agent profiles through the authenticated API, not
direct Firestore writes. Preserve workspace, profile and project edits.

## Decision

Make the entire wallet agent subtree client read-only. A field denylist alone
would leave future operational fields writable. Client presentation edits are
not required here because PATCH /agents already validates an explicit schema.
Creation, deletion, team changes and lifecycle actions remain API-owned.

Exclude agents from the additive workspace wildcard. Deny direct create,
update, delete and nested writes for both EVM and exact-case Solana owners.
Continue owner reads/listeners; never expose the global credential registry.

Pair with the API registry ownership guard. Rules alone do not validate old
records or internal workers. No new heartbeat authorization/database loop.

## Verification and release

Local demo-only Firestore tests: owner reads; forged own mirrors, identity,
runtime, resource and payment fields, nested records and cross-tenant writes
denied. Existing projects/profiles and template protection remain usable.
Unit/type/build regression as applicable. No live migration, rules deployment,
agent activation, public registration or payment activation in this change.
Deploy both API guards and rules together after review and staging acceptance.
