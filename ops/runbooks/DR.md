# PerkOS — Disaster Recovery runbook

What to do when something is on fire. Organized by symptom, not by
component — when you're triaging at 2am you don't know which
component yet.

## First 30 minutes — incident checklist

Do these IN ORDER. Resist the urge to debug before doing them.

1. **Confirm the impact, not the cause.** Hit the public surfaces:
   ```bash
   curl -sw "%{http_code}\n" -o /dev/null https://app.perkos.xyz/
   curl -sw "%{http_code}\n" -o /dev/null https://admin.perkos.xyz/
   curl -sw "%{http_code}\n" -o /dev/null https://chat.perkos.xyz/health
   curl -sw "%{http_code}\n" -o /dev/null https://api.llm.perkos.xyz/health
   ```
   Anything ≠ 200 is part of the incident. Write down WHICH.
2. **Open a timeline doc** (Slack thread, Notes file, anywhere). Each
   subsequent action gets an entry: timestamp, what you did, what
   happened. This is how you write the post-mortem and avoid
   repeating yourself.
3. **Check Grafana Cloud** for the obvious. Spike in error counter?
   Event-loop lag through the roof? Provisioning success rate at 0?
   The dashboards exist to save you from `docker logs` archaeology.
4. **Snapshot the state.** Before you change anything, run:
   ```bash
   ssh -i ~/.ssh/perkos-cloud-02-hetzner root@62.238.28.49 \
     'docker ps -a; docker inspect perkos-miniapp perkos-miniapp-worker perkos-miniapp-curator perkos-admin'
   ```
   Save the output. If you fix-then-investigate, you'll wish you
   had this.
5. **Decide: containment or full recovery?**
   - If the platform is degraded but users can still hibernate / use
     existing agents, the right move is usually to fail closed on
     the broken part and triage calmly.
   - If users are losing data or being charged for broken services,
     stop the bleeding first.

---

## Scenario: VPS (Hetzner `62.238.28.49`) is unreachable

This kills both `app.perkos.xyz` and `admin.perkos.xyz` (they share
the box).

1. **Check Hetzner Console** — is the VPS up / running / responsive
   to console? If not, this is provider-side; ride out the outage
   and post a status note.
2. **If the VPS is up but unreachable**: probably the Caddy proxy
   container died. SSH via Hetzner web console, run
   `docker ps`, look for `perkos-knowledge-proxy`. If absent,
   `cd /opt/perkos-knowledge && docker compose up -d`.
3. **If the VPS is genuinely dead**: stand up a new Hetzner box,
   restore from the most recent **Firestore export** (see Scenario
   below) — almost all platform state lives in Firestore, so a fresh
   VPS + a fresh deploy + a restored Firestore is recoverable.

### What's NOT recoverable from a Firestore restore alone

- The **PerkOS Assistant's** conversation history (lives in the
  Hermes container on the LLM gateway VPS at `46.225.62.30`, NOT
  on the app VPS) — covered separately.
- **User-launched agents' conversation history** — lives on each
  agent's ECS task's ephemeral disk + the hibernation snapshot in
  S3. If the agent has been hibernated at least once, the snapshot
  is the recovery point. If never hibernated, the data was
  ephemeral and is gone — same trade-off the user accepted when
  they launched.

---

## Scenario: Firestore outage / data corruption

**Outage:** Google's status page is the truth. There's almost
nothing we can do but wait. The miniapp's `/ready` probe will
flip to 503 within seconds; let Caddy serve a maintenance page if
you want to avoid the bare 500.

**Data corruption (a bad write deleted / overwrote real data):**

1. **Stop the writer.** Whatever process is corrupting Firestore
   needs to be down before you restore — otherwise you'll restore
   and immediately corrupt again. Typical culprits:
   - A misbehaving worker (`docker stop perkos-miniapp-worker`)
   - A bad migration script
   - The curator in live mode with a too-aggressive threshold
2. **Identify the affected collection** + the point-in-time the
   corruption started. Firestore exports are full-collection
   snapshots; you'll restore the latest export PRIOR to the
   corruption.
3. **Run the import** (Firestore native restore):
   ```bash
   gcloud firestore import \
     gs://perkos-firestore-backups/<YYYYMMDD-HHMM>/ \
     --collection-ids=<the-affected-collection> \
     --project=perkos-app
   ```
4. **Diff** what was in production vs. what just got restored.
   Communicate the loss window honestly to affected users.

See `scripts/firestore-export.sh` for the backup procedure that
creates the source for this restore.

---

## Scenario: AWS ECS region outage (us-east-1)

This is the highest-blast-radius infra dependency we have. Every
user-launched agent runs in `us-east-1`.

**While the region is down:**
1. New agent launches will fail at the provisioning step. The job
   gets stuck in `provisioning` and the user sees a spinner. This
   is correct behavior — don't try to "fail through" to a partial
   provision.
2. Running agents continue to work as long as their existing tasks
   stay healthy.
3. Hibernate calls will fail (ECS API down). Wake calls will fail.
4. The curator will log error counts but won't actually hibernate
   anything (and dry-run mode is the default — see Phase 7).

**When the region comes back:**
1. Pending provision jobs are claimed and retried by the worker
   automatically (5-min lease + heartbeat — see
   `app/lib/provisionJobs.ts`).
2. Manually re-try failed deletes / hibernate / wake by retrying
   the action in the UI.
3. Check the `perkos_*_total{result="error"}` counters in Grafana
   Cloud — confirm they drop back to ~0 once the region is healthy.

**If the outage looks multi-day**: we have no multi-region story
yet. Document the cost ($18/mo per running agent × hours of
forced downtime), refund or comp affected paid users when we
have a billing system. Out of scope for this runbook to fix
multi-region.

---

## Scenario: ECR (`089332276762.dkr.ecr.us-east-1.amazonaws.com`) inaccessible

Symptom: agent launches fail at "pulling image" in the ECS task
log. The provisioning job sits in `provisioning` forever.

1. Confirm with `aws ecr describe-images --repository-name perkos-hermes`
2. If ECR is up but the task pull is failing, the execution role
   probably lost `AmazonECSTaskExecutionRolePolicy`. AWS Console →
   IAM → role `perkos-spark-ecs-execution` → attached policies.
3. If the image tags are missing (someone ran a cleanup script that
   ran wide), rebuild + push from the PerkOS-Containers repo:
   ```bash
   cd PerkOS-Containers
   # see .github/workflows/build-push-ecr.yml for the exact build steps
   ```
4. Mark the missing tag as `active: false` in Firestore
   `/runtime_images` so the launch wizard stops offering it until
   it's republished.

---

## Scenario: Hibernation snapshot restore fails (per-agent)

Symptom: an agent was hibernated; on wake, the new task crashes
or starts with an empty `HERMES_HOME`.

1. SSH to the LLM gateway VPS, check container logs:
   ```bash
   docker logs -f <task-container> 2>&1 | grep -iE 'restore|snapshot'
   ```
2. The entrypoint's `restore.sh` emits a JSON status line on
   success or an error string on failure. Look for it.
3. Confirm the snapshot object exists:
   ```bash
   aws s3 ls s3://perkos-agent-snapshots-prod/<wallet>/<name>/
   ```
   You should see `state.tar.gz` (latest) + timestamped history.
4. **If `state.tar.gz` is missing or corrupted**: list the
   timestamped versions and restore from the second-most-recent:
   ```bash
   aws s3 cp \
     s3://perkos-agent-snapshots-prod/<wallet>/<name>/state-<earlier-ts>.tar.gz \
     s3://perkos-agent-snapshots-prod/<wallet>/<name>/state.tar.gz \
     --sse aws:kms
   ```
   Then re-wake the agent.
5. **If every snapshot is missing**: the user lost state. Tell
   them. They'll have to recreate the agent's working memory by
   re-prompting it.

---

## Scenario: A2A bridge can't reach Tools API or LLM gateway

Symptom: agents start, the runtime container is healthy, but tool
calls or LLM calls return errors.

1. Curl the endpoints from inside the runtime container:
   ```bash
   docker exec <runtime-container> curl -sw "%{http_code}\n" \
     -o /dev/null http://perkos-a2a-bridge:5070/healthz
   docker exec <runtime-container> curl -sw "%{http_code}\n" \
     -o /dev/null https://api.llm.perkos.xyz/health
   ```
2. If the bridge is unreachable: check the compose network — both
   containers must be on `perkos-knowledge_default`.
3. If the LLM gateway is unreachable but everything else is fine,
   the gateway VPS is the problem — check `46.225.62.30`.

---

## Scenario: Curator hibernated agents it shouldn't have

The curator's safety rails (allowlist, min-age, max-per-tick) are
designed to prevent this, but if a config mistake slipped through:

1. **Stop the curator immediately**:
   ```bash
   ssh -i ~/.ssh/perkos-cloud-02-hetzner root@62.238.28.49 \
     'docker stop perkos-miniapp-curator'
   ```
2. **Wake the affected agents** via the UI or the API:
   ```bash
   curl -X POST https://app.perkos.xyz/api/agents/<agentId>/wake \
     -H "Authorization: Bearer <user-firebase-token>"
   ```
   You'll need either the user's token (have them do it) or use
   the admin Assistant chat to walk them through it.
3. **Tighten the config** in `/opt/perkos-miniapp/.env`:
   - Raise `PERKOS_CURATOR_IDLE_MINUTES`
   - Add affected agent names to `PERKOS_CURATOR_SKIP_NAMES`
   - Set `PERKOS_CURATOR_DRY_RUN=true` until you've validated the
     new config
4. Restart the curator. Tail the logs for a few ticks. Confirm
   the dry-run decisions match expectations before flipping back
   to live.

---

## Backup procedures (so the restore commands above can actually work)

- **Firestore**: `ops/runbooks/scripts/firestore-export.sh` runs
  `gcloud firestore export` to `gs://perkos-firestore-backups/`.
  Cron it on the VPS for daily 03:00 UTC exports. The script
  retains 30 days locally and forever in GCS (lifecycle policy on
  the bucket).
- **S3 hibernation snapshots**: bucket versioning is ON; the
  lifecycle policy keeps current versions for 365d and non-current
  for 30d (see `ops/aws/hibernation/bootstrap.sh`). No additional
  backup needed.
- **VPS configs** (`/opt/perkos-*/.env` files): NOT in source
  control by design. Keep an encrypted copy in your password
  manager + a printed copy in a safe. Rotation of the secrets
  themselves is in `SECRETS.md`.

---

## Post-incident checklist

Within 48h of resolution:
- Write a 1-page post-mortem (timeline, root cause, what
  prevented faster detection, what we'd change). Even for small
  incidents — the discipline is the point.
- Open issues for every action item.
- If a runbook step was wrong / missing, update **this file** in
  the same PR as the post-mortem. Runbooks rot fast otherwise.
