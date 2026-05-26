# PerkOS — Secret rotation runbook

Every credential the PerkOS platform depends on, who consumes it,
what breaks if it leaks, and how to rotate it.

**General rule:** rotate on a fixed cadence even when nothing looks
wrong. The longer a secret has existed, the more places it has been
copy-pasted into Slack / a notebook / a screen-share.

If a secret is _known_ to be leaked (committed to git, shown in a
recording, sent in a DM), treat it as compromised and rotate
**immediately**, regardless of cadence.

---

## At-a-glance inventory

| Secret | Where it lives | Consumers | Blast radius | Cadence |
|---|---|---|---|---|
| `FIREBASE_PRIVATE_KEY` | miniapp `.env`, admin `.env`, tools-api `.env` | Firebase Admin SDK in every Node process | Full Firestore read/write across all collections | **180d** |
| `A2A_TOOLS_JWT_SECRET` | bridge container env + tools-api `.env` | bridge mints JWTs; tools-api verifies | Anyone with it can call any per-wallet tool as any wallet | **90d** |
| `A2A_BRIDGE_AUTH_SECRET` | bridge container env + Hermes container env | Hermes plugin → bridge token mint endpoint | Same-host process can mint tokens (still bound to active conv) | **180d** |
| `PERKOS_METRICS_TOKEN` | all 3 services + Alloy scraper env | Grafana Agent / Alloy scraper | Read-only metrics — low blast radius | **1y** |
| `PERKOS_LLM_ADMIN_TOKEN` | miniapp `.env` + LLM gateway VPS env | provisioner → LLM gateway to mint per-agent keys | Can mint LLM keys for any agent name | **180d** |
| `ANTHROPIC_API_KEY` | admin `.env` | admin Assistant chat route | Billable Anthropic calls; cost only, no platform write | **1y** or on-leak |
| `OPENAI_API_KEY` | miniapp `.env` (optional) | concierge chat fallback | Billable OpenAI calls | **1y** or on-leak |
| AWS access keys (`AWS_ACCESS_KEY`, `AWS_SECRET`) | miniapp + worker `.env` | ECS provision/deprovision, S3 snapshots, IAM | High — full ECS + S3 + Secrets Manager scoped to perkos-* | **90d** |
| `PERKOS_WHITELIST` (env) | miniapp `.env` | bootstrap allowlist before Firestore loads | Bypasses the allowlist gate for listed wallets | n/a — change on intent, not cadence |
| `PERKOS_SUPER_ADMINS` (env, admin) | admin `.env` | bootstrap super-admin gate | Full admin console + Assistant chat for listed wallets | n/a — change on intent, not cadence |
| Per-agent `relayApiKey` (`rk_*`) | Firestore `/agents/{name}.relayApiKey` + agent container env | A2A bridge → chat.perkos.xyz + transport.perkos.xyz | One agent's identity on the relay | **automatic** — minted on launch, revoke via delete |
| Per-agent LLM key | Secrets Manager `perkos-agents/{wallet}/{name}/perkos-llm-key` | agent container → LLM gateway | One agent's LLM access | **automatic** — refreshed on each provision |

---

## Rotation procedures

### 1. `FIREBASE_PRIVATE_KEY` (180-day cadence)

**Generate the new key:**
1. Firebase Console → ⚙ Project settings → Service accounts.
2. Generate new private key. Download the JSON.
3. Extract `private_key`, `client_email`, `project_id`. The new key
   coexists with the old one in Firebase — both work until you
   explicitly revoke the old one.

**Roll the consumers:**
1. Update `/opt/perkos-miniapp/.env` on the VPS.
2. Update `/opt/perkos-admin/.env` on the VPS.
3. Update the tools-api `.env` (deploy target — see `PerkOS-Platform-Tools-API/DEPLOY.md`).
4. Bounce each service:
   ```bash
   cd /opt/perkos-miniapp && docker compose -f docker-compose.example.yml up -d --force-recreate
   cd /opt/perkos-admin   && docker compose -f docker-compose.example.yml up -d --force-recreate
   ```
5. Verify each service comes back healthy:
   ```bash
   docker inspect perkos-miniapp --format '{{.State.Health.Status}}'
   docker inspect perkos-admin --format '{{.State.Health.Status}}'
   ```

**Revoke the old key:**
6. Firebase Console → service account → ⋯ → delete the OLD key id.
   Do this last — if step 5 fails, you want the old key still valid
   so a rollback works.

**Verify:**
```bash
curl -sw "%{http_code}\n" -o /dev/null https://app.perkos.xyz/
curl -sw "%{http_code}\n" -o /dev/null https://admin.perkos.xyz/
```

### 2. `A2A_TOOLS_JWT_SECRET` (90-day cadence)

This is the HMAC secret the bridge uses to sign tokens that the
tools-api verifies. A leak lets an attacker forge tools-api calls as
any wallet.

**Dual-secret rolling (zero-downtime, recommended):**
The tools-api supports a comma-separated list of verifier keys. The
bridge always signs with the FIRST one in the list.

1. Generate new secret: `openssl rand -hex 32`.
2. Update tools-api `.env`:
   ```
   JWT_SHARED_SECRET=<new>,<old>
   ```
   Restart tools-api. It now accepts tokens signed by either.
3. Update bridge `.env`:
   ```
   A2A_TOOLS_JWT_SECRET=<new>
   ```
   Restart bridge. It now signs with `<new>`. Any outstanding tokens
   (60s TTL) signed with `<old>` are still valid for at most 60s.
4. After at least 60s (one TTL), update tools-api `.env`:
   ```
   JWT_SHARED_SECRET=<new>
   ```
   Restart tools-api. The old secret is no longer accepted.

**Single-secret cutover (downtime ~60s during step 2):**
For environments without dual-secret support, just swap and bounce
both services within the JWT TTL window. The "no valid token"
window is ~60s.

### 3. `A2A_BRIDGE_AUTH_SECRET` (180-day cadence)

Used by the Hermes plugin to authenticate against the bridge's
local tools-token listener.

1. Generate new secret: `openssl rand -hex 24`.
2. Update both the bridge container env AND the Hermes container env
   to the new value.
3. `docker compose up -d --force-recreate` both containers — they
   must restart together (Hermes plugin won't reconnect on the new
   secret until restart).

### 4. `PERKOS_METRICS_TOKEN` (yearly)

Single token shared across miniapp + workers + Alloy scraper.

1. Generate: `openssl rand -hex 32`.
2. Update `/opt/perkos-miniapp/.env` AND the Alloy container's env
   (or its config file).
3. `docker compose up -d --force-recreate perkos-miniapp perkos-miniapp-worker perkos-miniapp-curator perkos-alloy`
4. Confirm metrics still flowing in Grafana Cloud Explore within
   one scrape interval (~30s).

### 5. AWS access keys (`AWS_ACCESS_KEY` / `AWS_SECRET`) (90-day cadence)

AWS supports two simultaneous access keys per IAM user — perfect
for zero-downtime rotation.

1. AWS Console → IAM → Users → perkos-miniapp-* → Security creds →
   **Create access key** (now you have two).
2. Update `/opt/perkos-miniapp/.env` with the new key+secret.
3. `docker compose up -d --force-recreate perkos-miniapp perkos-miniapp-worker perkos-miniapp-curator`
4. Tail the worker logs for ECS calls — confirm no auth errors:
   ```bash
   docker logs -f perkos-miniapp-worker | grep -iE 'auth|denied|invalid'
   ```
5. AWS Console → IAM → mark the OLD key **Inactive** (not deleted).
   Wait 24h. If no alarms, delete it.

### 6. `PERKOS_LLM_ADMIN_TOKEN` (180-day cadence)

The provisioner uses this to mint per-agent LLM keys against
api.llm.perkos.xyz.

1. SSH to the LLM gateway VPS: `ssh -i ~/.ssh/perkos-cloud-agents-hetzner …`
2. Generate new admin token, append to gateway's allowed-admin list
   in `/opt/Perkos-llm/.env` (keep the old one so we can roll).
3. Restart the gateway: `docker compose restart`
4. Update `/opt/perkos-miniapp/.env` with the new token.
5. Recreate miniapp + worker.
6. Provision a test agent end-to-end — confirm the LLM key mint
   step succeeds.
7. Remove the old admin token from the gateway env. Restart gateway.

### 7. `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` (yearly)

Provider-managed. Generate a new one in the provider console,
update the relevant `.env`, recreate the service, then revoke the
old one in the provider console.

### 8. Per-agent secrets (no manual rotation)

Per-agent `relayApiKey` and per-agent LLM key are minted at
provisioning time. To rotate, **re-provision the agent** — the
existing provision job idempotently overwrites both. The user-
facing way is the **Edit agent** → save flow in the miniapp.

---

## Incident: a secret leaked

1. **Rotate immediately** using the procedure above, even if it
   means downtime during the cutover.
2. **Search git history** for the leaked value:
   ```bash
   git log --all -S '<the-leaked-substring>'
   ```
3. **If found in git**: the secret is on every clone of the repo
   forever — rotate the secret, then optionally rewrite history
   with `git filter-repo` (not `filter-branch`).
4. **Audit access logs** for the time window before rotation:
   - Firebase Console → service account → activity
   - AWS CloudTrail → events filtered by user
   - Anthropic / OpenAI console → usage by key
5. **Notify** anyone whose data might have been touched. Default
   to over-disclosing.

---

## Where the inventory lives

This file is the source of truth. When a new secret is added to
the platform, the PR that introduces it MUST update this table
in the same commit. Otherwise it gets forgotten and never
rotates.
