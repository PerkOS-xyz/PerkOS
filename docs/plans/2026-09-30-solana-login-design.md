# Independent Solana wallet login

## Approved product boundary

The user approved independent Solana accounts for the first release. Existing EVM
accounts, Google/email login, Mini App connectors and sponsorship decisions stay
unchanged. No token gating, account merging, wallet delegation or gas sponsorship.

## Design

Dynamic connects EVM or Solana browser wallets. PerkOS continues to authenticate
ownership with a server-issued challenge and Firebase custom tokens. EVM UIDs
remain lowercase hex addresses; Solana UIDs retain their canonical base58 case.
The chain is explicit in Solana challenges and token claims. Ed25519 verification
is local and does not require an RPC request or an on-chain transaction. Consume
the nonce transactionally before issuing a token. Expired, malformed, wrong-chain
and replayed challenges fail closed.

We chose independent accounts over linking wallets because automatic linking can
cross workspace boundaries; explicit linking with proofs from both wallets is a
separate feature. Replacing all UIDs with Dynamic user IDs would also require a
data migration and is outside this release.

## Rollout gates

Dashboard activation alone is not a release. Introduce disabled-by-default App
and API feature flags until all consumers preserve Solana identity. Audit App,
API, shared schemas, Chat, membership, storage, billing and agent ownership. Do
not widen EVM transaction schemas. Do not globally replace string lowercasing.
Keep existing checkout changes isolated in feature worktrees based on main.

Required tests: real generated Ed25519 signatures; changed message/address;
expired/wrong-chain/replayed and concurrent nonce use; no permission escalation;
case-sensitive identities; unchanged EVM auth and Google UI; wallet switching;
project/profile persistence and chat after reload. Then authenticated Dev, QA and
production smoke, with feature flags enabled only after compatible services ship.

## Current caveats

- The current production build must be reconciled with main before deploying:
  earlier inspection found Privy bundles despite Dynamic code on main.
- dRPC is configured in Dynamic Live but consumption limits and restrictions are
  pending. Never commit its authenticated URL.
- Initial auth implementation is not evidence that the workspace is Solana-ready.
