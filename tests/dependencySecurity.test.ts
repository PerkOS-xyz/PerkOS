// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type Entry = { version?: string; dev?: boolean };
const lock = JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url), "utf8")) as {
  packages: Record<string, Entry>;
};
const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const minimums: Record<string, Record<number, string>> = {
  next: { 16: "16.4.0" },
  "websocket-driver": { 0: "0.7.5" },
  "proxy-addr": { 2: "2.0.8" },
  sharp: { 0: "0.35.5" },
  axios: { 1: "1.20.0" },
  ws: { 8: "8.21.0" },
  "source-map-js": { 1: "1.2.2" },
  "form-data": { 2: "2.5.6", 4: "4.0.6" },
  "@fastify/busboy": { 3: "3.2.2" },
  hono: { 4: "4.13.13" },
};
function atLeast(actual: string, minimum: string) {
  expect(actual).toMatch(/^\d+\.\d+\.\d+$/);
  const a = actual.split(".").map(Number);
  const b = minimum.split(".").map(Number);
  const firstDifference = a.findIndex((value, i) => value !== b[i]);
  return firstDifference === -1 || a[firstDifference] > b[firstDifference];
}

describe("production dependency security floors", () => {
  it("keeps the wallet SDK aligned without a major migration", () => {
    for (const name of ["ethereum", "sdk-react-core", "solana"]) {
      expect(manifest.dependencies[`@dynamic-labs/${name}`]).toBe("4.100.4");
      expect(lock.packages[`node_modules/@dynamic-labs/${name}`].version).toBe("4.100.4");
    }
    expect(manifest.dependencies.next).toBe(manifest.devDependencies["eslint-config-next"]);
  });

  it("checks every production copy, including nested pins", () => {
    expect(lock.packages["node_modules/next"].version).toBe("16.4.0");
    for (const [path, entry] of Object.entries(lock.packages)) {
      if (entry.dev || !entry.version) continue;
      const name = path.split("node_modules/").at(-1)!;
      const [major, minor] = entry.version.split(".").map(Number);
      const minimum = name === "@grpc/grpc-js" && major === 1
        ? (minor >= 14 ? "1.14.5" : "1.13.6")
        : minimums[name]?.[major];
      if (minimum) expect(atLeast(entry.version, minimum), `${path}: ${entry.version}`).toBe(true);
    }
  });

  it("keeps shadcn CSS tooling in the build dependency set", () => {
    expect(manifest.dependencies.shadcn).toBeUndefined();
    expect(manifest.devDependencies.shadcn).toBeTruthy();
    expect(lock.packages["node_modules/shadcn"].dev).toBe(true);
  });

  it("retains the production-compatible CDP packaging until optional x402 peers are integrated", () => {
    const copies = Object.entries(lock.packages).filter(([path]) => path.endsWith("node_modules/@coinbase/cdp-sdk"));
    expect(copies.length).toBeGreaterThan(0);
    for (const [, entry] of copies) expect(entry.version).toBe("1.51.0");
  });
});
