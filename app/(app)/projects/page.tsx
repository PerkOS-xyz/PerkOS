"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useConnection } from "wagmi";
import { Folder, Plus } from "lucide-react";
import { getWalletProjects, type Project } from "../../lib/perkosApi";
import {
  SearchInput,
  matchesQuery,
} from "../../components/SearchInput";
import { EmptyState } from "../../components/EmptyState";

export default function ProjectsPage() {
  const { address, isConnected } = useConnection();
  const [query, setQuery] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["wallet-projects", address],
    queryFn: () => getWalletProjects(address!),
    enabled: isConnected && Boolean(address),
  });

  const allProjects = data?.projects ?? [];
  const projects = allProjects.filter((p) =>
    matchesQuery(query, [p.name, p.goal, p.status])
  );
  const hasProjects = allProjects.length > 0;
  const noResults = hasProjects && projects.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-medium text-[#ececff]">Projects</h1>
          <p className="text-sm text-[#7975a8]">
            {hasProjects
              ? `${allProjects.length} project${allProjects.length === 1 ? "" : "s"} in your workspace.`
              : "Create your first project."}
          </p>
        </div>
        <CreateProjectButton />
      </header>

      {hasProjects ? (
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search projects by name, goal, or status…"
        />
      ) : null}

      {isLoading ? <SkeletonCards /> : null}
      {error ? <ErrorBanner message={(error as Error).message} /> : null}
      {!isLoading && !error && projects.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {projects.map((p) => (
            <ProjectCard key={p.id ?? p.name} project={p} />
          ))}
        </ul>
      ) : null}
      {!isLoading && !error && noResults ? (
        <p className="rounded-md border border-dashed border-[#1b1833] px-6 py-10 text-center text-sm text-[#7975a8]">
          No projects match &quot;{query}&quot;.
        </p>
      ) : null}
      {!isLoading && !error && !hasProjects ? <EmptyHint /> : null}
    </div>
  );
}

function CreateProjectButton() {
  return (
    <Link
      href="/projects/new"
      className="flex items-center justify-center gap-2 rounded-md bg-[#ec1b69] px-5 py-2.5 text-sm font-medium text-[#ececff] transition-opacity hover:opacity-90"
    >
      <PlusIcon />
      <span>Create project</span>
    </Link>
  );
}

function ProjectCard({ project }: { project: Project }) {
  return (
    <li>
      <Link
        href={`/projects/${encodeURIComponent(project.id ?? "")}`}
        className="flex items-start justify-between gap-4 rounded-md border border-[#1b1833] bg-[#0e0716] px-4 py-3 transition-colors hover:border-[#530922]"
      >
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-base text-[#ececff]">{project.name}</span>
            <StatusBadge status={project.status} />
          </div>
          <p className="text-xs text-[#7975a8]">
            {project.agents} agent{project.agents === 1 ? "" : "s"}
            <span className="px-2">·</span>
            {project.tasks} task{project.tasks === 1 ? "" : "s"}
          </p>
        </div>
        <ChevronRightIcon />
      </Link>
    </li>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      className="mt-1 shrink-0 text-[#7975a8]"
      aria-hidden
    >
      <path
        d="m6 3.333 4.667 4.667L6 12.667"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StatusBadge({ status }: { status: string }) {
  const isActive = status?.toLowerCase() === "active";
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        isActive
          ? "bg-emerald-500/20 text-emerald-300"
          : "bg-[#1b1833] text-[#7975a8]"
      }`}
    >
      {status || "—"}
    </span>
  );
}

function EmptyHint() {
  return (
    <EmptyState
      icon={Folder}
      title="No projects yet"
      description="Projects group your agents, tasks, and chats around a goal. Start by creating one."
      actions={[
        {
          label: "Create project",
          href: "/projects/new",
          icon: Plus,
        },
      ]}
    />
  );
}

function SkeletonCards() {
  return (
    <div className="flex flex-col gap-3">
      {[0, 1].map((i) => (
        <div
          key={i}
          className="h-16 animate-pulse rounded-md border border-[#1b1833] bg-[#0e0716]"
        />
      ))}
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-[#ec1b69]/40 bg-[#ec1b69]/10 px-4 py-3 text-sm text-[#ec1b69]">
      {message}
    </div>
  );
}

function PlusIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M8 3.333v9.334M3.333 8h9.334"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
