import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authedFetch: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock("../app/lib/apiClient", () => ({ authedFetch: mocks.authedFetch }));
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }));

import { markTaskRetried, TaskRetryButton } from "../app/components/TaskRetryButton";
import { PendingDeliverable } from "../app/components/TaskDetailLayout";
import { taskSignal } from "../app/components/TaskSignal";
import { retryTask, type ProjectDetail, type Task } from "../app/lib/perkosApi";

const OWNER = "0x00000000000000000000000000000000000000aa";
const EDITOR = "0x00000000000000000000000000000000000000bb";

const pausedTask: Task = {
  id: "t1",
  name: "Write the launch post",
  status: "In progress",
  priority: "High",
  agent: "Athena",
  dispatchStuck: true,
  dispatchState: "failed",
  dispatchAttempts: 4,
  lastDispatchError: "Runtime delivery attempts exhausted.",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function retried(extra: Record<string, unknown> = {}) {
  return json({
    ok: true,
    task: { ...pausedTask, status: "Backlog", dispatchState: "queued", dispatchStuck: undefined },
    retry: { agent: "Athena", waitingOnDependency: false, workflowResumed: true },
    ...extra,
  });
}

function setup(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const detail = (): ProjectDetail => ({
    project: { id: "p1", name: "Launch" } as ProjectDetail["project"],
    tasks: [pausedTask, { id: "t2", name: "Other", status: "Backlog", priority: "Low", agent: "Hermes" }],
    messages: [],
  });
  // The board keys the project by its owner; a member's own pages by caller.
  client.setQueryData(["wallet-project", OWNER, "p1"], detail());
  client.setQueryData(["wallet-project", EDITOR, "p1"], detail());
  render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
  return client;
}

beforeEach(() => {
  mocks.authedFetch.mockReset();
  mocks.success.mockReset();
  mocks.error.mockReset();
});

describe("retryTask", () => {
  it("retries on the owner's board and reports who picks it up", async () => {
    mocks.authedFetch.mockResolvedValue(retried());

    const result = await retryTask({ walletAddress: OWNER, projectId: "p 1", taskId: "t/1" });

    expect(mocks.authedFetch).toHaveBeenCalledWith(
      `/api/projects/p%201/tasks/t%2F1/retry?owner=${OWNER}`,
      { method: "POST" },
    );
    expect(result).toMatchObject({ agent: "Athena", waitingOnDependency: false, workflowResumed: true });
    expect(result.task?.status).toBe("Backlog");
  });

  it("reads the task when an older API answers without retry details", async () => {
    mocks.authedFetch.mockResolvedValue(
      json({ ok: true, task: { ...pausedTask, status: "Backlog", dispatchState: "waiting_on_dependency" } }),
    );

    const result = await retryTask({ walletAddress: OWNER, projectId: "p1", taskId: "t1" });

    expect(result).toMatchObject({ agent: "Athena", waitingOnDependency: true, workflowResumed: false });
  });

  it("surfaces the API's own message", async () => {
    mocks.authedFetch.mockResolvedValue(
      json({ error: { code: "CONFLICT", message: "completed tasks cannot be retried" } }, 409),
    );

    await expect(retryTask({ walletAddress: OWNER, projectId: "p1", taskId: "t1" })).rejects.toThrow(
      "completed tasks cannot be retried",
    );
  });
});

describe("markTaskRetried", () => {
  it("takes the task out of its paused state and leaves the others alone", () => {
    const [task, other] = markTaskRetried(
      [pausedTask, { id: "t2", name: "Other", status: "Backlog", priority: "Low", agent: "Hermes" }],
      "t1",
      { agent: "Athena", waitingOnDependency: true, workflowResumed: false },
    );
    expect(task).toMatchObject({ status: "Backlog", dispatchState: "waiting_on_dependency" });
    expect(task?.dispatchStuck).toBeUndefined();
    expect(task?.lastDispatchError).toBeUndefined();
    expect(taskSignal(task!)).toBe("waiting");
    expect(other?.name).toBe("Other");
  });
});

describe("TaskRetryButton", () => {
  it("retries from a board card without opening the task", async () => {
    mocks.authedFetch.mockResolvedValue(retried());
    const client = setup(
      <a href="#task-t1">
        <TaskRetryButton
          variant="card"
          walletAddress={OWNER}
          projectId="p1"
          taskId="t1"
          taskName="Write the launch post"
          agent="Athena"
        />
      </a>,
    );

    const button = screen.getByRole("button", { name: "Retry Write the launch post with Athena" });
    expect(button).toHaveTextContent("Retry");
    // A prevented click is how the card's link stays closed.
    expect(fireEvent.click(button)).toBe(false);

    await waitFor(() =>
      expect(mocks.success).toHaveBeenCalledWith(
        "Retrying with Athena",
        expect.objectContaining({ description: undefined }),
      ),
    );
    expect(mocks.authedFetch).toHaveBeenCalledTimes(1);
    // Every cached copy of the project drops the paused state at once.
    for (const wallet of [OWNER, EDITOR]) {
      const task = client
        .getQueryData<ProjectDetail>(["wallet-project", wallet, "p1"])
        ?.tasks.find((t) => t.id === "t1");
      expect(task).toMatchObject({ status: "Backlog", dispatchState: "queued" });
      expect(taskSignal(task!)).toBeNull();
    }
  });

  it("names the agent on the task page and explains a wait on earlier steps", async () => {
    mocks.authedFetch.mockResolvedValue(
      retried({ retry: { agent: "Athena", waitingOnDependency: true, workflowResumed: true } }),
    );
    setup(
      <TaskRetryButton
        walletAddress={OWNER}
        projectId="p1"
        taskId="t1"
        taskName="Write the launch post"
        agent="Athena"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Retry with Athena/ }));

    await waitFor(() =>
      expect(mocks.success).toHaveBeenCalledWith(
        "Retrying with Athena",
        expect.objectContaining({
          description: "It starts as soon as the steps before it are done.",
        }),
      ),
    );
  });

  it("keeps the task paused and says so when the retry does not go through", async () => {
    mocks.authedFetch.mockResolvedValue(
      json({ error: { code: "FORBIDDEN", message: "not authorized to retry this task this project" } }, 403),
    );
    const client = setup(
      <TaskRetryButton
        walletAddress={OWNER}
        projectId="p1"
        taskId="t1"
        taskName="Write the launch post"
        agent="Athena"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Retry with Athena/ }));

    await waitFor(() =>
      expect(mocks.error).toHaveBeenCalledWith("Couldn't start the retry", {
        description: "not authorized to retry this task this project",
      }),
    );
    const task = client
      .getQueryData<ProjectDetail>(["wallet-project", OWNER, "p1"])
      ?.tasks.find((t) => t.id === "t1");
    expect(taskSignal(task!)).toBe("paused");
    expect(screen.getByRole("button", { name: /Retry with Athena/ })).toBeEnabled();
  });

  it("asks for a wallet before calling the API", async () => {
    setup(
      <TaskRetryButton walletAddress={null} projectId="p1" taskId="t1" taskName="Write the launch post" />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() =>
      expect(mocks.error).toHaveBeenCalledWith("Couldn't start the retry", {
        description: "Connect your wallet to retry this task.",
      }),
    );
    expect(mocks.authedFetch).not.toHaveBeenCalled();
  });
});

describe("PendingDeliverable retry action", () => {
  it("offers the retry only once the task is paused", () => {
    const action = <button type="button">Retry with Athena</button>;
    const { rerender } = render(
      <PendingDeliverable
        status="In progress"
        progress={{ dispatchState: "retrying", dispatchAttempts: 2 }}
        retryAction={action}
      />,
    );
    expect(screen.queryByRole("button", { name: "Retry with Athena" })).toBeNull();

    rerender(
      <PendingDeliverable
        status="In progress"
        progress={{ dispatchStuck: true, dispatchState: "failed", dispatchAttempts: 4 }}
        retryAction={action}
      />,
    );
    expect(screen.getByText("The agent could not finish this task")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry with Athena" })).toBeInTheDocument();
  });
});
