import type { Project, Task } from "./perkosApi";

export function pendingProjectPlans(projects: readonly Project[], canReview: boolean) {
  return canReview ? projects.filter((project) =>
    Boolean(project.id && project.workflow?.planId) && project.workflow?.phase === "awaiting_approval",
  ) : [];
}

export function projectTaskAttention(tasks: readonly Task[]) {
  return tasks.flatMap((task) => {
    if (!task.id || task.status === "Done") return [];
    const kind = task.status === "Review" ? "review" : task.dispatchStuck ? "blocked"
      : task.dispatchState === "retrying" ? "retrying" : null;
    return kind ? [{ task, kind }] : [];
  });
}

export function taskDetailHref(projectId: string, taskId: string, owner?: string) {
  const path = `/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}`;
  return owner ? `${path}?owner=${encodeURIComponent(owner)}` : path;
}
