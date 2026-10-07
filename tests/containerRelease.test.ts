// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const source = (path: string) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
describe("Solana container release contract", () => {
  it("has a disabled-by-default build flag in every environment", () => {
    const dockerfile = source("deploy/Dockerfile");
    expect(dockerfile).toContain("ARG NEXT_PUBLIC_SOLANA_LOGIN_ENABLED=false");
    expect(dockerfile).toContain("NEXT_PUBLIC_SOLANA_LOGIN_ENABLED=$NEXT_PUBLIC_SOLANA_LOGIN_ENABLED");
    for (const [file, service] of [["docker-compose.example.yml", "miniapp"], ["docker-compose.development.yml", "app-dev"], ["docker-compose.qa.yml", "app-qa"]]) {
      const compose = parse(source(file));
      expect(compose.services[service].build.args.NEXT_PUBLIC_SOLANA_LOGIN_ENABLED).toBe("${NEXT_PUBLIC_SOLANA_LOGIN_ENABLED:-false}");
    }
  });
  it("fetches the same immutable shared commit over HTTPS without SSH credentials", () => {
    const pkg = JSON.parse(source("package.json"));
    const lock = JSON.parse(source("package-lock.json"));
    const pin = "git+https://github.com/PerkOS-xyz/PerkOS-Shared-Types.git#001c7c73ed8517a29cf00c1bbc0cd38eb453c62a";
    expect(pkg.dependencies["@perkos/shared-types"]).toBe(pin);
    expect(lock.packages[""].dependencies["@perkos/shared-types"]).toBe(pin);
    expect(lock.packages["node_modules/@perkos/shared-types"].resolved).toBe(pin);
    expect(source("deploy/Dockerfile")).toContain("apk add --no-cache git");
  });
  it("excludes local environment and credentials from the Docker context", () => {
    const ignored = source(".dockerignore").split("\n");
    for (const pattern of [".env", ".env.*", ".secrets", ".git", "node_modules", ".next", "**/*.pem", "**/*.key"]) expect(ignored).toContain(pattern);
  });
});
