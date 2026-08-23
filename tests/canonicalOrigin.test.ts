import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * No source file may build a URL it hands to a caller out of the incoming
 * request.
 *
 * Behind Caddy the Next server binds 0.0.0.0:3000, and that is what the
 * request URL reports. Deriving an origin from it produces URLs nobody can
 * reach. This shipped twice — first in the Link headers, then in the A2A
 * endpoint's own error message — because a build and a green suite both
 * confirm the code runs, not that the value is reachable.
 */
function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, acc);
    else if (/\.tsx?$/.test(entry)) acc.push(full);
  }
  return acc;
}

describe("canonical origin", () => {
  it("never derives a caller-facing origin from the request", () => {
    const offenders = [...sourceFiles(join(process.cwd(), "app")), join(process.cwd(), "middleware.ts")]
      .filter((f) => {
        const src = readFileSync(f, "utf8");
        // The pattern that produced https://0.0.0.0:3000/... in production.
        return /new URL\(request\.url\)\.origin|request\.nextUrl\.origin/.test(src);
      })
      .map((f) => f.replace(process.cwd() + "/", ""));

    expect(offenders).toEqual([]);
  });
});
