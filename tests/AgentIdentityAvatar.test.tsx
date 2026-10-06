import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AgentIdentityAvatar } from "../app/components/AgentIdentityAvatar";
import { AgentOrb } from "../app/components/AgentOrb";
import { deriveAgentAvatarIdentity } from "../app/lib/agentAvatarIdentity";

describe("AgentIdentityAvatar", () => {
  it("renders the stored 3D archetype without exposing decorative SVG", () => {
    const identity = deriveAgentAvatarIdentity("template:1:researcher");
    const { container } = render(
      <div aria-label="Researcher">
        <AgentIdentityAvatar identity={identity} size={64} state="working" />
      </div>,
    );
    expect(screen.getByLabelText("Researcher")).toBeInTheDocument();
    const avatar = container.querySelector("[data-avatar-seed]");
    expect(avatar).toHaveAttribute("data-avatar-seed", identity.seed);
    expect(avatar).toHaveAttribute("data-avatar-version", "3");
    expect(avatar).toHaveAttribute("data-avatar-kit", "companion-v3");
    expect(avatar).toHaveAttribute("data-avatar-archetype", String(identity.archetypeId));
    expect(avatar).toHaveAttribute("data-avatar-state", "working");
    expect(avatar).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector("img")).toHaveAttribute("src", identity.assetPath);
    expect(container.querySelector("svg")).not.toBeInTheDocument();
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
