import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rotate: vi.fn(), health: vi.fn(), capability: vi.fn(), probe: vi.fn(), prepare: vi.fn(), send: vi.fn() }));
vi.mock("../app/lib/perkosApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../app/lib/perkosApi")>()),
  rotateVoiceGatewayCredential: mocks.rotate,
  getAgentVoiceHealthApi: mocks.health,
  getVoiceEnrollmentCapability: mocks.capability,
  requestVoiceSupportProbe: mocks.probe,
  prepareA2AVoiceEnrollment: mocks.prepare,
}));

import {
  buildHermesA2AUpdatePrompt,
  buildVoiceEnrollmentBundle,
  VoiceEnrollmentPanel,
  voiceApiBaseForHost,
} from "../app/(app)/agents/[agentId]/VoiceEnrollmentPanel";

function renderPanel(owner = true, canSend = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <VoiceEnrollmentPanel
        agentId="athena-id"
        agentName="Athena"
        runtime="Hermes"
        owner={owner}
        canSendToAgent={() => canSend}
        onSendToAgent={mocks.send}
      />
    </QueryClientProvider>,
  );
}

describe("VoiceEnrollmentPanel", () => {
  beforeEach(() => {
    mocks.rotate.mockReset();
    mocks.health.mockReset();
    mocks.capability.mockReset();
    mocks.probe.mockReset();
    mocks.prepare.mockReset();
    mocks.send.mockReset();
    mocks.send.mockResolvedValue(true);
    mocks.health.mockResolvedValue({ health: { ready: false, capabilityAvailable: false }, recent: [] });
    mocks.capability.mockResolvedValue({ capability: { state: "available", updatedAt: "2026-09-01T12:00:00.000Z" } });
  });

  it("does not render or mint credentials for a non-owner", () => {
    expect(renderPanel(false).container.firstChild).toBeNull();
    expect(mocks.rotate).not.toHaveBeenCalled();
  });

  it("prepares A2A enrollment without returning a secret", async () => {
    mocks.prepare.mockResolvedValue({
      prompt: "PERKOS_VOICE_ENROLL",
      capability: { state: "enrolling", enrollmentRequestedAt: "2026-09-01T12:00:00.000Z", updatedAt: "2026-09-01T12:00:00.000Z" },
    });
    renderPanel();
    expect(mocks.rotate).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "Enable calls" }));
    expect(mocks.prepare).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "Send to agent" }));
    await waitFor(() => expect(mocks.prepare).toHaveBeenCalledWith("athena-id"));
    expect(mocks.send).toHaveBeenCalledWith("PERKOS_VOICE_ENROLL");
    expect(await screen.findByText("PERKOS_VOICE_ENROLL")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy enrollment prompt" })).toBeInTheDocument();
    expect(mocks.rotate).not.toHaveBeenCalled();
  });

  it("offers a non-destructive support check for unknown agents", async () => {
    mocks.capability.mockResolvedValue({ capability: { state: "unknown", updatedAt: "2026-09-01T12:00:00.000Z" } });
    mocks.probe.mockResolvedValue({ prompt: "PERKOS_VOICE_PROBE", capability: { state: "unknown", updatedAt: "2026-09-01T12:00:00.000Z" } });
    renderPanel();
    fireEvent.click(await screen.findByRole("button", { name: "Check Voice support" }));
    expect(mocks.probe).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "Send to agent" }));
    await waitFor(() => expect(mocks.probe).toHaveBeenCalledWith("athena-id"));
    expect(mocks.send).toHaveBeenCalledWith("PERKOS_VOICE_PROBE");
    expect(await screen.findByText("PERKOS_VOICE_PROBE")).toBeInTheDocument();
  });

  it("confirms and sends a secret-free Hermes update through the existing chat", async () => {
    mocks.capability.mockResolvedValue({ capability: { state: "unknown", updatedAt: "2026-09-01T12:00:00.000Z" } });
    renderPanel();
    fireEvent.click(await screen.findByRole("button", { name: "Update integration" }));
    expect(mocks.send).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "Send to agent" }));
    await waitFor(() => expect(mocks.send).toHaveBeenCalledTimes(1));
    const message = mocks.send.mock.calls[0]![0] as string;
    expect(message).toBe(buildHermesA2AUpdatePrompt("athena-id"));
    expect(message).toContain("@perkos/perkos-a2a@0.12.62 update-hermes --agent-id 'athena-id'");
    expect(message).not.toMatch(/relayApiKey|credential-from|rk_/i);
    expect(mocks.probe).not.toHaveBeenCalled();
    expect(mocks.prepare).not.toHaveBeenCalled();
  });

  it("shell-quotes the server-provided agent id in the maintenance prompt", () => {
    const prompt = buildHermesA2AUpdatePrompt("athena'$(touch /tmp/nope)");
    expect(prompt).toContain("--agent-id 'athena'\"'\"'$(touch /tmp/nope)' --json");
    expect(prompt).not.toContain("--agent-id athena'");
  });

  it("does not prepare server state when the agent chat is unavailable", async () => {
    renderPanel(true, false);
    fireEvent.click(await screen.findByRole("button", { name: "Enable calls" }));
    fireEvent.click(await screen.findByRole("button", { name: "Send to agent" }));
    await waitFor(() => expect(mocks.prepare).not.toHaveBeenCalled());
    expect(mocks.send).not.toHaveBeenCalled();
  });
});

describe("Voice enrollment bundle", () => {
  it("maps each app environment to the matching public API", () => {
    expect(voiceApiBaseForHost("dev.perkos.xyz")).toBe("https://dev.api.perkos.xyz");
    expect(voiceApiBaseForHost("qa.perkos.xyz")).toBe("https://qa.api.perkos.xyz");
    expect(voiceApiBaseForHost("perkos.xyz")).toBe("https://api.perkos.xyz");
  });

  it("never embeds the credential in instructions or command arguments", () => {
    const secret = "vgc_test_do_not_leak";
    const bundle = buildVoiceEnrollmentBundle({
      agentId: "athena-id", agentName: "Athena", runtime: "Hermes", credential: secret, hostname: "dev.perkos.xyz",
    });
    expect(bundle.instructions).toContain("https://dev.api.perkos.xyz/agents/athena-id/voice-control");
    expect(bundle.instructions).toContain("perkos-voice-install-hermes");
    expect(bundle.instructions).not.toContain(secret);
    expect(JSON.parse(bundle.secretFile)).toEqual({ grantCredential: secret, capabilityPublishCredential: secret });
  });
});
