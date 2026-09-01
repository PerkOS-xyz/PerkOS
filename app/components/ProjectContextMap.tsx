"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { Expand, GitBranch, Loader2, Minimize2, Network } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Task } from "../lib/perkosApi";
import type { Project } from "../lib/perkosApi";
import type { AgentLiveStatus } from "../lib/useWalletAgents";
import { agentColor } from "./charts";

const W = 920;
const H = 520;
const CX = W / 2;
const CY = H / 2;
const MAX_TASKS = 18;

export type GraphNode = {
  key: string;
  kind: "project" | "agent" | "task" | "source" | "gate";
  label: string;
  x: number;
  y: number;
  href?: string;
  status?: string;
  isPM?: boolean;
  live?: AgentLiveStatus;
  shape?: "sphere" | "agent-block" | "task-block";
  fx?: number;
  fy?: number;
  fz?: number;
};

export type GraphEdge = { from: string; to: string; color: string; dashed?: boolean; active?: boolean };

const InteractiveGraph3D = dynamic(
  () => import("./InteractiveGraph3D").then((module) => module.InteractiveGraph3D),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-[360px] place-items-center rounded-lg border border-border bg-[#07030d] sm:h-[460px]">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    ),
  },
);

type CommonProps = {
  projectId: string;
  projectName: string;
  pmAgent?: string | null;
  tasks: Task[];
  liveAgents: Record<string, AgentLiveStatus>;
};

/** Persistent project context. It deliberately does not imply runtime flow. */
export function ProjectKnowledgeGraph({
  projectId,
  projectName,
  pmAgent,
  agentNames,
  tasks,
  liveAgents,
  externalSystems = [],
}: CommonProps & { agentNames: string[]; externalSystems?: string[] }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);

  const { nodes, edges, hiddenTasks } = useMemo(() => {
    const nodes: GraphNode[] = [{ key: "project", kind: "project", label: projectName, x: CX, y: CY }];
    const edges: GraphEdge[] = [];
    const orderedAgents = [
      ...agentNames.filter((name) => name === pmAgent),
      ...agentNames.filter((name) => name !== pmAgent),
    ].slice(0, 10);
    const eligibleTasks = tasks.filter((task) => showCompleted || task.status !== "Done");
    const visibleTasks = eligibleTasks
      .sort((a, b) => Date.parse(b.updatedAt ?? "") - Date.parse(a.updatedAt ?? ""))
      .slice(0, MAX_TASKS);
    const agentR = Math.min(165, 110 + orderedAgents.length * 8);

    orderedAgents.forEach((name, index) => {
      const angle = -Math.PI / 2 + (index / Math.max(orderedAgents.length, 1)) * 2 * Math.PI;
      const key = `agent:${name}`;
      nodes.push({ key, kind: "agent", label: name, x: CX + agentR * Math.cos(angle), y: CY + agentR * Math.sin(angle), isPM: name === pmAgent, live: liveAgents[name] });
      edges.push({ from: "project", to: key, color: agentColor(name, 0.42) });
    });

    visibleTasks.forEach((task, index) => {
      if (!task.id) return;
      const angle = -Math.PI / 2 + (index / Math.max(visibleTasks.length, 1)) * 2 * Math.PI + 0.14;
      const key = `task:${task.id}`;
      nodes.push({
        key,
        kind: "task",
        label: task.name,
        status: String(task.status),
        x: CX + 235 * Math.cos(angle),
        y: CY + 235 * Math.sin(angle),
        href: `/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(task.id)}`,
      });
      const ownerKey = task.agent?.trim() && orderedAgents.includes(task.agent.trim()) ? `agent:${task.agent.trim()}` : "project";
      edges.push({
        from: ownerKey,
        to: key,
        color: ownerKey === "project" ? "rgba(121,117,168,.28)" : agentColor(task.agent.trim(), 0.34),
        dashed: task.status === "Done",
      });
    });

    externalSystems.slice(0, 4).forEach((system, index) => {
      const key = `source:${system}`;
      nodes.push({ key, kind: "source", label: system, x: 115 + index * 180, y: H - 32 });
      edges.push({ from: key, to: "project", color: "rgba(56,189,248,.42)", dashed: true });
    });
    return { nodes, edges, hiddenTasks: Math.max(0, eligibleTasks.length - visibleTasks.length) };
  }, [agentNames, externalSystems, liveAgents, pmAgent, projectId, projectName, showCompleted, tasks]);

  return (
    <GraphSurface
      title={t("components.knowledgeGraph.title")}
      description={t("components.knowledgeGraph.description")}
      expanded={expanded}
      onExpandedChange={setExpanded}
      toolbar={
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={showCompleted} onChange={(event) => setShowCompleted(event.target.checked)} className="accent-primary" />
          {t("components.knowledgeGraph.showCompleted")}
        </label>
      }
    >
      {agentNames.length === 0 && tasks.length === 0 ? (
        <GraphEmpty text={t("components.knowledgeGraph.empty")} />
      ) : (
        <GraphCanvas nodes={nodes} edges={edges} ariaLabel={t("components.knowledgeGraph.ariaLabel")} expanded={expanded} />
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted-foreground">
        <span>{t("components.knowledgeGraph.legend")}</span>
        <span>
          {externalSystems.length > 0
            ? t("components.knowledgeGraph.connectedSources", { count: externalSystems.length })
            : t("components.knowledgeGraph.noSources")}
          {hiddenTasks > 0 ? t("components.knowledgeGraph.hiddenTasks", { count: hiddenTasks }) : ""}
        </span>
      </div>
    </GraphSurface>
  );
}

/** Runtime-oriented graph derived from the current orchestration state. */
export function ProjectExecutionGraph({ projectId, projectName, pmAgent, workflowPhase, tasks, liveAgents }: CommonProps & { workflowPhase?: string }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const relevantTasks = useMemo(() => tasks.filter((task) => task.id).slice(0, MAX_TASKS), [tasks]);
  const { nodes, edges } = useMemo(() => {
    const nodes: GraphNode[] = [{ key: "goal", kind: "project", label: projectName, x: 90, y: CY, fx: -250, fy: 0, fz: 0 }];
    const edges: GraphEdge[] = [];
    const coordinatorKey = pmAgent ? `agent:${pmAgent}` : "gate:unassigned";
    nodes.push({ key: coordinatorKey, kind: pmAgent ? "agent" : "gate", label: pmAgent || t("components.executionGraph.unassignedLead"), x: 290, y: CY, isPM: Boolean(pmAgent), live: pmAgent ? liveAgents[pmAgent] : undefined, shape: pmAgent ? "agent-block" : "sphere", fx: -85, fy: 0, fz: 0 });
    edges.push({ from: "goal", to: coordinatorKey, color: "rgba(236,27,105,.58)", active: workflowPhase === "planning" });

    const workerNames = [...new Set(relevantTasks.map((task) => task.agent?.trim() || "unassigned"))];
    workerNames.forEach((name, index) => {
      if (name === pmAgent) return;
      const centeredIndex = index - (workerNames.length - 1) / 2;
      const y = 65 + (index / Math.max(workerNames.length - 1, 1)) * (H - 130);
      const workerKey = `agent:${name}`;
      nodes.push({ key: workerKey, kind: name === "unassigned" ? "gate" : "agent", label: name === "unassigned" ? t("components.executionGraph.unassignedWorker") : name, x: 485, y, live: name === "unassigned" ? undefined : liveAgents[name], shape: name === "unassigned" ? "sphere" : "agent-block", fx: 70, fy: centeredIndex * 78, fz: index % 2 === 0 ? -28 : 28 });
      edges.push({
        from: coordinatorKey,
        to: workerKey,
        color: agentColor(name, 0.42),
        active: relevantTasks.some((task) => task.agent?.trim() === name && (task.status === "In progress" || task.status === "Review")),
      });
    });

    relevantTasks.forEach((task, index) => {
      if (!task.id) return;
      const ownerTasks = relevantTasks.filter((candidate) => (candidate.agent?.trim() || "unassigned") === (task.agent?.trim() || "unassigned"));
      const ownerIndex = ownerTasks.findIndex((candidate) => candidate.id === task.id);
      const workerIndex = workerNames.indexOf(task.agent?.trim() || "unassigned");
      const y = 42 + (index / Math.max(relevantTasks.length - 1, 1)) * (H - 84);
      const workerKey = `agent:${task.agent?.trim() || "unassigned"}`;
      const taskKey = `task:${task.id}`;
      nodes.push({ key: taskKey, kind: task.status === "Review" ? "gate" : "task", label: task.name, status: String(task.status), x: 780, y, href: `/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(task.id)}`, shape: "task-block", fx: 245 + ownerIndex * 28, fy: (workerIndex - (workerNames.length - 1) / 2) * 78 + (ownerIndex - (ownerTasks.length - 1) / 2) * 24, fz: ownerIndex % 2 === 0 ? -34 : 34 });
      const active = task.status === "In progress" || task.status === "Review";
      edges.push({ from: workerKey, to: taskKey, color: agentColor(task.agent || task.name, 0.72), dashed: task.status === "Done", active });
    });
    return { nodes, edges };
  }, [liveAgents, pmAgent, projectId, projectName, relevantTasks, t, workflowPhase]);

  return (
    <GraphSurface
      title={t("components.executionGraph.title")}
      description={t("components.executionGraph.description")}
      expanded={expanded}
      onExpandedChange={setExpanded}
      badge={workflowPhase ? t("components.executionGraph.phase", { phase: workflowPhase }) : undefined}
    >
      {relevantTasks.length === 0 ? (
        <GraphEmpty text={t("components.executionGraph.empty")} execution />
      ) : (
        <GraphCanvas nodes={nodes} edges={edges} ariaLabel={t("components.executionGraph.ariaLabel")} expanded={expanded} />
      )}
      <p className="text-[10px] text-muted-foreground">{t("components.executionGraph.telemetryNote")}</p>
    </GraphSurface>
  );
}

/** Organization-level knowledge: people, projects and agents, clustered around the active org. */
export function OrganizationKnowledgeGraph({
  organizationName,
  ownerWallet,
  projects,
  agents,
  externalSystems = [],
}: {
  organizationName: string;
  ownerWallet?: string | null;
  projects: Project[];
  agents: { name: string }[];
  externalSystems?: string[];
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const { nodes, edges } = useMemo(() => {
    const nodes: GraphNode[] = [{ key: "org", kind: "project", label: organizationName, x: CX, y: CY }];
    const edges: GraphEdge[] = [];
    const visibleProjects = projects.slice(0, 8);
    visibleProjects.forEach((project, index) => {
      const angle = -Math.PI / 2 + (index / Math.max(visibleProjects.length, 1)) * Math.PI * 2;
      const key = `project:${project.id || project.name}`;
      nodes.push({
        key,
        kind: "project",
        label: project.name,
        x: CX + 175 * Math.cos(angle),
        y: CY + 175 * Math.sin(angle),
        href: project.id ? `/projects/${encodeURIComponent(project.id)}` : undefined,
        status: project.status,
      });
      edges.push({ from: "org", to: key, color: "rgba(236,27,105,.42)" });
    });
    agents.slice(0, 10).forEach((agent, index) => {
      const project = visibleProjects.find((candidate) => candidate.agentIds?.includes(agent.name));
      const angle = -Math.PI / 2 + (index / Math.max(Math.min(agents.length, 10), 1)) * Math.PI * 2 + 0.2;
      const key = `agent:${agent.name}:${index}`;
      nodes.push({ key, kind: "agent", label: agent.name, x: CX + 245 * Math.cos(angle), y: CY + 245 * Math.sin(angle) });
      edges.push({ from: project ? `project:${project.id || project.name}` : "org", to: key, color: agentColor(agent.name, 0.36), dashed: !project });
    });
    if (ownerWallet) {
      nodes.push({ key: "owner", kind: "gate", label: `${ownerWallet.slice(0, 6)}…${ownerWallet.slice(-4)}`, x: 84, y: 55 });
      edges.push({ from: "owner", to: "org", color: "rgba(167,139,250,.42)" });
    }
    externalSystems.slice(0, 4).forEach((system, index) => {
      const key = `source:${system}`;
      nodes.push({ key, kind: "source", label: system, x: W - 80, y: 75 + index * 100 });
      edges.push({ from: key, to: "org", color: "rgba(56,189,248,.42)", dashed: true });
    });
    return { nodes, edges };
  }, [agents, externalSystems, organizationName, ownerWallet, projects]);

  return (
    <GraphSurface
      title={t("components.organizationGraph.title")}
      description={t("components.organizationGraph.description")}
      expanded={expanded}
      onExpandedChange={setExpanded}
      badge={t("components.organizationGraph.projects", { count: projects.length })}
    >
      {projects.length === 0 && agents.length === 0 ? (
        <GraphEmpty text={t("components.organizationGraph.empty")} />
      ) : (
        <GraphCanvas nodes={nodes} edges={edges} ariaLabel={t("components.organizationGraph.ariaLabel")} expanded={expanded} />
      )}
      <p className="text-[10px] text-muted-foreground">
        {externalSystems.length > 0
          ? t("components.organizationGraph.connectedSources", { count: externalSystems.length })
          : t("components.organizationGraph.noSources")}
      </p>
    </GraphSurface>
  );
}

/** Compatibility export for older imports. */
export const ProjectContextMap = ProjectKnowledgeGraph;

function GraphSurface({ title, description, expanded, onExpandedChange, toolbar, badge, children }: {
  title: string;
  description: string;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  toolbar?: React.ReactNode;
  badge?: string;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <section className={cn("flex min-w-0 flex-col gap-3 rounded-xl border border-primary/25 bg-card/65 p-3 shadow-[0_0_32px_-24px_rgba(236,27,105,.9)] sm:p-4", expanded && "fixed inset-2 z-50 bg-background/98 shadow-2xl backdrop-blur md:inset-6")}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Network className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground sm:text-base">{title}</h2>
            {badge ? <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[10px] text-primary">{badge}</span> : null}
          </div>
          <p className="mt-1 max-w-3xl text-xs text-muted-foreground">{description}</p>
        </div>
        <div className="flex items-center gap-3">
          {toolbar}
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => onExpandedChange(!expanded)} aria-label={expanded ? t("components.graph.close") : t("components.graph.expand")}>
            {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Expand className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{expanded ? t("components.graph.close") : t("components.graph.expand")}</span>
          </Button>
        </div>
      </header>
      <div className={cn("min-h-0", expanded && "flex-1")}>{children}</div>
    </section>
  );
}

function GraphCanvas({ nodes, edges, ariaLabel, expanded }: { nodes: GraphNode[]; edges: GraphEdge[]; ariaLabel: string; expanded: boolean }) {
  return (
    <InteractiveGraph3D nodes={nodes} edges={edges} ariaLabel={ariaLabel} expanded={expanded} />
  );
}

function GraphEmpty({ text, execution = false }: { text: string; execution?: boolean }) {
  const Icon = execution ? GitBranch : Network;
  return (
    <div className="grid min-h-56 place-items-center rounded-lg border border-dashed border-border bg-background/30 px-6 text-center">
      <div className="flex max-w-md flex-col items-center gap-3"><Icon className="h-8 w-8 text-primary/70" /><p className="text-sm text-muted-foreground">{text}</p></div>
    </div>
  );
}
