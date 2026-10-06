"use client";

import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";
import { AgentOrb } from "./AgentOrb";
import { agentHue } from "./CoordinationRow";

/**
 * Who owns a task, readable at a glance on a board card: the assignee's orb
 * (the same one its seat and its conversation bubbles show) and its name in
 * the orb's hue. An open task shows an empty dashed seat instead.
 */
export function TaskAssignee({
  agent,
  className,
}: {
  agent?: string | null;
  className?: string;
}) {
  const { t } = useTranslation();
  const name = agent?.trim();

  if (!name) {
    return (
      <span className={cn("inline-flex min-w-0 items-center gap-1.5", className)}>
        <span
          aria-hidden
          className="h-6 w-6 shrink-0 rounded-full border border-dashed border-white/20"
        />
        <span className="truncate">{t("projectRoom.taskCard.unassigned")}</span>
      </span>
    );
  }

  return (
    <span
      className={cn("inline-flex min-w-0 items-center gap-1.5", className)}
      title={t("projectRoom.taskCard.agent", { agent: name })}
    >
      <AgentOrb name={name} size={24} />
      <span className="truncate font-medium" style={{ color: agentHue(name, 0.95) }}>
        {name}
      </span>
    </span>
  );
}
