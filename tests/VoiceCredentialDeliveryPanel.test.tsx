import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rotate: vi.fn(),
}));
vi.mock("../app/lib/perkosApi", () => ({
  rotateEncryptedVoiceCredentialDelivery: mocks.rotate,
}));

import { VoiceCredentialDeliveryPanel } from "../app/(app)/agents/[agentId]/VoiceCredentialDeliveryPanel";

describe("VoiceCredentialDeliveryPanel", () => {
  beforeEach(() => {
    mocks.rotate.mockReset();
  });

  it("does not render for a non-owner", () => {
    const { container } = render(
      <VoiceCredentialDeliveryPanel agentId="bragi" agentName="Bragi" owner={false} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("does not render for a non-Bragi agent", () => {
    const { container } = render(
      <VoiceCredentialDeliveryPanel agentId="other" agentName="Other" owner />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("requires acknowledgement and shows only safe delivery metadata", async () => {
    mocks.rotate.mockResolvedValue({
      id: "delivery-id", claimId: "claim-id", algorithm: "RSA-OAEP-256",
      audience: "perkos-voice-gateway-grant:v1", publicKeyFingerprint: "fingerprint",
      expiresAt: "2026-08-15T01:00:00.000Z",
    });
    render(<VoiceCredentialDeliveryPanel agentId="bragi" agentName="Bragi" owner />);

    const key = screen.getByLabelText("Ephemeral gateway public key");
    const rotate = screen.getByRole("button", { name: "Rotate and encrypt" });
    fireEvent.change(key, { target: { value: "PUBLIC KEY" } });
    expect(rotate).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(rotate);

    await waitFor(() => expect(mocks.rotate).toHaveBeenCalledWith("bragi", "PUBLIC KEY"));
    expect(await screen.findByRole("status")).toHaveTextContent("Delivery pending for Bragi");
    expect(screen.getByRole("status")).toHaveTextContent("fingerprint");
    expect(screen.queryByText(/ciphertext$/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /copy/i })).not.toBeInTheDocument();
    expect(key).toHaveValue("");
    expect(screen.getByRole("checkbox")).not.toBeChecked();
  });
});
