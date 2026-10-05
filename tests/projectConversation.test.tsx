import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ConversationMessages } from "../app/components/ConversationMessages";
import { CoordinationRow } from "../app/components/CoordinationRow";
import { toCoordinationMessage, type CoordinationMessage } from "../app/lib/useCoordinationLog";

const at = (iso: string) => ({ toDate: () => new Date(iso) });

function entry(id: string, data: Record<string, unknown>): CoordinationMessage {
  const message = toCoordinationMessage(id, "p1", data);
  if (!message) throw new Error("invalid fixture");
  return message;
}

describe("toCoordinationMessage", () => {
  it("maps a log entry onto a timed thread message", () => {
    const m = entry("a1", { from: "sparky", to: "agent:Seoul-Beans-Content-Writer", kind: "assignment", taskId: "t2", text: "Build the calendar", ts: at("2026-10-05T01:02:00Z") });
    expect(m).toMatchObject({
      id: "coordination:a1",
      from: "service:sparky",
      text: "Build the calendar",
      timestamp: "2026-10-05T01:02:00.000Z",
      coordination: { kind: "assignment", to: "agent:Seoul-Beans-Content-Writer", taskId: "t2" },
    });
  });

  it("drops unknown kinds and empty text", () => {
    expect(toCoordinationMessage("x", "p1", { kind: "nope", text: "hi" })).toBeNull();
    expect(toCoordinationMessage("y", "p1", { kind: "system", text: "  " })).toBeNull();
  });
});

describe("CoordinationRow", () => {
  it("shows Sparky addressing a teammate", () => {
    render(<CoordinationRow message={entry("a", { from: "sparky", to: "agent:Seoul-Beans-SEO-Specialist", kind: "assignment", text: "Find the keywords", ts: at("2026-10-05T01:00:00Z") })} />);
    expect(screen.getByText("Sparky")).toBeInTheDocument();
    expect(screen.getByText("@Seoul-Beans-SEO-Specialist")).toBeInTheDocument();
    expect(screen.getByText("Find the keywords")).toBeInTheDocument();
  });

  it("folds a long brief behind a toggle", () => {
    const brief = `Draft the customer FAQ: ${"Cover caffeine, brewing, allergens, shipping and how to choose. ".repeat(6)}`;
    render(<CoordinationRow message={entry("d", { from: "sparky", to: "agent:Harbor-Support", kind: "assignment", text: brief, ts: at("2026-10-05T01:00:00Z") })} />);
    const toggle = screen.getByRole("button", { name: "Show the full brief" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Show less" })).toHaveAttribute("aria-expanded", "true");
  });

  it("keeps a short assignment as is", () => {
    render(<CoordinationRow message={entry("e", { from: "sparky", to: "agent:Harbor-Support", kind: "assignment", text: "Draft the FAQ", ts: at("2026-10-05T01:00:00Z") })} />);
    expect(screen.queryByRole("button", { name: "Show the full brief" })).not.toBeInTheDocument();
  });

  it("links a delivered result to its task", () => {
    render(
      <CoordinationRow
        message={entry("b", { from: "agent:Seoul-Beans-SEO-Specialist", to: "sparky", kind: "result", taskId: "t1", text: "20 keywords ready", ts: at("2026-10-05T01:05:00Z") })}
        taskHref={(id) => `/projects/p1/tasks/${id}`}
      />,
    );
    expect(screen.getByText("Seoul-Beans-SEO-Specialist")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open the result/ })).toHaveAttribute("href", "/projects/p1/tasks/t1");
  });

  it("renders system notes as a centered line", () => {
    render(<CoordinationRow message={entry("c", { from: "system", to: "sparky", kind: "system", text: "Plan approved: 3 tasks on the board.", ok: true, ts: at("2026-10-05T01:01:00Z") })} />);
    expect(screen.getByText("Plan approved: 3 tasks on the board.")).toBeInTheDocument();
  });
});

describe("ConversationMessages with coordination", () => {
  it("interleaves chat and coordination by time", () => {
    const chat = [{ id: "m1", convId: "c", from: "user:0xabc" as const, text: "Launch the cold brew line", timestamp: "2026-10-05T01:00:00.000Z" }];
    const coordination = [
      entry("g", { from: "sparky", to: "agent:Lead", kind: "goal", text: "Plan this project", ts: at("2026-10-05T01:00:30Z") }),
      entry("s", { from: "system", to: "sparky", kind: "system", text: "Plan approved.", ok: true, ts: at("2026-10-05T01:03:00Z") }),
    ];
    render(
      <ConversationMessages
        history={chat}
        live={[]}
        walletAddress="0xabc"
        loadingInitial={false}
        loadingMore={false}
        hasMore={false}
        onLoadOlder={() => {}}
        coordination={coordination}
      />,
    );
    const log = screen.getByRole("log");
    const text = log.textContent ?? "";
    expect(text.indexOf("Launch the cold brew line")).toBeLessThan(text.indexOf("Plan this project"));
    expect(text.indexOf("Plan this project")).toBeLessThan(text.indexOf("Plan approved."));
  });

  it("speaks PerkOS workflow messages as Sparky", () => {
    const chat = [{ id: "w1", convId: "c", from: "service:perkos-api" as const, text: "Plan approved. Starting 3 tasks.", timestamp: "2026-10-05T01:04:00.000Z" }];
    render(
      <ConversationMessages
        history={chat}
        live={[]}
        walletAddress="0xabc"
        loadingInitial={false}
        loadingMore={false}
        hasMore={false}
        onLoadOlder={() => {}}
      />,
    );
    expect(screen.getByText("Sparky")).toBeInTheDocument();
    expect(screen.queryByText(/perkos-api/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/workflow/i)).not.toBeInTheDocument();
  });

  it("says a message waits for an agent that was offline", () => {
    render(
      <ConversationMessages
        history={[]}
        live={[]}
        pending={[{ id: "q1", convId: "c", from: "user:0xabc", text: "Are you there?", timestamp: "2026-10-05T01:05:00.000Z", queued: true }]}
        walletAddress="0xabc"
        loadingInitial={false}
        loadingMore={false}
        hasMore={false}
        onLoadOlder={() => {}}
      />,
    );
    expect(screen.getByText(/delivered when the agent wakes/)).toBeInTheDocument();
  });
});
