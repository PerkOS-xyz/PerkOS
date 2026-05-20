# PerkOS on-chain contracts

This directory holds the Solidity sources for the on-chain surfaces
PerkOS uses. Currently:

| Contract | Purpose |
|---|---|
| `PerkosReceiptAnchor.sol` | UUPS-upgradeable anchor for conversation receipts. Records `(wallet, transcriptHash, blockTimestamp)` per `receiptId`. Pausable, owner-authorized upgrades, OpenZeppelin-based. |

## Why upgradeable

The first deployed implementation is a minimal, append-only anchor.
Future versions may add:

- batched anchoring (anchor N receipts in one tx → lower gas/anchor)
- ERC-8004 (Trustless Agents) registry integration
- x402-priced anchoring (USDC fee per anchor)
- expanded event surface for off-chain indexers

UUPS upgradeability lets us evolve the contract without forcing
users to migrate to a new address — every existing
`Receipt.anchor.contractAddress` keeps working.

### Trust posture

Upgradeability is a **real** shift from the original "deploy and
forget" design. The contract `owner` can replace the implementation
under users. To keep that power honest:

- **Owner SHOULD be a Gnosis Safe (multisig)** — not an EOA.
  Optionally fronted by an OZ timelock so upgrades have a public
  delay before they take effect.
- The contract emits `UpgradeAuthorized(newImpl, msg.sender)` on
  every upgrade so off-chain indexers and watchdogs can react.
- `pause()` / `unpause()` is also owner-only, but pausing only halts
  new `anchor()` calls — existing records stay readable.

## Setup (Foundry)

The repo doesn't bundle Foundry to keep the miniapp build surface
small. Use a sibling project:

```bash
mkdir -p ../perkos-contracts && cd ../perkos-contracts
forge init --no-commit
forge install OpenZeppelin/openzeppelin-contracts-upgradeable@v5.0.2 --no-commit
forge install OpenZeppelin/openzeppelin-foundry-upgrades --no-commit
cp ../PerkOS-App/Perkos/contracts/PerkosReceiptAnchor.sol src/
cp ../PerkOS-App/Perkos/contracts/script/Deploy.s.sol script/
cp ../PerkOS-App/Perkos/contracts/test/PerkosReceiptAnchor.t.sol test/
```

Add to `foundry.toml`:

```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
remappings = [
  "@openzeppelin/contracts-upgradeable/=lib/openzeppelin-contracts-upgradeable/contracts/",
  "@openzeppelin/contracts/=lib/openzeppelin-contracts-upgradeable/lib/openzeppelin-contracts/contracts/",
]
ffi = true
fs_permissions = [{ access = "read", path = "./" }]
```

Then:

```bash
forge build
forge test -vvv
```

## Deploy

### Base Sepolia (recommended first)

```bash
export SAFE_OWNER=0xYourGnosisSafe       # or a timelock contract
export RPC_URL=https://sepolia.base.org
export DEPLOYER_KEY=<keystore-or-private-key>

forge script script/Deploy.s.sol:Deploy \
  --rpc-url $RPC_URL \
  --broadcast \
  --verify \
  --etherscan-api-key $BASESCAN_API_KEY \
  --sig 'run(address)' $SAFE_OWNER
```

The deploy script:

1. Deploys the implementation contract.
2. Deploys an `ERC1967Proxy` pointing at it.
3. Calls `initialize(SAFE_OWNER)` through the proxy.
4. Logs both addresses — record the **proxy address** as
   `NEXT_PUBLIC_RECEIPT_ANCHOR_ADDRESS`. That's the user-facing
   address that survives upgrades.

### Base mainnet

Same command, swap `--rpc-url https://mainnet.base.org` and
`chainId 8453`. Confirm the Sepolia deploy works end-to-end (anchor
+ verify + decoded event) before going to mainnet.

## Upgrading

Once a v2 implementation is ready, deploy only the new
implementation, then have the owner call:

```solidity
PerkosReceiptAnchor(proxyAddress).upgradeToAndCall(newImplAddress, "");
```

through whatever multisig flow you set up. The `UpgradeAuthorized`
event lets watchdogs alert on upgrades.

OpenZeppelin Upgrades plugin can also handle this end-to-end:

```bash
forge script script/Upgrade.s.sol --rpc-url $RPC_URL --broadcast
```

Run `forge clean && forge build` first so the storage-layout check
has fresh artifacts.

## Wire it into the miniapp

After Sepolia / mainnet deploy:

```bash
# .env.local
NEXT_PUBLIC_RECEIPT_ANCHOR_ADDRESS=0x...     # proxy address
NEXT_PUBLIC_RECEIPT_ANCHOR_CHAIN_ID=84532    # 8453 for mainnet
```

The frontend helpers in
[`app/lib/receiptAnchor.ts`](../app/lib/receiptAnchor.ts) already
support these env vars. No code change is needed.

## Verification flow (anyone)

A third-party verifying a PerkOS receipt should:

1. **Off-chain signature**: ecrecover the signed manifest, confirm
   the recovered address equals `manifest.walletAddress`.
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
Callers wanting maximum privacy can supply their own random
`receiptId` and keep the mapping off-chain.
