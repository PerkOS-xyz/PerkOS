import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AgentIdentityAvatar } from "../app/components/AgentIdentityAvatar";
import { AgentOrb } from "../app/components/AgentOrb";
import { deriveAgentAvatarIdentity } from "../app/lib/agentAvatarIdentity";

describe("AgentIdentityAvatar", () => {
  it("renders every stored identity layer without exposing decorative SVG", () => {
    const identity = deriveAgentAvatarIdentity("template:1:researcher");
    const { container } = render(
      <div aria-label="Researcher">
        <AgentIdentityAvatar identity={identity} size={64} state="working" />
      </div>,
    );
    expect(screen.getByLabelText("Researcher")).toBeInTheDocument();
    const avatar = container.querySelector("[data-avatar-seed]");
    expect(avatar).toHaveAttribute("data-avatar-seed", identity.seed);
    expect(avatar).toHaveAttribute("data-avatar-version", "1");
    expect(avatar).toHaveAttribute("data-avatar-state", "working");
    expect(avatar).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("keeps AgentOrb backward compatible while accepting a stored identity", () => {
    const identity = deriveAgentAvatarIdentity("template:1:lead");
    const { container, rerender } = render(
      <AgentOrb name="Lead" identity={identity} size={48} status="available" />,
    );
    expect(container.querySelector("[data-avatar-seed]")).toHaveAttribute(
      "data-avatar-seed",
      identity.seed,
    );
    rerender(<AgentOrb name="Legacy agent" presetId="researcher" size={48} />);
    expect(container.querySelector("[data-avatar-seed]")).toBeInTheDocument();
  });
});
