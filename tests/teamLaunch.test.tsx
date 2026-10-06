import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const mock = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("../app/lib/apiClient", () => ({ authedFetch: mock.fetch }));

import { TeamLaunchStatus } from "../app/components/TeamLaunchStatus";
import {
  launchTeam,
  newTeamLaunchRequestId,
  readTeamLaunch,
  teamLaunchInProgress,
  type TeamLaunchProgress,
} from "../app/lib/teamLaunch";

const NOW = Date.parse("2026-10-06T12:00:00.000Z");
const ago = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString();

const request = {
  requestId: "req-0001",
  name: "Harbor Tea",
  roles: [{ name: "Harbor-Tea-PM", role: "Project Manager", runtime: "OpenClaw", lead: true }],
};

beforeEach(() => {
  mock.fetch.mockReset();
});

describe("team launch client", () => {
  it("reads the project doc's launch field loosely", () => {
    expect(readTeamLaunch(undefined)).toBeUndefined();
    expect(readTeamLaunch({ status: "weird" })).toBeUndefined();
    expect(
      readTeamLaunch({ status: "partial", total: 3, launched: 2, failed: [{ role: "Writer", name: "W", error: "taken" }, null], updatedAt: ago(1) }),
    ).toEqual({ status: "partial", total: 3, launched: 2, failed: [{ role: "Writer", name: "W", error: "taken" }], updatedAt: ago(1) });
  });

  it("treats a launch with no recent news as over", () => {
    const launch: TeamLaunchProgress = { status: "launching", total: 2, launched: 1, failed: [], updatedAt: ago(2) };
    expect(teamLaunchInProgress(launch, NOW)).toBe(true);
    expect(teamLaunchInProgress({ ...launch, updatedAt: ago(30) }, NOW)).toBe(false);
    expect(teamLaunchInProgress({ ...launch, status: "ready" }, NOW)).toBe(false);
  });

  it("makes a fresh request id each time", () => {
    expect(newTeamLaunchRequestId()).not.toBe(newTeamLaunchRequestId());
    expect(newTeamLaunchRequestId()).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
  });

  it("posts the team once and returns the project id", async () => {
    mock.fetch.mockResolvedValue(new Response(JSON.stringify({ ok: true, projectId: "p-1" }), { status: 202 }));
    await expect(launchTeam(request)).resolves.toEqual({ projectId: "p-1" });
    expect(mock.fetch).toHaveBeenCalledWith("/projects/launch-team", { method: "POST", body: JSON.stringify(request) });
  });

  it("returns null on an API without the endpoint, so the browser can launch instead", async () => {
    mock.fetch.mockResolvedValue(new Response(JSON.stringify({ error: { code: "NOT_FOUND" } }), { status: 404 }));
    await expect(launchTeam(request)).resolves.toBeNull();
  });

  it("surfaces the server's reason when the team cannot launch", async () => {
    mock.fetch.mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'Agent name "Harbor-Tea-PM" is already taken.' } }), { status: 409 }),
    );
    await expect(launchTeam(request)).rejects.toThrow(/already taken/);
  });
});

describe("TeamLaunchStatus", () => {
  it("shows how many teammates are on their way", () => {
    render(<TeamLaunchStatus now={NOW} launch={{ status: "launching", total: 4, launched: 2, failed: [], updatedAt: ago(1) }} />);
    expect(screen.getByRole("status")).toHaveTextContent("Launching your team · 2 of 4 on their way");
  });

  it("names the teammates to add again after a partial launch", () => {
    render(
      <TeamLaunchStatus
        now={NOW}
        launch={{ status: "partial", total: 3, launched: 2, failed: [{ role: "Copywriter", name: "HT-Copy", error: "taken" }], updatedAt: ago(5) }}
      />,
    );
    expect(screen.getByRole("note")).toHaveTextContent("2 of 3 teammates joined. Add Copywriter again anytime from the Agents tab.");
  });

  it("stays out of the way once the team is ready or the news is old", () => {
    const { container, rerender } = render(
      <TeamLaunchStatus now={NOW} launch={{ status: "ready", total: 2, launched: 2, failed: [], updatedAt: ago(1) }} />,
    );
    expect(container).toBeEmptyDOMElement();
    rerender(
      <TeamLaunchStatus
        now={NOW}
        launch={{ status: "failed", total: 1, launched: 0, failed: [{ role: "PM", name: "PM", error: "x" }], updatedAt: ago(48 * 60) }}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
