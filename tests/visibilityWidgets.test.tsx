import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { KpiStrip } from "../app/components/KpiStrip";
import { WaitingOnYouCard } from "../app/components/WaitingOnYouCard";
import { ProvisionPipeline } from "../app/components/ProvisionPipeline";
import { PmSessionBanner } from "../app/components/PmSessionBanner";
import { ProjectInsights } from "../app/components/ProjectInsights";
import { ModelUsagePanel } from "../app/components/ModelUsagePanel";
import type { Agent, PmSession, Task } from "../app/lib/perkosApi";

// next/link renders fine in jsdom via a plain anchor.
import { vi } from "vitest";
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={typeof href === "string" ? href : "#"}>{children}</a>
  ),
}));

describe("KpiStrip", () => {
  it("renders the four owner KPIs with deep links", () => {
    render(
      <KpiStrip
        online={3}
        agentsTotal={4}
        inFlight={2}
        needsAttention={1}
        doneThisWeek={14}
      />,
    );
    expect(screen.getByText("3/4")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("14")).toBeInTheDocument();
    expect(screen.getByText(/Agents online/i)).toBeInTheDocument();
    expect(screen.getByText(/Needs attention/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Done this week/i }),
    ).toHaveAttribute("href", "/tasks?status=done");
  });

  it("shows placeholders while loading", () => {
    render(
      <KpiStrip
        online={0}
        agentsTotal={0}
        inFlight={0}
        needsAttention={0}
        doneThisWeek={0}
        isLoading
      />,
    );
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(3);
  });
});

describe("WaitingOnYouCard", () => {
  it("celebrates the empty state", () => {
    render(<WaitingOnYouCard items={[]} />);
    expect(screen.getByText(/All caught up/i)).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("lists items with hints and links", () => {
    render(
      <WaitingOnYouCard
        items={[
          {
            key: "1",
            kind: "plan",
            label: "Plan awaiting your approval",
            hint: "Proposed by Maya",
            href: "/projects/p1?tab=docs",
          },
          {
            key: "2",
            kind: "agent-failed",
            label: "Researcher failed to start",
            href: "/agents/a1",
          },
        ]}
      />,
    );
    expect(screen.getByText("Plan awaiting your approval")).toBeInTheDocument();
    expect(screen.getByText("Proposed by Maya")).toBeInTheDocument();
    expect(screen.getByText("Researcher failed to start")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });
});

describe("ProvisionPipeline", () => {
  it("highlights infrastructure while provisioning", () => {
    render(<ProvisionPipeline status="provisioning" />);
    expect(screen.getByText(/1\. Provisioning infrastructure/)).toBeInTheDocument();
    expect(screen.getByText(/Spinning up the agent/)).toBeInTheDocument();
  });

  it("moves to the boot step once provisioned but not connected", () => {
    render(<ProvisionPipeline status="ready" bridgeConnected={false} />);
    expect(screen.getByText(/2\. Booting the runtime/)).toBeInTheDocument();
    expect(screen.getByText(/Loading the persona/)).toBeInTheDocument();
  });

  it("renders nothing once the bridge connected", () => {
    const { container } = render(
      <ProvisionPipeline status="ready" bridgeConnected />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("marks the failure state", () => {
    render(<ProvisionPipeline status="failed" />);
    expect(screen.getByText(/failed/i)).toBeInTheDocument();
  });
});

describe("PmSessionBanner", () => {
  const session = (over: Partial<PmSession> = {}): PmSession => ({
    status: "working",
    goal: "Launch",
    round: 2,
    taskIds: [],
    maxRounds: 5,
    maxTasksPerRound: 4,
    ...over,
  });

  it("renders nothing without a session", () => {
    const { container } = render(<PmSessionBanner pmAgent="Maya" />);
    expect(container.firstChild).toBeNull();
  });

  it("shows the lead, the phase pipeline, and the round", () => {
    render(<PmSessionBanner session={session()} pmAgent="Maya" />);
    expect(screen.getByText("Maya")).toBeInTheDocument();
    expect(screen.getByText("Plan")).toBeInTheDocument();
    expect(screen.getByText("Work")).toBeInTheDocument();
    expect(screen.getByText("Review")).toBeInTheDocument();
    expect(screen.getByText(/round 2\/5/)).toBeInTheDocument();
  });

  it("shows when the lead last ran", () => {
    render(
      <PmSessionBanner
        session={session({
          lastRunAt: new Date(Date.now() - 3 * 60_000).toISOString(),
        })}
        pmAgent="Maya"
      />,
    );
    expect(screen.getByText(/last run/)).toBeInTheDocument();
  });

  it("translates the no-pm stop reason to team-lead language", () => {
    render(
      <PmSessionBanner
        session={session({ status: "stopped", reason: "no-pm" })}
      />,
    );
    expect(screen.getByText(/No team lead designated/)).toBeInTheDocument();
    expect(screen.getByText("Team lead")).toBeInTheDocument();
  });
});

describe("ProjectInsights", () => {
  const task = (over: Partial<Task>): Task => ({
    id: "t",
    name: "Task",
    status: "Backlog",
    priority: "Medium",
    agent: "Maya",
    ...over,
  });

  it("renders nothing for an empty board", () => {
    const { container } = render(<ProjectInsights tasks={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("computes the completion rate and per-agent rows", () => {
    render(
      <ProjectInsights
        tasks={[
          task({ id: "1", agent: "Maya", status: "Done" }),
          task({ id: "2", agent: "Maya", status: "In progress" }),
          task({ id: "3", agent: "Rex", status: "Done" }),
          task({ id: "4", agent: "" }),
        ]}
      />,
    );
    expect(screen.getByText("50% complete")).toBeInTheDocument();
    expect(screen.getByText("Maya")).toBeInTheDocument();
    expect(screen.getByText("Rex")).toBeInTheDocument();
    expect(screen.getByText("Unassigned")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument(); // donut center
  });
});

describe("ModelUsagePanel", () => {
  const agent = (over: Partial<Agent>): Agent =>
    ({
      id: "a1",
      name: "Maya",
      runtime: "OpenClaw",
      status: "ready",
      walletAddress: "0x1",
      plugins: [],
      ...over,
    }) as Agent;

  it("renders nothing without agents", () => {
    const { container } = render(<ModelUsagePanel agents={[]} tasks={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("shows each agent's brain and done/total counts", () => {
    render(
      <ModelUsagePanel
        agents={[
          agent({ id: "a1", name: "Maya", modelKeyProvided: true }),
          agent({ id: "a2", name: "Rex" }),
        ]}
        tasks={[
          { id: "1", name: "x", status: "Done", priority: "Low", agent: "Maya" },
          { id: "2", name: "y", status: "Backlog", priority: "Low", agent: "Maya" },
        ]}
      />,
    );
    expect(screen.getByText(/Your own model key/)).toBeInTheDocument();
    expect(screen.getByText(/PerkOS LLM/)).toBeInTheDocument();
    expect(screen.getByText("1/2 done")).toBeInTheDocument();
    expect(screen.getByText("0/0 done")).toBeInTheDocument();
  });
});
