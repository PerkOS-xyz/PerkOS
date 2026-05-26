import { describe, expect, it, beforeEach } from "vitest";

import { getMetrics, getRegistry, renderMetrics } from "../app/lib/metrics";

// Reset the singleton between tests so counters don't leak across.
beforeEach(() => {
  const reg = getRegistry();
  reg.resetMetrics();
});

describe("metrics registry", () => {
  it("renders the prom text format and includes default + business metrics", async () => {
    getMetrics().hibernateTotal.inc({ result: "success" });
    getMetrics().curatorDecisionTotal.inc({ reason: "idle" });
    getMetrics().agentProvisionedTotal.inc({ runtime: "Hermes", result: "success" });

    const { body, contentType } = await renderMetrics();
    expect(contentType).toContain("text/plain");
    expect(body).toContain("perkos_hibernate_total");
    expect(body).toContain('result="success"');
    expect(body).toContain("perkos_curator_decision_total");
    expect(body).toContain('reason="idle"');
    expect(body).toContain("perkos_agent_provisioned_total");
    expect(body).toContain('runtime="Hermes"');
    // Default process metrics are namespaced by the prefix we set.
    expect(body).toContain("perkos_process_");
    expect(body).toContain("perkos_nodejs_");
  });

  it("histogram emits _bucket / _sum / _count series with the dryRun label", async () => {
    getMetrics().curatorTickDuration.observe({ dryRun: "true" }, 0.5);
    getMetrics().curatorTickDuration.observe({ dryRun: "false" }, 2.5);
    const { body } = await renderMetrics();
    expect(body).toMatch(/perkos_curator_tick_duration_seconds_bucket.*dryRun="true"/);
    expect(body).toMatch(/perkos_curator_tick_duration_seconds_bucket.*dryRun="false"/);
    expect(body).toContain("perkos_curator_tick_duration_seconds_sum");
    expect(body).toContain("perkos_curator_tick_duration_seconds_count");
  });

  it("getMetrics is a process-wide singleton", () => {
    const a = getMetrics();
    const b = getMetrics();
    expect(a).toBe(b);
  });

  it("counters accept multiple result labels without collision", async () => {
    getMetrics().hibernateTotal.inc({ result: "success" });
    getMetrics().hibernateTotal.inc({ result: "noop" });
    getMetrics().hibernateTotal.inc({ result: "error" });
    getMetrics().hibernateTotal.inc({ result: "not-found" });
    const { body } = await renderMetrics();
    for (const r of ["success", "noop", "error", "not-found"]) {
      expect(body).toContain(`result="${r}"`);
    }
  });
});
