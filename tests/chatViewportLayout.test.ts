import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");

describe("chat viewport layout", () => {
  it("lets the app shell own the viewport height", () => {
    const shell = readFileSync(resolve(root, "app/(app)/layout.tsx"), "utf8");
    expect(shell).toContain('isChatRoute ? "h-dvh overflow-hidden"');
    expect(shell).toContain("flex min-h-0 flex-1 flex-col overflow-hidden");
    expect(shell).toContain("safe-area-inset-bottom");
  });

  it("fills the shell slot without route-local viewport arithmetic", () => {
    const layout = readFileSync(resolve(root, "app/(app)/chat/layout.tsx"), "utf8");
    expect(layout).toContain('className="flex h-full min-h-0 overflow-hidden"');
    expect(layout).not.toContain("100dvh-");
    expect(layout).not.toContain("md:-m-8");
  });

  it("keeps the composer fixed in flow and safe-area aware", () => {
    const composer = readFileSync(resolve(root, "app/components/ConversationComposer.tsx"), "utf8");
    expect(composer).toContain("shrink-0");
    expect(composer).toContain("safe-area-inset-bottom");
  });
});
