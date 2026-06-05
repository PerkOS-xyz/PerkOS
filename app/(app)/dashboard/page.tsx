"use client";

import Image from "next/image";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useConnection } from "wagmi";
import { toast } from "sonner";
import {
  Folder,
  ListTodo,
  Bot,
  Plus,
  ArrowRight,
  Briefcase,
  CheckCircle2,
  Clock,
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
  getWalletOverview,
  type Project,
  type Task,
} from "../../lib/perkosApi";
import { useOnboarding } from "../../lib/onboardingState";
import { formatAddress } from "../../lib/format";
import { ActiveAgentsPanel } from "../../components/ActiveAgentsPanel";

const QUICK_ACTIONS = [
  {
    href: "/projects/new",
    label: "Create project",
    description: "Set up a new mission for your agents.",
    Icon: Folder,
  },
  {
    href: "/tasks/new",
    label: "Create task",
    description: "Add work to one of your projects.",
    Icon: ListTodo,
  },
  {
    href: "/agents/new",
    label: "Register agent",
    description: "Launch a new worker for your team.",
    Icon: Bot,
  },
];

const STAT_CARDS: {
  key: "activeProjects" | "registeredAgents" | "activeTasks" | "completedTasks";
  label: string;
  hint: string;
  Icon: typeof Briefcase;
  /** Where clicking the card lands. Includes the appropriate ?status= filter. */
  href: string;
}[] = [
  {
    key: "activeProjects",
    label: "Active projects",
    hint: "in progress",
    Icon: Briefcase,
    href: "/projects?status=active",
  },
  {
    key: "registeredAgents",
    label: "Registered agents",
    hint: "on your roster",
    Icon: Bot,
    href: "/agents",
  },
  {
    key: "activeTasks",
    label: "Active tasks",
    hint: "in flight",
    Icon: Clock,
    href: "/tasks?status=active",
  },
  {
    key: "completedTasks",
    label: "Completed tasks",
    hint: "shipped",
    Icon: CheckCircle2,
    href: "/tasks?status=done",
  },
];

export default function DashboardPage() {
  const { address } = useConnection();
  const { workspaceName } = useOnboarding();

  const { data, isLoading, error } = useQuery({
    queryKey: ["wallet-overview", address],
    queryFn: () => getWalletOverview(address!),
    enabled: Boolean(address),
    staleTime: 30_000,
  });

  const stats = data?.stats ?? {
    activeProjects: 0,
    registeredAgents: 0,
    activeTasks: 0,
    completedTasks: 0,
  };
  const projects = (data?.projects ?? []).slice(0, 5);
  const tasks = (data?.tasks ?? []).slice(0, 5);

  const totalProjects = data?.projects?.length ?? 0;
  const totalTasks = data?.tasks?.length ?? 0;
  const showStarter =
    !isLoading &&
    !error &&
    Boolean(address) &&
    totalProjects === 0 &&
    totalTasks === 0;

  const displayWorkspace = workspaceName.trim() || "Personal Workspace";

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <div className="flex flex-col gap-6">
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

        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {STAT_CARDS.map(({ key, label, hint, Icon, href }) => (
            <StatCard
              key={key}
              label={label}
              value={isLoading ? "—" : stats[key]}
              hint={hint}
              Icon={Icon}
              href={href}
            />
          ))}
        </section>

        <ActiveAgentsPanel
          agents={data?.agents ?? []}
          isLoading={isLoading}
        />

        {showStarter && address ? <StarterCallout address={address} /> : null}

        {/* Quick Actions inline (mobile/tablet only — desktop has the sidebar) */}
        <section className="lg:hidden">
          <SectionHeader title="Quick actions" />
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {QUICK_ACTIONS.map(({ href, label, Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-3 text-sm text-foreground transition-colors hover:border-primary/40"
              >
                <Icon className="h-4 w-4 text-primary" />
                {label}
              </Link>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <SectionHeader
            title="Projects"
            actionHref="/projects"
            actionLabel="View all"
          />
          {isLoading ? (
            <SkeletonList rows={3} />
          ) : projects.length === 0 ? (
            <EmptyHint
              message="No projects yet."
              ctaHref="/projects/new"
              ctaLabel="Create your first project"
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
            title="Recent tasks"
            actionHref="/tasks"
            actionLabel="View all"
          />
          {isLoading ? (
            <SkeletonList rows={3} />
          ) : tasks.length === 0 ? (
            <EmptyHint
              message="No tasks yet."
              ctaHref="/tasks/new"
              ctaLabel="Create a task"
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {tasks.map((t) => (
                <TaskRow key={t.id ?? t.name} task={t} />
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Quick Actions — desktop sidebar */}
      <aside className="hidden flex-col gap-4 lg:flex">
        <QuickActionsCard />
      </aside>
    </div>
  );
}

function StarterCallout({ address }: { address: string }) {
  const queryClient = useQueryClient();

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
            agent: "PerkOS Agent",
            prompt: "Walk me through what's on the dashboard.",
          },
          {
            name: "Launch your first agent",
            priority: "Medium",
            agent: "PerkOS Agent",
            prompt: "Help me launch a Hermes agent for marketing.",
          },
          {
            name: "Try the project chat",
            priority: "Low",
            agent: "PerkOS Agent",
            prompt: "Open the project chat and say hi.",
          },
        ],
      });
      return projectId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallet-overview", address] });
      queryClient.invalidateQueries({ queryKey: ["wallet-projects", address] });
      toast.success("Starter project ready", {
        description: "Welcome to PerkOS — 3 demo tasks added.",
      });
    },
    onError: (err: Error) => {
      toast.error("Couldn't create starter project", {
        description: err.message,
      });
    },
  });

  return (
    <Card className="border-primary/40 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" />
          New here?
        </CardTitle>
        <CardDescription>
          Spin up a demo project with 3 sample tasks so the kanban, chat, and
          agent flows have something to show.
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
          {mutation.isPending ? "Creating…" : "Create starter project"}
        </Button>
      </CardContent>
    </Card>
  );
}

function GreetingBanner({ address }: { address?: string }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-primary/30 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-5">
      <div className="flex items-start gap-3">
        <div className="relative">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-primary/75">
            <Image
              src="/avatar.png"
              alt=""
              width={45}
              height={45}
            />
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 grid h-3 w-3 place-items-center rounded-full bg-emerald-400 ring-2 ring-background" />
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-medium text-foreground md:text-2xl">
            Welcome back
            {address ? (
              <span className="ml-2 font-mono text-sm text-muted-foreground">
                {formatAddress(address)}
              </span>
            ) : null}
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            I&apos;m your PerkOS Agent. I&apos;ll help you build and run the
            agents and projects you need. Pick where to focus today.
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
  return (
    <div className="glow-hero flex flex-col gap-1 rounded-md border border-primary/30 bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">{name}</span>
        <Badge variant="secondary" className="border-border">
          Workspace
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        1 member
        <span className="px-2">·</span>
        Owned by{" "}
        <span className="font-mono">{formatAddress(ownerAddress)}</span>
      </p>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  Icon,
  href,
}: {
  label: string;
  value: number | string;
  hint: string;
  Icon: typeof Briefcase;
  href?: string;
}) {
  // h-full + justify-between makes every card stretch to the height of the
  // tallest sibling and pins the value+hint row to the bottom — so a
  // 2-line label (e.g. "REGISTERED AGENTS" wrapping at md breakpoints)
  // doesn't push that card taller than its neighbours.
  const content = (
    <div
      className={cn(
        "glow-card flex h-full flex-col justify-between gap-2 rounded-md border border-primary/20 bg-gradient-to-br from-primary/8 to-transparent p-4",
        href && "cursor-pointer hover:border-primary/40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <Icon className="h-4 w-4 shrink-0 text-primary" />
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-semibold leading-none text-foreground">
          {value}
        </span>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block h-full rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-label={`${label}: ${value} ${hint}`}
      >
        {content}
      </Link>
    );
  }
  return content;
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
            {project.agents} agent{project.agents === 1 ? "" : "s"}
            <span className="px-2">·</span>
            {project.tasks} task{project.tasks === 1 ? "" : "s"}
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
  return (
    <li className="flex items-center justify-between gap-4 rounded-md border border-border bg-card px-4 py-3">
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-sm text-foreground">{task.name}</span>
        <span className="text-xs text-muted-foreground">
          Agent: {task.agent || "—"}
          <span className="px-2">·</span>
          {task.priority || "Medium"}
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
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Quick actions</CardTitle>
        <CardDescription>Jump back into the build flow.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {QUICK_ACTIONS.map(({ href, label, description, Icon }) => (
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
                {label}
              </span>
              <span className="text-xs text-muted-foreground">
                {description}
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
