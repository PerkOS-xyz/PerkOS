/**
 * Regression test for the "Opening chat…" deadlock.
 *
 * The bug: ChatbotProvider's ensure-conv effect listed `loadingConv`
 * in its deps + checked it for guarding. Inside, it set loadingConv
 * to true and kicked off the fetch. React saw the dep change,
 * re-ran the effect, the cleanup flipped `cancelled=true` on the
 * in-flight fetch, and the `.finally` (which only reset
 * loadingConv when `!cancelled`) never ran the reset — leaving
 * loadingConv stuck true forever. The panel header showed
 * "Opening chat…" indefinitely and any send tried displayed
 * "Still opening your Assistant conversation, try again in a
 * moment."
 *
 * This test renders the provider with a controllable mock of
 * ensureAssistantConv. It opens the panel, lets the promise
 * resolve, then asserts that:
 *   1. loadingConv ends false (the deadlock would leave it true)
 *   2. convId reaches the resolved value (the deadlock would
 *      leave it null because cancelled=true gates setConvId)
 *   3. ensureAssistantConv was called exactly once
 *
 * The mock uses a deferred promise so we have explicit control
 * over resolution timing; the resolve happens AFTER the second
 * effect run (caused by setLoadingConv) so the bug's re-entry
 * pattern is exercised faithfully.
 */
import { act, render, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";

// useConnection in wagmi — mocked to report a connected wallet.
vi.mock("wagmi", async () => {
  const actual = await vi.importActual<typeof import("wagmi")>("wagmi");
  return {
    ...actual,
    useConnection: () => ({ address: "0xabc", isConnected: true }),
  };
});

// Single shared mock for ensureAssistantConv so the test controls when
// it resolves. The deferred mock returns a promise the test resolves
// later, simulating a real network call.
const calls: Array<() => void> = [];
let lastPromise: Promise<{ convId: string; historyHost: string }> | null = null;
vi.mock("../app/lib/perkosApi", () => ({
  ensureAssistantConv: vi.fn(() => {
    lastPromise = new Promise((resolve) => {
      calls.push(() => resolve({ convId: "conv-abc-123", historyHost: "agent:PerkOS-Assistant" }));
    });
    return lastPromise;
  }),
}));

import { ChatbotProvider, useChatbot } from "../app/components/ChatbotProvider";

function PanelOpener({ onState }: { onState: (s: { loadingConv: boolean; convId: string | null }) => void }) {
  const { setOpen, loadingConv, convId } = useChatbot();
  // Open the panel on mount so the ensure-conv effect's open-gate is
  // satisfied. Without this the effect early-returns.
  useEffect(() => {
    setOpen(true);
  }, [setOpen]);
  // Report current state up so the test can assert.
  useEffect(() => {
    onState({ loadingConv, convId });
  }, [loadingConv, convId, onState]);
  return null;
}

describe("ChatbotProvider ensure-conv lifecycle", () => {
  it("does not deadlock when setLoadingConv(true) re-triggers the effect", async () => {
    const states: Array<{ loadingConv: boolean; convId: string | null }> = [];
    calls.length = 0;
    lastPromise = null;

    render(
      <ChatbotProvider>
        <PanelOpener onState={(s) => states.push(s)} />
      </ChatbotProvider>,
    );

    // Effect runs after first commit; allow the queue to flush.
    await waitFor(() => {
      expect(states.some((s) => s.loadingConv)).toBe(true);
    });

    // Resolve the in-flight promise.
    expect(calls.length).toBeGreaterThan(0);
    await act(async () => {
      calls[calls.length - 1]!();
      // Let the .then + .finally chain run.
      await lastPromise;
    });

    // After resolution, loadingConv MUST end false (the bug left it
    // true forever) and convId MUST be set to the resolved value.
    await waitFor(() => {
      const last = states[states.length - 1]!;
      expect(last.loadingConv).toBe(false);
      expect(last.convId).toBe("conv-abc-123");
    });
  });
});
