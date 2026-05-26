# Observability — Prometheus + Grafana Cloud

PerkOS exposes Prometheus-format metrics from every Node process. A
single Grafana Agent (Alloy) container co-located with the app
scrapes them and remote-writes to **Grafana Cloud free tier**.

## What's emitted

Each process exposes both:

1. **Default process metrics** (CPU seconds, RSS, event-loop lag, GC,
   open handles) — `perkos_process_*` and `perkos_nodejs_*`.
2. **Business metrics** — defined in `app/lib/metrics.ts`:

| Metric | Type | Labels | Where it fires |
|---|---|---|---|
| `perkos_hibernate_total` | counter | `result={success,noop,error,not-found}` | Manual hibernate + curator hibernate |
| `perkos_wake_total` | counter | `result` | Manual wake button |
| `perkos_upgrade_total` | counter | `result={success,bad-input,same-version,tag-inactive,tag-not-found,service-not-found,drain-timeout,error}` | Runtime upgrade flow |
| `perkos_curator_tick_duration_seconds` | histogram | `dryRun={true,false}` | Once per curator tick |
| `perkos_curator_decision_total` | counter | `reason` (8 values) | Once per agent per tick |
| `perkos_curator_hibernations_total` | counter | `result={success,error,resolve-error,agent-id-missing}` | Live-mode curator only |
| `perkos_agent_provisioned_total` | counter | `runtime={Hermes,OpenClaw}, result={success,error}` | Every completed provisioning job |

## Endpoints

| Process | URL | Port |
|---|---|---|
| `miniapp` (Next.js) | `http://perkos-miniapp:3000/api/metrics` | 3000 (via Next) |
| `miniapp-worker` (provisioner) | `http://perkos-miniapp-worker:9101/metrics` | `PROVISIONER_METRICS_PORT` (default 9101) |
| `miniapp-curator` | `http://perkos-miniapp-curator:9102/metrics` | `CURATOR_METRICS_PORT` (default 9102) |

All require `Authorization: Bearer ${PERKOS_METRICS_TOKEN}`. Without
the token set on the server, the endpoints return **503**, not an
empty body — we never expose metrics anonymously.

## Generating a token

```bash
openssl rand -hex 32
```

Set on the VPS in `/opt/perkos-miniapp/.env`:
```
PERKOS_METRICS_TOKEN=<the-hex-string>
```

Restart the stack so all three services pick it up.

## Grafana Cloud setup (free tier)

1. Create a free Grafana Cloud account → grafana.com.
2. Stack → **My Account** → **Prometheus** → copy:
   - `Remote Write Endpoint` (looks like `https://prometheus-prod-NN-prod-XX-XXXX.grafana.net/api/prom/push`)
   - `Username` (a numeric stack id)
   - **Generate a write-scoped API token**, copy it.
3. Run the Grafana Agent / Alloy container (see `alloy.example.river`)
   on the same Docker network as the PerkOS stack so it can reach the
   `perkos-miniapp*` containers by service name.

## What this PR doesn't ship

- **Dashboards.** Once metrics are flowing, the dashboards (hibernation
  rate, curator decisions, provisioning throughput) get built in Grafana
  Cloud — they're not in source control because the Grafana terraform
  provider isn't part of our infra story (yet).
- **Alert rules.** Same reasoning — they live in Grafana Cloud's
  alerting UI for now. A future PR can sync them via the dashboards-as-
  code pattern when the volume of alerts justifies it.
- **PerkOS-Platform-Tools-API metrics.** That's a separate repo +
  process; its `/metrics` endpoint gets added there in a follow-up.
