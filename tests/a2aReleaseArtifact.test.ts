import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("published A2A Solana release artifact", () => {
  it("serves the exact npm 0.12.69 archive used by pinned invitations", () => {
    const directory = resolve(process.cwd(), "public/artifacts");
    const archive = readFileSync(resolve(directory, "perkos-a2a-0.12.69.tgz"));
    const hash = createHash("sha256").update(archive).digest("hex");
    expect(hash).toBe("247caaee67754a18cdcb93195e0188504f577d75c60352590e93677135b7ebec");
    expect(readFileSync(resolve(directory, "perkos-a2a-0.12.69.sha256"), "utf8").trim())
      .toBe(`${hash}  perkos-a2a-0.12.69.tgz`);
    expect(`sha512-${createHash("sha512").update(archive).digest("base64")}`)
      .toBe("sha512-bEohpPBho0H20Meo5BZBsh3UxoC0ST+Vtta6ZBtod3ZcKRVT5bsb0vM4Nmtb4ieD6rZI/zlc1BG6BIPizddVUQ==");
  });
});
