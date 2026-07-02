"use client";

/**
 * Project insights — who's doing the work and how it's going, from the
 * board's tasks alone (no extra reads): task-distribution donut per agent,
 * a success-rate stat, and per-agent progress bars.
 */

import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import type { Task } from "../lib/perkosApi";
import { agentColor, BarList, DonutChart } from "./charts";

export function ProjectInsights({ tasks }: { tasks: Task[] }) {
  const { t } = useTranslation();
  const { segments, bars, done, total } = useMemo(() => {
    const byAgent = new Map<string, { total: number; done: number }>();
    let doneCount = 0;
    for (const task of tasks) {
      const agent = task.agent?.trim() || "Unassigned";
      const entry = byAgent.get(agent) ?? { total: 0, done: 0 };
      entry.total += 1;
      if (task.status === "Done") {
        entry.done += 1;
        doneCount += 1;
      }
      byAgent.set(agent, entry);
    }
    const sorted = [...byAgent.entries()].sort((a, b) => b[1].total - a[1].total);
    const displayName = (name: string) =>
      name === "Unassigned" ? t("components.insights.unassigned") : name;
    return {
      segments: sorted.map(([name, v]) => ({
        label: displayName(name),
        value: v.total,
        color: name === "Unassigned" ? "#3f3a5e" : agentColor(name),
      })),
      bars: sorted.map(([name, v]) => ({
        label: displayName(name),
        value: v.done,
        color: name === "Unassigned" ? "#3f3a5e" : agentColor(name),
        hint: `/${v.total}`,
      })),
      done: doneCount,
      total: tasks.length,
    };
  }, [tasks, t]);

  if (total === 0) return null;
  const rate = Math.round((done / total) * 100);

  return (
    <section className="glow-card flex flex-col gap-4 rounded-lg border border-primary/25 bg-card/60 px-4 py-4">
      <header className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-foreground">
          {t("components.insights.teamWorkload")}
        </h2>
        <span
          className="rounded-full border px-2 py-0.5 font-mono text-[10px]"
          style={{
            color: rate >= 60 ? "#6ee7b7" : "#fcd34d",
            borderColor: rate >= 60 ? "rgba(16,185,129,.4)" : "rgba(245,158,11,.4)",
            background: rate >= 60 ? "rgba(16,185,129,.08)" : "rgba(245,158,11,.08)",
          }}
        >
          {t("components.insights.percentComplete", { rate })}
        </span>
      </header>

      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
        <DonutChart
          segments={segments}
          centerValue={String(total)}
          centerLabel={t("components.insights.taskLabel", { count: total })}
          size={150}
        />
        <div className="flex w-full min-w-0 flex-1 flex-col gap-2">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {t("components.insights.donePerAgent")}
          </span>
          <BarList rows={bars} />
        </div>
      </div>
    </section>
  );
}
