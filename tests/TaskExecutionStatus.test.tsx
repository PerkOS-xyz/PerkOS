import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { TaskExecutionStatus, executionPresentation, friendlyDispatchError } from "../app/components/TaskExecutionStatus";

const base = { name: "Task", status: "Backlog", priority: "Medium", agent: "Worker" } as const;
afterEach(cleanup);

it("maps dispatcher states to user-facing execution states", () => {
  expect(executionPresentation({ ...base, dispatchState: "starting" }).label).toBe("Starting agent");
  expect(executionPresentation({ ...base, status: "In progress" }).label).toBe("Working");
  expect(executionPresentation({ ...base, dispatchStuck: true }).canRetry).toBe(true);
  expect(executionPresentation({ ...base, status: "Done" }).label).toBe("Completed");
});

it("offers retry only for a terminal dispatch failure", () => {
  const retry = vi.fn();
  render(<TaskExecutionStatus task={{ ...base, dispatchState: "failed" }} retrying={false} onRetry={retry} />);
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(retry).toHaveBeenCalledOnce();
});

it("turns provider timeouts into actionable product copy", () => {
  const raw = 'Runtime delivery failed (408) at http://127.0.0.1:3000/v1/chat/completions: {"error":"upstream provider timeout"}';
  expect(friendlyDispatchError(raw)).toBe("The agent took too long to respond. Retry the task to continue.");

  render(<TaskExecutionStatus task={{ ...base, dispatchState: "failed", lastDispatchError: raw }} retrying={false} onRetry={() => {}} />);
  expect(screen.getByText("The agent took too long to respond. Retry the task to continue.")).toBeInTheDocument();
  expect(screen.queryByText(/127\.0\.0\.1|upstream provider/i)).not.toBeInTheDocument();
});

it("uses safe copy for unavailable and unknown technical failures", () => {
  expect(friendlyDispatchError("Hermes returned 503 service unavailable")).toBe(
    "The assigned agent is temporarily unavailable. Retry the task when it is ready.",
  );
  expect(friendlyDispatchError("unexpected transport protocol violation")).toBe(
    "The task could not be delivered to the assigned agent. You can safely retry it.",
  );
});
