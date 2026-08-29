# PerkOS Pay and environment promotion design

**Status:** Approved direction; implementation deferred until the core product is stable
**Date:** 2026-08-29
**Owners:** PerkOS App, PerkOS API, PerkOS Stack

## Summary

PerkOS will centralize customer payments in **PerkOS Pay**. Card is the default
payment method for entrepreneurs and small businesses; stablecoin payments are
a secondary option for the web3 audience. PerkOS Pay is a billing frontend, not
a second identity system or ledger.

The first commercial model is prepaid usage credit. Stripe Checkout accepts
card payments and PerkOS Stack settles supported stablecoin payments. Both rails
credit the same USD-denominated account in PerkOS API. A later Business
subscription may bundle recurring benefits and monthly credits without replacing
usage billing.

Production uses `pay.perkos.xyz`. Non-production payments use
`test.pay.perkos.xyz` with Stripe Test Mode and Stack-supported testnet networks.
Application environments progress through `dev.perkos.xyz`, `qa.perkos.xyz`, and
`perkos.xyz`.

## Goals

- Give a conventional small-business buyer a simple card-first checkout.
- Preserve Base, Celo, and Robinhood stablecoin support for web3 users.
- Maintain one identity mapping, billing account, ledger, and entitlement engine.
- Prevent test payments or test identities from affecting production balances.
- Promote the exact QA-tested artifact to production.
- Make payment processing idempotent, auditable, and reconcilable.

## Non-goals

- Building a separate PerkOS Pay identity provider.
- Making service credits withdrawable or transferable.
- Launching postpaid, unbounded usage billing.
- Enabling a network merely because Stack has RPC infrastructure for it.
- Implementing the environment topology before the product reaches the agreed
  stability threshold.

## Product model

### Initial offer: prepaid usage

Customers buy fixed credit packs, initially `$10`, `$25`, `$50`, `$100`, and
`$250`. PerkOS deducts managed infrastructure and Managed AI usage from a common
USD-denominated balance while retaining distinct usage categories in the ledger.

The payment chooser is ordered as follows:

1. **Pay with card** — primary action through Stripe Checkout.
2. Apple Pay or Google Pay — when available through the Stripe account and
   customer device.
3. **Pay with crypto** — secondary action that expands the currently available
   stablecoin networks.

Auto-recharge is optional, has a customer-selected threshold and amount, and
must include a monthly safety cap. Balance notifications are sent at configurable
thresholds, with defaults of 50%, 20%, and 5%.

### Later offer: Business

A Business subscription may include monthly credits, members, higher limits,
preferential usage rates, and priority support. Subscription state grants those
benefits; the PerkOS ledger continues to meter additional usage. Unused monthly
credits require an explicit expiration or rollover policy before launch.

## System ownership

| Concern | System of record |
|---|---|
| Human and organization identity | PerkOS identity/auth |
| Billing account and entitlements | PerkOS API |
| Credit balance and ledger | PerkOS API |
| Card authorization and collection | Stripe |
| Stablecoin verification and settlement | PerkOS Stack |
| Usage measurement | PerkOS API and the relevant runtime/gateway meters |
| Customer payment UI | PerkOS Pay |
| Internal financial reporting | PerkOS Admin |

Neither a browser success page nor a client callback can credit a balance.
Stripe credit occurs only after a verified webhook confirms collected funds.
Crypto credit occurs only after Stack returns a successful settlement with a
valid payer, network, asset, amount, and transaction identifier.

## Environment topology

| Stage | App origin | Payment origin | Stripe | Crypto | Data |
|---|---|---|---|---|---|
| Local | `localhost` | local or `test.pay` | Test Mode | Stack testnet sandbox | local/dev |
| Development | `dev.perkos.xyz` | `test.pay.perkos.xyz` | Test Mode | supported testnets | isolated dev |
| QA | `qa.perkos.xyz` | `test.pay.perkos.xyz` | Test Mode | supported testnets | isolated QA |
| Production | `perkos.xyz` | `pay.perkos.xyz` | Live Mode | approved mainnets | production |

Development and QA may share the `test.pay` hostname, but not mutable payment
state. Every billing session and record carries an immutable `environment`
claim. Webhooks route to environment-specific endpoints and secrets. Stripe
objects include environment metadata, and PerkOS rejects an object whose
`livemode` value does not match the target environment.

Preferred separation:

- distinct Firebase/database projects for development, QA, and production;
- distinct Stripe webhook endpoints and signing secrets;
- distinct PerkOS billing accounts and ledger namespaces;
- distinct crypto treasury/sponsor wallets for testnet and mainnet;
- environment-specific OAuth clients, session keys, and allowlisted origins;
- no production secret available to a development or QA runtime.

## Billing session and redirect flow

1. The authenticated user selects Billing or Add credits in a PerkOS product.
2. The product requests a one-time billing session from PerkOS API.
3. The session binds user, billing account, organization, environment, source
   product, allowed return URL, nonce, and short expiration.
4. The browser is redirected to the matching PerkOS Pay origin.
5. PerkOS Pay exchanges the one-time token for its own short-lived session.
6. The customer selects a credit pack and payment rail.
7. Stripe or Stack processes the payment.
8. A trusted server event writes an idempotent ledger credit.
9. PerkOS Pay displays confirmed or pending state and returns the customer to the
   allowlisted source URL.

Return URLs are selected server-side from an environment allowlist. The client
cannot supply an arbitrary redirect target. A token minted for `dev` or `qa`
cannot be exchanged at the production payment origin.

## Card flow

- PerkOS API creates the Stripe Checkout Session using server-owned price data.
- The browser cannot choose an arbitrary credited amount.
- Stripe Customer IDs map to PerkOS billing accounts, not solely to wallets.
- The signed Stripe webhook is the authority for payment completion.
- Delayed payment methods remain pending until their success event arrives.
- The ledger idempotency key includes environment, provider, and Stripe event or
  Checkout Session identifier.
- Refunds and disputes produce compensating ledger entries; history is never
  rewritten.

Stripe Customer Portal may later manage payment methods, invoices, receipts, and
subscription changes. PerkOS Pay remains responsible for product-specific usage,
credit balance, and entitlements.

## Crypto flow and capability discovery

Production currently targets:

- USDC on Base;
- USDC on Celo;
- USDG on Robinhood Chain.

USDT on Celo is a candidate rail. Its canonical token and Celo fee-currency
support do not by themselves prove EIP-3009 compatibility. It must pass live
contract-interface, EIP-712 domain, facilitator verify, settlement, replay, and
idempotency tests before appearing as x402-compatible. A verified direct-transfer
deposit can be used as a separate scheme if EIP-3009 is unavailable.

`stack.perkos.xyz` already supports testnet networks. PerkOS Pay must nevertheless
use Stack capability discovery rather than a hard-coded network list. A payment
option is shown only when the selected environment reports a complete tuple:

`scheme + CAIP-2 network + canonical asset + decimals + domain metadata + payTo`

and the configured facilitator can both verify and settle it. This handles the
current difference between infrastructure-level network support and stablecoin
payment readiness, particularly across evolving Celo testnets.

Testnet assets have no production credit value. Non-production payments only
credit the matching non-production ledger.

## Ledger requirements

Every financial entry includes:

- immutable entry ID and idempotency key;
- environment and billing account ID;
- type: payment, usage debit, promotional credit, refund, dispute, or adjustment;
- amount in internal USD units;
- original currency, amount, chain/network, and asset when applicable;
- provider and provider event/transaction identifier;
- related Stripe Customer/Session or crypto payer/transaction;
- product, organization, and usage category;
- creation time and effective time;
- reversal relationship for compensating entries.

Balances are derived transactionally from ledger operations. Admin adjustments
require authorization, a reason, and an audit event.

## Source control and promotion

`devnet` is an integration branch and deploys to `dev.perkos.xyz`. It must not
become a permanently divergent product line.

The promotion path is:

```text
feature branch
      -> devnet -> dev.perkos.xyz
      -> immutable release candidate -> qa.perkos.xyz
      -> the same tested commit/artifact -> main -> production
```

QA tests the exact commit and preferably the exact immutable container/build
artifact intended for production. A fix found in QA returns through source
control and creates a new release candidate. Nothing is patched only in the QA
deployment.

Production deployment requires explicit approval. Database or ledger migrations
must be backward compatible across the rollout window and have a rehearsed
rollback or forward-fix procedure.

## Release gates

Before promotion from QA to production:

- typecheck, lint, unit, integration, and production build pass;
- Stripe test Checkout succeeds and the signed webhook credits exactly once;
- duplicate, reordered, delayed, invalid-signature, refund, and dispute events
  behave correctly;
- every advertised testnet crypto rail verifies and settles;
- duplicate settlement cannot produce duplicate credit;
- wrong payer, asset, network, amount, or environment is rejected;
- return URL and cross-environment session attacks are rejected;
- usage debits, low-balance alerts, zero-balance pause, and top-up recovery pass;
- ledger-to-Stripe and ledger-to-chain reconciliation reports balance;
- secrets and treasury addresses are verified for the target environment;
- monitoring, alerting, and rollback procedures are operational.

## Error handling

Payment UI distinguishes `created`, `awaiting_payment`, `processing`, `settled`,
`credited`, `failed`, `expired`, `refunded`, and `disputed`. A timeout never means
failure if the provider may still complete asynchronously. The customer can
refresh status using the server-side payment identifier without creating another
charge.

When Stack capability discovery or a network is unhealthy, that crypto option is
hidden or marked unavailable; card checkout remains available. A degraded Stripe
rail does not prevent an already-supported crypto payment, and vice versa.

## Rollout sequence

1. Stabilize the existing PerkOS product and billing ledger.
2. Launch production PerkOS Pay with card-first prepaid credits.
3. Add approved Base, Celo, and Robinhood production rails.
4. Add reconciliation, refunds/disputes, alerts, and optional auto-recharge.
5. Introduce `test.pay`, isolated development/QA data, and environment-bound
   sessions.
6. Establish `devnet` integration and immutable QA-to-production promotion.
7. Evaluate Business subscriptions using real usage, conversion, ARPU, churn,
   and willingness-to-pay data.

## Deferred decisions

- Final Business subscription price and included monthly credits.
- Expiration or rollover policy for subscription credits.
- Whether development and QA receive separate Stripe test accounts or remain
  isolated through endpoints, metadata, and PerkOS namespaces.
- Final Celo testnet selection as Stack configuration evolves.
- USDT-on-Celo settlement scheme after contract and facilitator verification.
