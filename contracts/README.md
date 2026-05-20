# PerkOS on-chain contracts

This directory holds the Solidity sources for the on-chain surfaces
PerkOS uses. Currently:

| Contract | Purpose |
|---|---|
| `PerkosReceiptAnchor.sol` | One-shot anchor for conversation receipts. Records `(wallet, transcriptHash, blockTimestamp)` per `receiptId`. No fees, no admin, no upgradeability. |

## Build + deploy

The repo intentionally does not bundle Hardhat/Foundry — keep the
miniapp build surface small. To deploy, copy the source into a sibling
Foundry project:

```bash
mkdir -p ../perkos-contracts && cd ../perkos-contracts
forge init --no-commit
cp ../PerkOS-App/Perkos/contracts/PerkosReceiptAnchor.sol src/
forge build
# Deploy to Base mainnet (chainId 8453)
forge create src/PerkosReceiptAnchor.sol:PerkosReceiptAnchor \
  --rpc-url https://mainnet.base.org \
  --account <keystore>
```

Once deployed, set `NEXT_PUBLIC_RECEIPT_ANCHOR_ADDRESS` and
`NEXT_PUBLIC_RECEIPT_ANCHOR_CHAIN_ID` in the miniapp env and the
`Receipt.anchor` field will round-trip naturally.

## TypeScript surface

The frontend helpers (calldata building, event decoding, off-chain
reconciliation) live in [`app/lib/receiptAnchor.ts`](../app/lib/receiptAnchor.ts).
The shipped ABI is the authoritative source — the contract's compiled
ABI must match it exactly for `findAnchoredEvent()` to decode logs.

## Verification flow

Anyone verifying a PerkOS receipt should:

1. **Off-chain signature**: ecrecover the signed manifest, confirm the
   recovered address equals `manifest.walletAddress`.
2. **Transcript integrity**: recompute sha256 over the host agent's
   `messages.jsonl + 0x1E + metadata.json`, confirm it equals
   `manifest.transcriptHash`.
3. **On-chain anchor** (if `receipt.anchor` is set): fetch the tx's
   logs via viem/wagmi, call `findAnchoredEvent()`, then
   `reconcileAnchorEvent()`. Reject anchors that mismatch wallet or
   hash — those are red flags, not innocent races.

Step 1 + 2 are sufficient for trust between parties who can run a
verifier. Step 3 adds an independent existence proof anyone with an
RPC URL can check.

## Privacy

The contract sees only opaque 32-byte hashes. Nothing about
conversation content, participants, or message count is on-chain
unless the caller chose to derive `receiptId` from identifiable
inputs. The default helper (`receiptIdFromManifest`) uses
`keccak256(walletAddress | convId | generatedAt)` — `convId` is
opaque to a chain observer; the wallet address is naturally public.
