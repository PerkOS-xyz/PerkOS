import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("published A2A release artifacts", () => {
  it.each([
    {
      version: "0.12.69",
      sha256: "247caaee67754a18cdcb93195e0188504f577d75c60352590e93677135b7ebec",
      integrity: "sha512-bEohpPBho0H20Meo5BZBsh3UxoC0ST+Vtta6ZBtod3ZcKRVT5bsb0vM4Nmtb4ieD6rZI/zlc1BG6BIPizddVUQ==",
    },
    {
      version: "0.12.71",
      sha256: "69a38789fc89075aa377d49b9b33408a3af82d3187f950d70f8c84261ddfd982",
      integrity: "sha512-UO97da+F6fg3yIDRU5Bg2VbEoYPKXsF6rUW/g85UVC4IQYv5Sdomn5wnbt/GHgEVxfX8/flPHHCLdws93KKHKA==",
    },
    {
      version: "0.12.72",
      sha256: "8ca6552cc3f03ce2e57958159900ffd7f0298f04a9e58d356188137a94941647",
      integrity: "sha512-QUWM9LKArJSoe5w5NfcovzZQ20HMRwNgABlOB6xr0J4O5s+KFdc39txjRhOna2GgVu7FN/I3O/Y7hBS6AwiZhA==",
    },
  ])("serves the exact published npm $version archive", ({ version, sha256, integrity }) => {
    const directory = resolve(process.cwd(), "public/artifacts");
    const filename = `perkos-a2a-${version}.tgz`;
    const archive = readFileSync(resolve(directory, filename));
    const hash = createHash("sha256").update(archive).digest("hex");
    expect(hash).toBe(sha256);
    expect(readFileSync(resolve(directory, `perkos-a2a-${version}.sha256`), "utf8").trim())
      .toBe(`${hash}  ${filename}`);
    expect(`sha512-${createHash("sha512").update(archive).digest("base64")}`)
      .toBe(integrity);
  });
});
