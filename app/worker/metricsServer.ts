/**
 * Tiny HTTP server that exposes /metrics for a Node worker process.
 *
 * Workers don't have a Next.js HTTP layer, but Grafana Agent / Alloy
 * still needs a URL to scrape. This wraps node:http with the same
 * bearer-token gate the miniapp route uses, plus a /healthz so
 * compose healthchecks can stay alive.
 *
 *   GET /metrics   (Authorization: Bearer PERKOS_METRICS_TOKEN)
 *   GET /healthz   (always 200)
 *
 * Binds 0.0.0.0 so the docker-compose network can reach it (the host
 * never exposes the port publicly — Caddy only routes the miniapp).
 */
import "server-only";

import { createServer, type Server } from "node:http";

import { renderMetrics } from "../lib/metrics";

export type MetricsServerHandle = {
  server: Server;
  stop: () => Promise<void>;
  port: number;
};

export function startMetricsServer(opts: {
  port: number;
  token?: string;
  /** Process-tag string for logs. */
  processName?: string;
  logger?: (msg: string) => void;
}): MetricsServerHandle {
  const log = opts.logger ?? ((m) => console.log(m));
  const token = opts.token ?? process.env.PERKOS_METRICS_TOKEN?.trim();

  const server = createServer(async (req, res) => {
    try {
      if (req.method === "GET" && req.url === "/healthz") {
        res
          .writeHead(200, { "content-type": "application/json" })
          .end(JSON.stringify({ ok: true }));
        return;
      }
      if (req.method !== "GET" || req.url !== "/metrics") {
        res.writeHead(404, { "content-type": "application/json" })
          .end(JSON.stringify({ error: "not found" }));
        return;
      }
      if (!token) {
        res.writeHead(503, { "content-type": "application/json" })
          .end(JSON.stringify({ error: "PERKOS_METRICS_TOKEN not set" }));
        return;
      }
      const header = req.headers.authorization ?? "";
      const presented = header.startsWith("Bearer ") ? header.slice(7) : "";
      if (presented !== token) {
        res.writeHead(401, { "content-type": "application/json" })
          .end(JSON.stringify({ error: "Unauthorized" }));
        return;
      }

      const { body, contentType } = await renderMetrics();
      res.writeHead(200, {
        "content-type": contentType,
        "cache-control": "no-store",
      }).end(body);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.writeHead(500, { "content-type": "application/json" })
        .end(JSON.stringify({ error: msg }));
    }
  });

  server.listen(opts.port, "0.0.0.0", () => {
    log(
      `[metrics-server] ${opts.processName ?? "worker"} listening on :${opts.port}/metrics`,
    );
  });

  const stop = async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  };

  return { server, stop, port: opts.port };
}
