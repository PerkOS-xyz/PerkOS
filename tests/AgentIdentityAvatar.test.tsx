import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AgentIdentityAvatar } from "../app/components/AgentIdentityAvatar";
import { AgentOrb } from "../app/components/AgentOrb";
import { ProjectAgentIdentityProvider } from "../app/components/ProjectAgentIdentity";
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

  it("keeps the registered ID's look across name, role, status and project changes", () => {
    const agent = { id: "imported-89", name: "original", avatarAppearance: 8 };
    const { container, rerender } = render(<AgentOrb name={agent.name} agent={agent} size={48} />);
    const signature = container.querySelector("[data-avatar-seed]")?.getAttribute("data-avatar-signature");
    expect(container.querySelector("img")).toHaveAttribute("src", "/agents/avatar-v3/08-operations-specialist.webp");
    const renamed = { ...agent, name: "renamed", displayName: "Renamed Agent" };
    rerender(<ProjectAgentIdentityProvider names={[renamed.name, "another"]} agents={{ renamed }}>
      <AgentOrb name={renamed.name} role="engineer" status="available" size={20} />
    </ProjectAgentIdentityProvider>);
    expect(container.querySelector("[data-avatar-seed]")).toHaveAttribute("data-avatar-signature", signature);
  });

  it("keeps a selected inline photo but falls back if it cannot decode", () => {
    const photo = "data:image/jpeg;base64,/9j/AA==";
    const agent = { id: "external-photo", name: "external", avatarAppearance: photo };
    const { container } = render(<AgentOrb name={agent.name} agent={agent} />);
    const image = container.querySelector("img")!;
    expect(image).toHaveAttribute("src", photo);
    fireEvent.error(image);
    expect(image.getAttribute("src")).toMatch(/^\/agents\/avatar-v3\//);
  });
});
