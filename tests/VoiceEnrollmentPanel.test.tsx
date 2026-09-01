import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rotate: vi.fn(), health: vi.fn() }));
vi.mock("../app/lib/perkosApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../app/lib/perkosApi")>()),
  rotateVoiceGatewayCredential: mocks.rotate,
  getAgentVoiceHealthApi: mocks.health,
}));

import {
  buildVoiceEnrollmentBundle,
  VoiceEnrollmentPanel,
  voiceApiBaseForHost,
} from "../app/(app)/agents/[agentId]/VoiceEnrollmentPanel";

function renderPanel(owner = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <VoiceEnrollmentPanel agentId="athena-id" agentName="Athena" runtime="Hermes" owner={owner} />
    </QueryClientProvider>,
  );
}

describe("VoiceEnrollmentPanel", () => {
  beforeEach(() => {
    mocks.rotate.mockReset();
    mocks.health.mockReset();
    mocks.health.mockResolvedValue({ health: { ready: false, capabilityAvailable: false }, recent: [] });
  });

  it("does not render or mint credentials for a non-owner", () => {
    expect(renderPanel(false).container.firstChild).toBeNull();
    expect(mocks.rotate).not.toHaveBeenCalled();
  });

  it("mints only after Enable calls and keeps the secret separate from instructions", async () => {
    mocks.rotate.mockResolvedValue({
      credential: "vgc_test_abcdefghijklmnopqrstuvwxyz",
      audience: "perkos-voice-gateway-grant:v1",
      expiresAt: "2026-09-02T12:00:00.000Z",
    });
    renderPanel();
    expect(mocks.rotate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Enable calls" }));
    await waitFor(() => expect(mocks.rotate).toHaveBeenCalledWith("athena-id"));
    expect(await screen.findByRole("button", { name: "Copy plugin instructions" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy secret JSON" })).toBeInTheDocument();
    expect(screen.queryByText("vgc_test_abcdefghijklmnopqrstuvwxyz")).not.toBeInTheDocument();
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
