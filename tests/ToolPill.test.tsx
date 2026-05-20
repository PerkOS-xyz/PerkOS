import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ToolPill, formatDuration } from "../app/components/ToolPill";
import type { ChatToolCall } from "../app/lib/chatClient";

function call(overrides: Partial<ChatToolCall> = {}): ChatToolCall {
  return {
    id: "t1",
    name: "Bash",
    status: "ok",
    summary: "ls -la",
    input: { command: "ls -la" },
    output: "total 16\ndrwxr-xr-x  3 user  staff   96 May  1 12:00 .",
    ...overrides,
  };
}

describe("ToolPill", () => {
  it("renders the tool name and summary inline", () => {
    render(<ToolPill call={call()} />);
    expect(screen.getByText("Bash")).toBeInTheDocument();
    expect(screen.getByText("ls -la")).toBeInTheDocument();
  });

  it("hides the expanded panel by default", () => {
    render(<ToolPill call={call()} />);
    expect(screen.queryByText(/total 16/)).toBeNull();
  });

  it("expands to show input and output on click", async () => {
    render(<ToolPill call={call()} />);
    await userEvent.click(screen.getByRole("button"));
    // Headers
    expect(screen.getByText("input")).toBeInTheDocument();
    expect(screen.getByText("output")).toBeInTheDocument();
    // Output content
    expect(screen.getByText(/total 16/)).toBeInTheDocument();
    // Input shows JSON-stringified object
    expect(screen.getByText(/"command": "ls -la"/)).toBeInTheDocument();
  });

  it("collapses again on a second click", async () => {
    render(<ToolPill call={call()} />);
    const btn = screen.getByRole("button");
    await userEvent.click(btn);
    expect(screen.getByText(/total 16/)).toBeInTheDocument();
    await userEvent.click(btn);
    expect(screen.queryByText(/total 16/)).toBeNull();
  });

  it("renders an error block when status is error", async () => {
    render(
      <ToolPill
        call={call({ status: "error", error: "exit code 1", output: undefined })}
      />,
    );
    await userEvent.click(screen.getByRole("button"));
    expect(screen.getByText("error")).toBeInTheDocument();
    expect(screen.getByText("exit code 1")).toBeInTheDocument();
  });

  it("disables the toggle when there is no detail to show", () => {
    render(
      <ToolPill
        call={{ id: "x", name: "Search", status: "ok", summary: "go" }}
      />,
    );
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("displays the duration badge when present", () => {
    render(<ToolPill call={call({ durationMs: 1234 })} />);
    expect(screen.getByText("1.2s")).toBeInTheDocument();
  });

  it("uses a loading spinner indicator while status is running", () => {
    const { container } = render(<ToolPill call={call({ status: "running" })} />);
    expect(container.querySelector(".animate-spin")).not.toBeNull();
  });
});

describe("formatDuration", () => {
  it("renders sub-second values in ms", () => {
    expect(formatDuration(450)).toBe("450ms");
  });
  it("renders sub-minute values with one decimal", () => {
    expect(formatDuration(2500)).toBe("2.5s");
  });
  it("renders multi-minute values in m", () => {
    expect(formatDuration(125_000)).toBe("2m");
  });
  it("returns empty string for invalid input", () => {
    expect(formatDuration(NaN)).toBe("");
    expect(formatDuration(-10)).toBe("");
  });
});
