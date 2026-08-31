import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { OfflineBanner } from "../app/components/OfflineBanner";

describe("OfflineBanner", () => {
  it("shows the generic unavailable copy when no host is known", () => {
    render(<OfflineBanner />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("Agent is unavailable.")).toBeInTheDocument();
    expect(
      screen.getByText(/Messages will remain queued/i),
    ).toBeInTheDocument();
  });

  it("names the host agent when historyHost is provided", () => {
    render(<OfflineBanner historyHost="agent:apollo" />);
    expect(
      screen.getByText("apollo is unavailable."),
    ).toBeInTheDocument();
  });

  it("switches the secondary copy when serving from cache", () => {
    render(<OfflineBanner fromCache />);
    expect(
      screen.getByText(/Showing locally-cached messages/i),
    ).toBeInTheDocument();
  });

  it("strips the agent: prefix from the host name in the heading", () => {
    render(<OfflineBanner historyHost="agent:hermes" fromCache />);
    expect(
      screen.getByText("hermes is unavailable."),
    ).toBeInTheDocument();
    // Sanity: the raw "agent:" prefix should never appear verbatim.
    expect(screen.queryByText(/agent:hermes/)).toBeNull();
  });

  it("offers wake for a sleeping managed agent", () => {
    render(<OfflineBanner agentName="Apollo" agentState="sleeping" managed onWake={() => {}} />);
    expect(screen.getByText("Apollo is sleeping to save resources.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Wake agent" })).toBeEnabled();
  });

  it("does not offer infrastructure wake for an external agent", () => {
    render(<OfflineBanner agentName="Hermes" agentState="unavailable" />);
    expect(screen.queryByRole("button", { name: /wake|try again/i })).toBeNull();
    expect(screen.getByRole("link", { name: "Connection settings" })).toBeInTheDocument();
  });
});
