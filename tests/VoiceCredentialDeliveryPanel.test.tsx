import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rotate: vi.fn(),
  clipboard: vi.fn(),
}));
vi.mock("../app/lib/perkosApi", () => ({
  rotateEncryptedVoiceCredential: mocks.rotate,
}));

import { VoiceCredentialDeliveryPanel } from "../app/(app)/agents/[agentId]/VoiceCredentialDeliveryPanel";

describe("VoiceCredentialDeliveryPanel", () => {
  beforeEach(() => {
    mocks.rotate.mockReset();
    mocks.clipboard.mockReset();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: mocks.clipboard },
    });
  });

  it("does not render for a non-owner", () => {
    const { container } = render(
      <VoiceCredentialDeliveryPanel agentId="bragi" agentName="Bragi" owner={false} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("requires acknowledgement, copies ciphertext only, and clears state", async () => {
    mocks.rotate.mockResolvedValue({ algorithm: "RSA-OAEP-256", ciphertext: "ciphertext" });
    mocks.clipboard.mockResolvedValue(undefined);
    render(<VoiceCredentialDeliveryPanel agentId="bragi" agentName="Bragi" owner />);

    const key = screen.getByLabelText("Ephemeral gateway public key");
    const rotate = screen.getByRole("button", { name: "Rotate and encrypt" });
    fireEvent.change(key, { target: { value: "PUBLIC KEY" } });
    expect(rotate).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(rotate);

    await waitFor(() => expect(mocks.rotate).toHaveBeenCalledWith("bragi", "PUBLIC KEY"));
    fireEvent.click(await screen.findByRole("button", { name: "Copy encrypted envelope" }));
    await waitFor(() => expect(mocks.clipboard).toHaveBeenCalledWith(
      JSON.stringify({ algorithm: "RSA-OAEP-256", ciphertext: "ciphertext" }),
    ));
    expect(key).toHaveValue("");
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    expect(screen.queryByRole("button", { name: "Copy encrypted envelope" })).not.toBeInTheDocument();
  });

  it("retains the in-memory envelope when clipboard access fails", async () => {
    mocks.rotate.mockResolvedValue({ algorithm: "RSA-OAEP-256", ciphertext: "ciphertext" });
    mocks.clipboard.mockRejectedValue(new Error("blocked"));
    render(<VoiceCredentialDeliveryPanel agentId="bragi" agentName="Bragi" owner />);
    fireEvent.change(screen.getByLabelText("Ephemeral gateway public key"), { target: { value: "PUBLIC KEY" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Rotate and encrypt" }));
    fireEvent.click(await screen.findByRole("button", { name: "Copy encrypted envelope" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Clipboard access failed");
    expect(screen.getByRole("button", { name: "Copy encrypted envelope" })).toBeInTheDocument();
  });
});
