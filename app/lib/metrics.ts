/**
 * Prometheus metrics registry + named metrics for PerkOS.
 *
 * Single shared `register` per process — both the API /metrics route
 * and the worker metrics server pull from it. All metrics are namespaced
 * `perkos_*` so they don't collide with anything Grafana Cloud scrapes
 * from other systems.
 *
 * Why prom-client (not OpenTelemetry)?
 *   For v1 we want a /metrics endpoint that a scraper (Grafana Agent,
 *   Alloy, vanilla Prometheus) can hit. prom-client is ~30 KB, no
 *   network deps, the registry is fully in-memory, and it gives us
 *   the Prometheus text exposition format directly. OTel buys us
 *   tracing + logs unification but adds a much bigger surface; we'll
 *   layer it on later if we need spans.
 *
 * What's instrumented:
 *   - Hibernation: hibernate / wake / upgrade outcomes counted.
 *   - Curator: per-tick duration + per-reason decision counts.
 *   - Provisioning: agent provisioning outcomes by runtime + result.
 *   - Process basics (cpu/mem/event-loop lag) via collectDefaultMetrics.
 *
 * What's NOT yet instrumented (follow-ups):
 *   - Per-route HTTP histograms — needs Next.js middleware. Layer on
 *     once we have a real traffic pattern to size buckets for.
 *   - PerkOS-Platform-Tools-API audit log shipping — that's a separate
 *     repo / process; its own /metrics ships there.
 */
import "server-only";

import { collectDefaultMetrics, Counter, Histogram, Registry } from "prom-client";

declare global {
  var __perkosMetricsRegistry: Registry | undefined;
  var __perkosMetrics: PerkosMetrics | undefined;
}

export type PerkosMetrics = {
  hibernateTotal: Counter<"result">;
  wakeTotal: Counter<"result">;
  upgradeTotal: Counter<"result">;
  curatorTickDuration: Histogram<"dryRun">;
  curatorDecisionTotal: Counter<"reason">;
  curatorHibernationsTotal: Counter<"result">;
  agentProvisionedTotal: Counter<"runtime" | "result">;
};

/**
 * Lazy-construct the registry + metrics. Stored on globalThis so dev-
 * mode HMR doesn't re-register and explode on duplicate-name. Same
 * pattern Next.js uses for db clients.
 */
function init(): { register: Registry; metrics: PerkosMetrics } {
  if (globalThis.__perkosMetricsRegistry && globalThis.__perkosMetrics) {
    return {
      register: globalThis.__perkosMetricsRegistry,
      metrics: globalThis.__perkosMetrics,
    };
  }
  const register = new Registry();
  // Process-level metrics: process_cpu_seconds_total, process_resident_
  // memory_bytes, nodejs_eventloop_lag_seconds, etc. Useful first thing
  // to see on a dashboard when something feels slow.
  collectDefaultMetrics({ register, prefix: "perkos_" });

  const hibernateTotal = new Counter({
    name: "perkos_hibernate_total",
    help: "Number of hibernate calls, labelled by outcome.",
    labelNames: ["result"] as const,
    registers: [register],
  });
  const wakeTotal = new Counter({
    name: "perkos_wake_total",
    help: "Number of wake calls, labelled by outcome.",
    labelNames: ["result"] as const,
    registers: [register],
  });
  const upgradeTotal = new Counter({
    name: "perkos_upgrade_total",
    help: "Number of agent runtime upgrade attempts, labelled by outcome.",
    labelNames: ["result"] as const,
    registers: [register],
  });
  const curatorTickDuration = new Histogram({
    name: "perkos_curator_tick_duration_seconds",
    help: "Wall-clock seconds spent in one curator tick.",
    labelNames: ["dryRun"] as const,
    buckets: [0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60, 120],
    registers: [register],
  });
  const curatorDecisionTotal = new Counter({
    name: "perkos_curator_decision_total",
    help: "Curator decisions, labelled by reason (idle, skipped-not-idle, etc).",
    labelNames: ["reason"] as const,
    registers: [register],
  });
  const curatorHibernationsTotal = new Counter({
    name: "perkos_curator_hibernations_total",
    help: "Hibernations the curator performed (live mode only), labelled by outcome.",
    labelNames: ["result"] as const,
    registers: [register],
  });
  const agentProvisionedTotal = new Counter({
    name: "perkos_agent_provisioned_total",
    help: "Agents that completed provisioning, labelled by runtime + outcome.",
    labelNames: ["runtime", "result"] as const,
    registers: [register],
  });

  const metrics: PerkosMetrics = {
    hibernateTotal,
    wakeTotal,
    upgradeTotal,
    curatorTickDuration,
    curatorDecisionTotal,
    curatorHibernationsTotal,
    agentProvisionedTotal,
  };

  globalThis.__perkosMetricsRegistry = register;
  globalThis.__perkosMetrics = metrics;
  return { register, metrics };
}

export function getRegistry(): Registry {
  return init().register;
}

export function getMetrics(): PerkosMetrics {
  return init().metrics;
}

/**
 * Render the registry to Prometheus text format. Async because
 * collectDefaultMetrics samples happen lazily on collect().
 */
export async function renderMetrics(): Promise<{ body: string; contentType: string }> {
  const register = getRegistry();
  return {
    body: await register.metrics(),
    contentType: register.contentType,
  };
}
