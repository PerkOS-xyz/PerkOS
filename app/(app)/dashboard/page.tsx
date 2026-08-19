"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAppAccount } from "../../lib/useAppAccount";
import { useAdvancedFeatures } from "../../lib/advancedFeatures";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import {
  Folder,
  ListTodo,
  Bot,
  Plus,
  ArrowRight,
  Loader2,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import {
  createProjectTasks,
  createWalletProject,
  getOrgProjects,
  getWalletOverview,
  type Project,
  type Task,
} from "../../lib/perkosApi";
import { useOnboarding } from "../../lib/onboardingState";
import { useActiveOrg } from "../../lib/useActiveOrg";
import { formatAddress, formatRelativeShort } from "../../lib/format";
import { useActivityFeed } from "../../lib/activityEvents";
import {
  realtimeAgentStatus,
  useWalletAgents,
  STATUS_AVAILABLE,
} from "../../lib/useWalletAgents";
import { ActiveAgentsPanel } from "../../components/ActiveAgentsPanel";
import { AgentOrb } from "../../components/AgentOrb";
import { ActivityFeedCard } from "../../components/ActivityFeedCard";
import { ActivityHeatmap } from "../../components/charts";
import { KpiStrip } from "../../components/KpiStrip";
import { ModelUsagePanel } from "../../components/ModelUsagePanel";
import { BillingCard } from "../../components/BillingCard";
import {
  WaitingOnYouCard,
  type WaitingItem,
} from "../../components/WaitingOnYouCard";

const QUICK_ACTIONS = [
  {
    href: "/projects/new",
    key: "createProject",
    Icon: Folder,
  },
  {
    href: "/tasks/new",
    key: "createTask",
    Icon: ListTodo,
  },
  {
    href: "/agents/new",
    key: "registerAgent",
    Icon: Bot,
  },
];

export default function DashboardPage() {
  const { t } = useTranslation();
  const { address } = useAppAccount();
  const advancedFeatures = useAdvancedFeatures(address);
  const { workspaceName } = useOnboarding();
  const { activeOrg, activeOrgId, defaultOrgId } = useActiveOrg();

  const { data, isLoading, error } = useQuery({
    queryKey: ["wallet-overview", address],
    queryFn: () => getWalletOverview(address!),
    enabled: Boolean(address),
    staleTime: 30_000,
  });

  // Live agent presence + the activity stream feed the KPI strip, the
  // "waiting on you" worklist, and the heatmap.
  const { byName: liveAgents } = useWalletAgents(address);
  const { events } = useActivityFeed(address, 200);

  // Projects scoped to the active org (own OR shared — getOrgProjects reads
  // from the org's owner). Agents/tasks stats stay workspace-wide (own).
  const orgProjectsQuery = useQuery({
    queryKey: ["dash-org-projects", address, activeOrgId],
    queryFn: () =>
      getOrgProjects({
        org: activeOrg!,
        myWallet: address!,
        defaultOrgId: defaultOrgId ?? undefined,
      }),
    enabled: Boolean(address) && Boolean(activeOrg),
    staleTime: 30_000,
  });
  const orgProjects = orgProjectsQuery.data ?? [];

  const stats = data?.stats ?? {
    activeProjects: 0,
    registeredAgents: 0,
    activeTasks: 0,
    completedTasks: 0,
  };
  const projects = orgProjects.slice(0, 5);
  const tasks = (data?.tasks ?? []).slice(0, 5);

  // ---- KPI strip inputs ----------------------------------------------------
  const allAgents = data?.agents ?? [];
  const allTasks = data?.tasks ?? [];
  const online = allAgents.filter(
    (a) => realtimeAgentStatus(liveAgents[a.name]).label === STATUS_AVAILABLE,
  ).length;
  const failedAgents = allAgents.filter((a) =>
    ["failed", "provision-failed", "error"].includes(String(a.status)),
  );
  const reviewTasks = allTasks.filter((task) => task.status === "Review");
  // Anchor "now" to the latest event so the derivation stays pure in render;
  // event timestamps are server-stamped, so the newest one ≈ now.
  const newestTs = events.length > 0 ? events[0].tsMs : 0;
  const weekAgo = newestTs - 7 * 24 * 60 * 60 * 1000;
  const doneThisWeek = events.filter(
    (e) =>
      (e.verb === "completed_task" || e.verb === "goal_done") && e.tsMs >= weekAgo,
  ).length;

  // Plans proposed recently and not yet approved (resolved via later events).
  const approvedProjects = new Set(
    events.filter((e) => e.verb === "approved_plan").map((e) => e.projectId),
  );
  const proposedPlans = events.filter(
    (e) =>
      e.verb === "proposed_plan" &&
      e.tsMs >= weekAgo &&
      !approvedProjects.has(e.projectId),
  );
  const planProjects = [...new Set(proposedPlans.map((e) => e.projectId))].filter(
    (pid): pid is string => Boolean(pid),
  );

  const waitingItems: WaitingItem[] = [
    ...planProjects.map((pid): WaitingItem => {
      const ev = proposedPlans.find((e) => e.projectId === pid);
      return {
        key: `plan-${pid}`,
        kind: "plan",
        label: ev?.object
          ? t("dashboard.waiting.planLabelWithObject", { object: ev.object })
          : t("dashboard.waiting.planLabel"),
        hint: ev?.actor
          ? t("dashboard.waiting.proposedBy", { actor: ev.actor })
          : undefined,
        href: `/projects/${encodeURIComponent(pid)}?tab=docs`,
      };
    }),
    ...reviewTasks.slice(0, 4).map(
      (task): WaitingItem => ({
        key: `review-${task.id}`,
        kind: "review",
        label: task.name,
        hint: t("dashboard.waiting.inReview", {
          agent: task.agent || t("dashboard.waiting.unassigned"),
        }),
        href: "/tasks?status=active",
      }),
    ),
    ...failedAgents.map(
      (a): WaitingItem => ({
        key: `failed-${a.id}`,
        kind: "agent-failed",
        label: t("dashboard.waiting.agentFailed", { name: a.name }),
        hint: t("dashboard.waiting.agentFailedHint"),
        href: `/agents/${encodeURIComponent(a.id)}`,
      }),
    ),
  ];

  const needsAttention = waitingItems.length;

  // Heatmap: events per day (local dates) for the last 12 weeks.
  const heatmapCounts: Record<string, number> = {};
  for (const e of events) {
    if (!e.tsMs) continue;
    const key = new Date(e.tsMs).toISOString().slice(0, 10);
    heatmapCounts[key] = (heatmapCounts[key] ?? 0) + 1;
  }

  const totalProjects = orgProjects.length;
  const totalTasks = data?.tasks?.length ?? 0;
  const showStarter =
    !isLoading &&
    !error &&
    Boolean(address) &&
    totalProjects === 0 &&
    totalTasks === 0;

  // The active organization is the name the rest of the app shows (breadcrumb,
  // switcher, shared-agent badges). The onboarding workspace name is a local
  // nicety that predates organizations, so it must not outrank it: showing
  // "Personal Workspace" under a "PerkOS" breadcrumb left the user unable to
  // tell which context the numbers below belonged to.
  const displayWorkspace =
    activeOrg?.name?.trim() ||
    workspaceName.trim() ||
    t("dashboard.personalWorkspace");

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="flex min-w-0 flex-col gap-6">
        <GreetingBanner address={address} />

        <WorkspaceCard
          name={displayWorkspace}
          ownerAddress={address}
        />

        {error ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {(error as Error).message}
          </p>
        ) : null}

        <KpiStrip
          online={online}
          agentsTotal={stats.registeredAgents}
          inFlight={stats.activeTasks}
          needsAttention={needsAttention}
          doneThisWeek={doneThisWeek}
          isLoading={isLoading}
        />

        <ActiveAgentsPanel
          agents={data?.agents ?? []}
          isLoading={isLoading}
        />

        <WaitingOnYouCard items={waitingItems} />

        <ActivityFeedCard walletAddress={address} max={12} />

        {events.length > 0 ? (
          <section className="glow-card flex flex-col gap-3 rounded-lg border border-primary/25 bg-card/60 px-4 py-4">
            <header className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-foreground">
                {t("dashboard.teamActivity.title")}
              </h2>
              <span className="text-[10px] text-muted-foreground">
                {t("dashboard.teamActivity.recentEvents", {
                  total: events.length >= 200 ? "200+" : events.length,
                })}
              </span>
            </header>
            <ActivityHeatmap counts={heatmapCounts} />
          </section>
        ) : null}

        {showStarter && address ? <StarterCallout address={address} /> : null}

        {/* Quick Actions inline (mobile/tablet only — desktop has the sidebar) */}
        <section className="lg:hidden">
          <SectionHeader title={t("dashboard.quickActions.title")} />
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {QUICK_ACTIONS.map(({ href, key, Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-3 text-sm text-foreground transition-colors hover:border-primary/40"
              >
                <Icon className="h-4 w-4 text-primary" />
                {t(`dashboard.quickActions.items.${key}.label`)}
              </Link>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <SectionHeader
            title={t("dashboard.sections.projects")}
            actionHref="/projects"
            actionLabel={t("dashboard.sections.viewAll")}
          />
          {isLoading ? (
            <SkeletonList rows={3} />
          ) : projects.length === 0 ? (
            <EmptyHint
              message={t("dashboard.projects.empty")}
              ctaHref="/projects/new"
              ctaLabel={t("dashboard.projects.emptyCta")}
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {projects.map((p) => (
                <ProjectRow key={p.id ?? p.name} project={p} />
              ))}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <SectionHeader
            title={t("dashboard.sections.recentTasks")}
            actionHref="/tasks"
            actionLabel={t("dashboard.sections.viewAll")}
          />
          {isLoading ? (
            <SkeletonList rows={3} />
          ) : tasks.length === 0 ? (
            <EmptyHint
              message={t("dashboard.tasks.empty")}
              ctaHref="/tasks/new"
              ctaLabel={t("dashboard.tasks.emptyCta")}
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {tasks.map((task) => (
                <TaskRow key={task.id ?? task.name} task={task} />
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Quick Actions — desktop sidebar */}
      <aside className="hidden flex-col gap-4 lg:flex">
        <QuickActionsCard />
        {address ? (
          <BillingCard address={address} showBlockchain={advancedFeatures.enabled} />
        ) : null}
        <ModelUsagePanel agents={allAgents} tasks={allTasks} />
      </aside>
    </div>
  );
}

function StarterCallout({ address }: { address: string }) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const mutation = useMutation({
    mutationFn: async () => {
      const projectResult = await createWalletProject({
        walletAddress: address,
        name: "Welcome to PerkOS",
        goal: "A starter project so you can poke around. Drag tasks across the kanban, open the project chat, and talk to your first agent.",
      });
      const projectId = projectResult.project?.id;
      if (!projectId) {
        throw new Error("Project created but missing id.");
      }
      await createProjectTasks({
        walletAddress: address,
        projectId,
        tasks: [
          {
            name: "Tour the dashboard",
            priority: "Low",
            agent: "Ask PerkOS Agent",
            prompt: "Walk me through what's on the dashboard.",
          },
          {
            name: "Launch your first agent",
            priority: "Medium",
            agent: "Ask PerkOS Agent",
            prompt: "Help me launch a Hermes agent for content and promotions.",
          },
          {
            name: "Try the project chat",
            priority: "Low",
            agent: "Ask PerkOS Agent",
            prompt: "Open the project chat and say hi.",
          },
        ],
      });
      return projectId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallet-overview", address] });
      queryClient.invalidateQueries({ queryKey: ["wallet-projects", address] });
      toast.success(t("dashboard.starter.toastSuccessTitle"), {
        description: t("dashboard.starter.toastSuccessDesc"),
      });
    },
    onError: (err: Error) => {
      toast.error(t("dashboard.starter.toastErrorTitle"), {
        description: err.message,
      });
    },
  });

  return (
    <Card className="border-primary/40 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" />
          {t("dashboard.starter.title")}
        </CardTitle>
        <CardDescription>
          {t("dashboard.starter.description")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="gap-2"
        >
          {mutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {mutation.isPending
            ? t("dashboard.starter.creating")
            : t("dashboard.starter.cta")}
        </Button>
      </CardContent>
    </Card>
  );
}

function GreetingBanner({ address }: { address?: string }) {
  const { t } = useTranslation();
  return (
    <div className="relative overflow-hidden rounded-xl border border-primary/30 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-5">
      <div className="flex items-start gap-3">
        <div className="relative">
          <AgentOrb name="PerkOS Assistant" presetId="assistant" size={48} />
          <span className="absolute -bottom-0.5 -right-0.5 grid h-3 w-3 place-items-center rounded-full bg-emerald-400 ring-2 ring-background" />
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-medium text-foreground md:text-2xl">
            {t("dashboard.greeting.welcomeBack")}
            {address ? (
              <span className="ml-2 font-mono text-sm text-muted-foreground">
                {formatAddress(address)}
              </span>
            ) : null}
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t("dashboard.greeting.intro")}
          </p>
        </div>
      </div>
    </div>
  );
}

function WorkspaceCard({
  name,
  ownerAddress,
}: {
  name: string;
  ownerAddress?: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="glow-hero flex flex-col gap-1 rounded-md border border-primary/30 bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">{name}</span>
        <Badge variant="secondary" className="border-border">
          {t("dashboard.workspace.badge")}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        {t("dashboard.workspace.memberCount")}
        <span className="px-2">·</span>
        {t("dashboard.workspace.ownedBy")}{" "}
        <span className="font-mono">{formatAddress(ownerAddress)}</span>
      </p>
    </div>
  );
}

function SectionHeader({
  title,
  actionHref,
  actionLabel,
}: {
  title: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-base font-medium text-foreground">{title}</h2>
      {actionHref && actionLabel ? (
        <Link
          href={actionHref}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
        >
          {actionLabel}
          <ArrowRight className="h-3 w-3" />
        </Link>
      ) : null}
    </div>
  );
}

function ProjectRow({ project }: { project: Project }) {
  const { t } = useTranslation();
  const isActive = project.status?.toLowerCase() === "active";
  return (
    <li>
      <Link
        href={`/projects/${encodeURIComponent(project.id ?? "")}`}
        className="flex items-center justify-between gap-4 rounded-md border border-border bg-card px-4 py-3 transition-colors hover:border-primary/40"
      >
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm text-foreground">
            {project.name}
          </span>
          <span className="text-xs text-muted-foreground">
            {t("dashboard.projectRow.agentCount", { count: project.agents })}
            <span className="px-2">·</span>
            {t("dashboard.projectRow.taskCount", { count: project.tasks })}
            {project.updatedAt ? (
              <>
                <span className="px-2">·</span>
                {t("dashboard.projectRow.active", {
                  time: formatRelativeShort(project.updatedAt),
                })}
              </>
            ) : null}
          </span>
        </div>
        <Badge
          variant="secondary"
          className={cn(
            "shrink-0 border-0",
            isActive
              ? "bg-emerald-500/20 text-emerald-300"
              : "bg-muted text-muted-foreground"
          )}
        >
          {project.status || "—"}
        </Badge>
      </Link>
    </li>
  );
}

function TaskRow({ task }: { task: Task }) {
  const { t } = useTranslation();
  return (
    <li className="flex items-center justify-between gap-4 rounded-md border border-border bg-card px-4 py-3">
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-sm text-foreground">{task.name}</span>
        <span className="text-xs text-muted-foreground">
          {t("dashboard.taskRow.agentLabel")} {task.agent || "—"}
          <span className="px-2">·</span>
          {task.priority || "Medium"}
          {task.updatedAt ? (
            <>
              <span className="px-2">·</span>
              {formatRelativeShort(task.updatedAt)}
            </>
          ) : null}
        </span>
      </div>
      <TaskStatusBadge status={task.status} />
    </li>
  );
}

function TaskStatusBadge({ status }: { status: string }) {
  const tone =
    status === "Done"
      ? "bg-emerald-500/20 text-emerald-300"
      : status === "In progress" || status === "Review"
      ? "bg-amber-500/20 text-amber-300"
      : "bg-muted text-muted-foreground";
  return (
    <Badge variant="secondary" className={cn("shrink-0 border-0", tone)}>
      {status || "Backlog"}
    </Badge>
  );
}

function QuickActionsCard() {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {t("dashboard.quickActions.title")}
        </CardTitle>
        <CardDescription>
          {t("dashboard.quickActions.cardDescription")}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {QUICK_ACTIONS.map(({ href, key, Icon }) => (
          <Link
            key={href}
            href={href}
            className="group flex items-start gap-3 rounded-md px-3 py-3 transition-colors hover:bg-primary/10"
          >
            <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary/15 text-primary">
              <Icon className="h-4 w-4" />
            </span>
            <span className="flex flex-1 flex-col">
              <span className="text-sm font-medium text-foreground">
                {t(`dashboard.quickActions.items.${key}.label`)}
              </span>
              <span className="text-xs text-muted-foreground">
                {t(`dashboard.quickActions.items.${key}.description`)}
              </span>
            </span>
            <Plus className="mt-1 h-3.5 w-3.5 text-muted-foreground transition-colors group-hover:text-primary" />
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

function EmptyHint({
  message,
  ctaHref,
  ctaLabel,
}: {
  message: string;
  ctaHref: string;
  ctaLabel: string;
}) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-md border border-dashed border-border bg-card/50 px-4 py-5 text-sm text-muted-foreground">
      <span>{message}</span>
      <Link
        href={ctaHref}
        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
      >
        {ctaLabel}
        <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}

function SkeletonList({ rows }: { rows: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-14 animate-pulse rounded-md border border-border bg-card"
        />
      ))}
    </div>
  );
}
