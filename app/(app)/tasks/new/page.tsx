"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAppAccount } from "../../../lib/useAppAccount";
import { toast } from "sonner";
import {
  createProjectTasks,
  setProjectPm,
  getWalletAgents,
  type Project,
} from "../../../lib/perkosApi";
import { useFormDraft } from "../../../lib/useFormDraft";
import { TaskAttachments } from "../../../components/TaskAttachments";
import { attachmentMarkdown } from "../../../lib/uploadAttachment";
import type { TaskAttachment } from "../../../lib/perkosApi";
import { fieldErrors, taskSchema } from "../../../lib/validators";
import { useVisibleProjects } from "../../../lib/useVisibleProjects";
import { Button } from "@/components/ui/button";

type Priority = "High" | "Medium" | "Low";

export default function CreateTaskPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { address, isConnected } = useAppAccount();

  const initialProjectId = searchParams.get("projectId") ?? "";

  const [draft, setDraft, clearDraft] = useFormDraft("task.new.v1", {
    projectId: initialProjectId,
    name: "",
    description: "",
    priority: "Medium" as Priority,
    agent: "App Agent",
  });
  const { projectId, name, description, priority, agent } = draft;
  const setProjectId = (v: string) =>
    setDraft((d) => ({ ...d, projectId: v }));
  const setName = (v: string) => setDraft((d) => ({ ...d, name: v }));
  const setDescription = (v: string) =>
    setDraft((d) => ({ ...d, description: v }));
  const setPriority = (v: Priority) =>
    setDraft((d) => ({ ...d, priority: v }));
  const setAgent = (v: string) => setDraft((d) => ({ ...d, agent: v }));

  // Same source as /projects: a member's projects live under the org owner's
  // wallet, so reading their own subtree returned nothing here while the
  // project list showed several.
  const projectsQuery = useVisibleProjects();

  const agentsQuery = useQuery({
    queryKey: ["wallet-agents", address],
    queryFn: () => getWalletAgents(address!),
    enabled: Boolean(address),
  });

  const projects = projectsQuery.projects;
  const selectedProject = projects.find((p) => p.id === projectId) ?? null;
  const projectAgents = selectedProject?.agentIds ?? [];
  const [leadPick, setLeadPick] = useState("");

  // Setting the lead from here keeps the fix next to the problem: the warning
  // used to end by sending the user to another page to do one click.
  const setLeadMut = useMutation({
    mutationFn: () =>
      setProjectPm({
        walletAddress: selectedProject?.ownerWallet ?? address!,
        projectId,
        pmAgent: leadPick,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallet-projects"] });
      toast.success(`${leadPick} is now the lead`, {
        description: `New tasks on ${selectedProject?.name ?? "this project"} will be picked up.`,
      });
    },
    onError: (e: Error) =>
      toast.error("Couldn't set the lead", { description: e.message }),
  });
  const registeredAgents = agentsQuery.data ?? [];

  useEffect(() => {
    // Auto-select the only project if there's just one and none specified.
    if (!projectId && projects.length === 1 && projects[0].id) {
      setProjectId(projects[0].id);
    }
  }, [projects, projectId]);

  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [attempted, setAttempted] = useState(false);
  const errors = useMemo(
    () =>
      fieldErrors(taskSchema, {
        projectId,
        name,
        description,
        priority,
        agent,
      }) ?? {},
    [projectId, name, description, priority, agent]
  );
  const showErrors = attempted;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!isConnected || !address) {
        throw new Error("Connect a wallet before creating a task.");
      }
      if (!projectId) {
        throw new Error("Pick a project to create the task in.");
      }
      return createProjectTasks({
        // The project may live under an organization owner's wallet, not the
        // caller's. Writing to the caller's path produced "No document to
        // update" against a document that never existed there.
        walletAddress: selectedProject?.ownerWallet ?? address,
        projectId,
        tasks: [
          {
            name: name.trim(),
            priority,
            agent: agent.trim() || "App Agent",
            // The agent reads `prompt`, so the files have to be IN it or they
            // are invisible to whoever does the work. Same markdown contract
            // the chat composer uses, so the URLs survive as plain links.
            prompt: [description.trim(), ...attachments.map(attachmentMarkdown)]
              .filter(Boolean)
              .join("\n\n"),
            attachments,
          },
        ],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["wallet-project", address, projectId],
      });
      queryClient.invalidateQueries({ queryKey: ["wallet-projects", address] });
      toast.success("Task created", {
        description: `"${name.trim()}" was added to the project.`,
      });
      clearDraft();
      router.replace(`/projects/${projectId}`);
    },
    onError: (err: Error) => {
      toast.error("Task creation failed", { description: err.message });
    },
  });

  const canSubmit =
    !mutation.isPending && Object.keys(errors).length === 0;

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAttempted(true);
    if (!canSubmit) return;
    mutation.mutate();
  }

  return (
    <div className="relative flex flex-col gap-6">
      <Link
        href={initialProjectId ? `/projects/${initialProjectId}` : "/projects"}
        className="inline-flex w-fit items-center gap-2 text-sm text-[#7975a8] hover:text-[#ececff]"
      >
        <ChevronLeftIcon />
        Go back to tasks
      </Link>

      <h1 className="text-3xl font-medium text-[#ececff]">Create new task</h1>

      <form onSubmit={onSubmit} noValidate className="flex max-w-2xl flex-col gap-4">
        <TextField
          id="task-name"
          label="Task name"
          value={name}
          onChange={setName}
          placeholder="What needs to get done?"
          error={showErrors ? errors.name : undefined}
        />

        <TextField
          id="task-description"
          label="Description"
          value={description}
          onChange={setDescription}
          placeholder="What's the goal of this task?"
          multiline
          error={showErrors ? errors.description : undefined}
        />

        <TaskAttachments
          walletAddress={selectedProject?.ownerWallet ?? address}
          scope={projectId || "unassigned"}
          value={attachments}
          onChange={setAttachments}
        />

        <SelectField
          id="task-project"
          label="Project"
          value={projectId}
          onChange={setProjectId}
          options={[
            ...(projects.length ? [] : [{ value: "", label: "No projects yet" }]),
            ...projects
              .filter((p): p is Project & { id: string } => Boolean(p.id))
              .map((p) => ({ value: p.id, label: p.name })),
          ]}
          placeholder="Pick a project"
          error={showErrors ? errors.projectId : undefined}
        />

        {selectedProject && !selectedProject.pmAgent ? (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2.5">
            <p className="text-sm font-medium text-amber-200">
              No lead on this project, so nobody will pick this task up
            </p>
            <p className="mt-1 text-xs text-amber-200/70">
              The task will be created and sit in Backlog. Work is dispatched
              from a project&apos;s board, and a board only becomes active once
              its lead plans on it.
            </p>
            {projectAgents.length ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <select
                  aria-label="Choose the lead"
                  value={leadPick}
                  onChange={(e) => setLeadPick(e.target.value)}
                  className="rounded-md border border-amber-500/30 bg-transparent px-2 py-1 text-xs text-amber-100"
                >
                  <option value="">Choose the lead…</option>
                  {projectAgents.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  disabled={!leadPick || setLeadMut.isPending}
                  onClick={() => setLeadMut.mutate()}
                >
                  {setLeadMut.isPending ? "Setting…" : "Set lead"}
                </Button>
              </div>
            ) : (
              <p className="mt-2 text-xs text-amber-200/70">
                Add an agent to “{selectedProject.name}” first, from the project
                page.
              </p>
            )}
          </div>
        ) : null}

        <SelectField
          id="task-priority"
          label="Priority"
          value={priority}
          onChange={(v) => setPriority(v as Priority)}
          options={[
            { value: "Low", label: "Low" },
            { value: "Medium", label: "Medium" },
            { value: "High", label: "High" },
          ]}
        />

        <SelectField
          id="task-agent"
          label="Assigned agent"
          value={agent}
          onChange={setAgent}
          options={[
            { value: "App Agent", label: "App Agent (default)" },
            ...registeredAgents.map((a) => ({
              value: a.name,
              label: `${a.name} · ${a.runtime}`,
            })),
          ]}
          placeholder="Pick an agent"
          error={showErrors ? errors.agent : undefined}
        />

        {mutation.error ? (
          <p className="rounded-md border border-[#ec1b69]/40 bg-[#ec1b69]/10 px-3 py-2 text-sm text-[#ec1b69]">
            {(mutation.error as Error).message}
          </p>
        ) : null}

        <div className="flex justify-start pt-2">
          <button
            type="submit"
            disabled={!canSubmit}
            className="flex items-center justify-center gap-2 rounded-md bg-[#ec1b69] px-6 py-3 text-sm font-medium text-[#ececff] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <PlusIcon />
            {mutation.isPending ? "Creating…" : "Create task"}
          </button>
        </div>
      </form>
    </div>
  );
}

type TextFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  error?: string;
};

function TextField({
  id,
  label,
  value,
  onChange,
  placeholder,
  multiline,
  error,
}: TextFieldProps) {
  const base = `w-full rounded-md border bg-[#0e0716] px-4 py-3 text-base text-[#ececff] placeholder:text-[#7975a8]/60 focus:outline-none focus:ring-1 ${
    error
      ? "border-[#ec1b69] focus:border-[#ec1b69] focus:ring-[#ec1b69]"
      : "border-[#1b1833] focus:border-[#ec1b69] focus:ring-[#ec1b69]"
  }`;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-xs uppercase tracking-wide text-[#7975a8]">
        {label}
      </label>
      {multiline ? (
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={4}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`${base} resize-y`}
        />
      ) : (
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className={base}
        />
      )}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-[#ec1b69]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type SelectFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  error?: string;
};

function SelectField({
  id,
  label,
  value,
  onChange,
  options,
  placeholder,
  error,
}: SelectFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-xs uppercase tracking-wide text-[#7975a8]">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`w-full appearance-none rounded-md border bg-[#0e0716] px-4 py-3 pr-10 text-base text-[#ececff] focus:outline-none focus:ring-1 ${
            error
              ? "border-[#ec1b69] focus:border-[#ec1b69] focus:ring-[#ec1b69]"
              : "border-[#1b1833] focus:border-[#ec1b69] focus:ring-[#ec1b69]"
          }`}
        >
          {placeholder ? (
            <option value="" disabled>
              {placeholder}
            </option>
          ) : null}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDownIcon className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#7975a8]" />
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-xs text-[#ec1b69]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function ChevronLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M10 3.333 5.333 8 10 12.667"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      className={className}
      aria-hidden
    >
      <path
        d="m3.333 6 4.667 4.667L12.667 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M8 3.333v9.334M3.333 8h9.334"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
