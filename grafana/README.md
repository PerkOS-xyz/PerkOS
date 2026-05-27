# Grafana dashboards-as-code

Versioned dashboard definitions for the metrics that the PerkOS mini-app emits at `/metrics` (see [`app/lib/metrics.ts`](../app/lib/metrics.ts)).

## Why this exists

Before this folder, Grafana dashboards lived only in whatever Grafana instance an operator clicked together. If the dashboard got accidentally deleted or someone hand-edited it, there was no canonical source to restore from. This folder is the source of truth — `provision.sh` is how it lands in Grafana.

## Layout

```
grafana/
├── README.md                            # you're here
├── provision.sh                         # idempotent uploader (POST → /api/dashboards/db)
├── validate.mjs                         # cheap structural validator (node grafana/validate.mjs)
└── dashboards/
    ├── perkos-platform-overview.json    # high-level lifecycle ops + process health
    └── perkos-curator.json              # focused: tick latency, decisions, hibernations
```

## What each dashboard answers

| Dashboard | Best for |
|---|---|
| **PerkOS — Platform Overview** | "Is anything obviously on fire right now?" — hibernate/wake/upgrade rates, auto-wake outcomes, provisioning rate per runtime, process memory + event-loop lag. |
| **PerkOS — Curator / Hibernation** | "Is the curator doing useful work?" — hibernations done, decision distribution (idle vs skipped), tick-duration heatmap, full funnel timeseries. |

Both are tagged `perkos` so they're easy to filter for in Grafana's dashboard list.

## Validating locally

```bash
node grafana/validate.mjs
```

Catches: JSON parse errors, missing required fields, duplicate panel ids, duplicate dashboard uids across files, and panels whose `expr` doesn't reference any `perkos_*` metric (likely a copy-paste with a dropped prefix).

This is a structural check, not a Grafana schema validation — the latter would require shipping ~600KB of Grafana JSON schemas.

## Provisioning to Grafana

Required env:

```bash
export GRAFANA_URL=https://your-grafana.example.com
export GRAFANA_API_KEY=glsa_xxxxxxxxxxxxxxxxxxxxx  # service-account token, editor on target folder
```

Optional:

```bash
export GRAFANA_FOLDER_UID=perkos-prod    # leave unset to drop into the General folder
export DRY_RUN=1                         # print what would be sent without sending
```

Run:

```bash
./grafana/provision.sh
```

The script is **idempotent**: it sends `overwrite=true`, so re-running updates in place by `uid`. It does **not** prune dashboards that were removed from the folder — that's deliberate so operators can keep experimental boards alongside the versioned ones.

Example output:

```
Uploading perkos-curator.json … ok (200) → /d/perkos-curator/perkos-curator-hibernation
Uploading perkos-platform-overview.json … ok (200) → /d/perkos-platform-overview/perkos-platform-overview
```

## Adding a new dashboard

1. Build the dashboard in Grafana UI until it looks right.
2. Export with **"Export for sharing externally"** so the datasource becomes the `${DS_PROMETHEUS}` template input.
3. Drop the file in `grafana/dashboards/`.
4. Set a stable `uid` field that won't change across exports (Grafana auto-generates one — replace it with `perkos-<descriptive-name>`).
5. Run `node grafana/validate.mjs`.
6. Run `./grafana/provision.sh` to ship it.
7. Open a PR. The PR description should explain what question the dashboard answers, not just what it shows.

## Changing an existing dashboard

Edit in the UI, export again, replace the file. Keep the `uid` stable so the existing dashboard updates in place instead of duplicating.

## What's NOT covered yet (intentional)

| Out of scope | Where it would live |
|---|---|
| Knowledge stack metrics (lifecycle sweep, ingest rate, reembed throughput) | [PerkOS-xyz/knowledge](https://github.com/PerkOS-xyz/knowledge) — separate process, its own `/metrics`, separate dashboard file once that service exposes Prometheus output. |
| LLM gateway tokens per wallet | [PerkOS-xyz/PerkOS-LLM](https://github.com/PerkOS-xyz/PerkOS-LLM) — would need its own instrumentation + dashboard. |
| ECS fleet snapshot (running vs stopped count) | Not Prometheus-friendly without a state-fetching exporter. The right answer is probably a panel that queries `describe-services` via a separate Grafana datasource (Infinity / JSON-API), not via Prometheus. |

When those metrics become available, drop a new dashboard JSON in this folder; `provision.sh` picks it up automatically.
