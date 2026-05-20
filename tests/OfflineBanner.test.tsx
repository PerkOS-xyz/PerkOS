import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { OfflineBanner } from "../app/components/OfflineBanner";

describe("OfflineBanner", () => {
  it("shows the generic offline copy when no host is known", () => {
    render(<OfflineBanner />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("Host agent is offline.")).toBeInTheDocument();
    expect(
      screen.getByText(/Your messages will be delivered/i),
    ).toBeInTheDocument();
  });

  it("names the host agent when historyHost is provided", () => {
    render(<OfflineBanner historyHost="agent:apollo" />);
    expect(
      screen.getByText("Host agent (apollo) is offline."),
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
      screen.getByText("Host agent (hermes) is offline."),
    ).toBeInTheDocument();
    // Sanity: the raw "agent:" prefix should never appear verbatim.
    expect(screen.queryByText(/agent:hermes/)).toBeNull();
  });
});
