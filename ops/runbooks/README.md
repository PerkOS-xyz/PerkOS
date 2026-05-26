# PerkOS — Operational runbooks

The docs an operator reaches for when something is wrong, or when
something needs to be rotated / restored / changed on a schedule.

| Doc | When to read it |
|---|---|
| [`SECRETS.md`](SECRETS.md) | Rotating a credential, or after a leak. Inventory of every secret + per-secret rotation procedure. |
| [`DR.md`](DR.md) | Something is on fire. First-30-minutes checklist + scenario-specific recovery procedures (VPS down, Firestore corruption, ECS outage, snapshot restore failure, curator misfire, …). |
| [`scripts/firestore-export.sh`](scripts/firestore-export.sh) | Daily Firestore backup. Cron this on the VPS — the export is what `DR.md` restores from. |

## Adjacent runbooks (live elsewhere in this repo)

- [`ops/aws/hibernation/bootstrap.sh`](../aws/hibernation/bootstrap.sh) — idempotent AWS substrate setup (S3 + KMS + IAM) for agent hibernation.
- [`ops/aws/hibernation/teardown.sh`](../aws/hibernation/teardown.sh) — nuclear cleanup (prod guardrail).
- [`ops/observability/README.md`](../observability/README.md) — Prometheus metrics catalogue + Grafana Cloud setup.
- [`ops/observability/alloy.example.river`](../observability/alloy.example.river) — copy-pasteable scraper config.

## Adjacent runbooks (live in other PerkOS repos)

- [`PerkOS-Platform-Tools-API/SECRETS.md`](https://github.com/PerkOS-xyz/PerkOS-Platform-Tools-API/blob/main/SECRETS.md) — rotation for the tools-api's HMAC + Firebase keys.
- [`PerkOS-Platform-Tools-API/DEPLOY.md`](https://github.com/PerkOS-xyz/PerkOS-Platform-Tools-API/blob/main/DEPLOY.md) — VPS deploy walkthrough.
- `Perkos-Containers/deploy/perkos-assistant/DEPLOY.md` — Hermes runtime image deploy on the LLM gateway VPS.

## Conventions

- **One source of truth.** When something operational changes (new env var, new dependency, changed rotation cadence), update the relevant runbook in the **same commit** as the code change. Stale runbooks are worse than missing ones.
- **Scenario-organized, not component-organized.** During an incident you know the symptom, not the cause. `DR.md` is laid out that way on purpose.
- **Show the exact commands.** Operators copy-paste at 2am. "Run the export script" loses to a literal command block.
