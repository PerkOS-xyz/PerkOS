import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";

import { getMetrics, getRegistry } from "../app/lib/metrics";
import { startMetricsServer, type MetricsServerHandle } from "../app/worker/metricsServer";

let handle: MetricsServerHandle | null = null;
let baseUrl = "";

beforeEach(async () => {
  getRegistry().resetMetrics();
  handle = startMetricsServer({
    port: 0, // ephemeral
    token: "test-token-abc",
    processName: "test-worker",
    logger: () => {},
  });
  await new Promise<void>((resolve) =>
    handle!.server.on("listening", () => resolve()),
  );
  const addr = handle!.server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

afterEach(async () => {
  if (handle) await handle.stop();
  handle = null;
});

describe("metrics server", () => {
  it("healthz responds 200 with no auth", async () => {
    const res = await fetch(`${baseUrl}/healthz`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  it("metrics returns 401 without bearer token", async () => {
    const res = await fetch(`${baseUrl}/metrics`);
    expect(res.status).toBe(401);
  });

  it("metrics returns 401 with wrong token", async () => {
    const res = await fetch(`${baseUrl}/metrics`, {
      headers: { authorization: "Bearer wrong" },
    });
    expect(res.status).toBe(401);
  });

  it("metrics returns 200 with correct token + recently-bumped counter", async () => {
    getMetrics().hibernateTotal.inc({ result: "success" });
    const res = await fetch(`${baseUrl}/metrics`, {
      headers: { authorization: "Bearer test-token-abc" },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/plain");
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = await res.text();
    expect(body).toContain("perkos_hibernate_total");
    expect(body).toContain('result="success"');
  });

  it("unknown path returns 404", async () => {
    const res = await fetch(`${baseUrl}/nope`);
    expect(res.status).toBe(404);
  });

  it("non-GET on /metrics returns 404 (route is GET-only)", async () => {
    const res = await fetch(`${baseUrl}/metrics`, { method: "POST" });
    expect(res.status).toBe(404);
  });
});
