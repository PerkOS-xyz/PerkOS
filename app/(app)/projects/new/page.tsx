"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useConnection } from "wagmi";
import { toast } from "sonner";
import { createWalletProject } from "../../../lib/perkosApi";
import { useActiveOrg } from "../../../lib/useActiveOrg";
import { useOnboarding } from "../../../lib/onboardingState";
import { useFormDraft } from "../../../lib/useFormDraft";
import { fieldErrors, projectSchema } from "../../../lib/validators";
import { trackEvent } from "../../../lib/analytics";

export default function CreateProjectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { address, isConnected } = useConnection();
  const { activeOrgId } = useActiveOrg();
  const { markProjectCreated } = useOnboarding();

  const fromOnboarding = searchParams.get("from") === "onboarding";

  // Project creation now goes through the unified wizard (template / custom
  // team / empty) at /companies/new — every "Create project" entry point links
  // here, so one redirect upgrades them all. The onboarding flow keeps this
  // quick form: it marks its step and continues to /onboarding/agent.
  useEffect(() => {
    if (!fromOnboarding) router.replace("/companies/new");
  }, [fromOnboarding, router]);

  const [draft, setDraft, clearDraft] = useFormDraft("project.new.v1", {
    name: "",
    goal: "",
  });
  const { name, goal } = draft;
  const setName = (next: string) => setDraft((d) => ({ ...d, name: next }));
  const setGoal = (next: string) => setDraft((d) => ({ ...d, goal: next }));

  const [attempted, setAttempted] = useState(false);
  const errors = useMemo(
    () => fieldErrors(projectSchema, { name, goal }) ?? {},
    [name, goal]
  );
  const showErrors = attempted;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!isConnected || !address) {
        throw new Error("Connect a wallet before creating a project.");
      }
      return createWalletProject({
        walletAddress: address,
        name: name.trim(),
        goal: goal.trim(),
        // Create the project inside the active organization.
        orgId: activeOrgId ?? undefined,
      });
    },
    onSuccess: () => {
      trackEvent("project_created", {
        creation_flow: fromOnboarding ? "onboarding" : "direct",
      });
      queryClient.invalidateQueries({ queryKey: ["wallet-projects"] });
      if (fromOnboarding) markProjectCreated();
      toast.success("Project created", {
        description: `"${name.trim()}" is ready.`,
      });
      clearDraft();
      router.replace(fromOnboarding ? "/onboarding/agent" : "/projects");
    },
    onError: (err: Error) => {
      toast.error("Project creation failed", { description: err.message });
    },
  });

  const canSubmit =
    Object.keys(errors).length === 0 && !mutation.isPending;

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAttempted(true);
    if (!canSubmit) return;
    mutation.mutate();
  }

  // Redirecting to the wizard (effect above) — don't flash the old form.
  if (!fromOnboarding) return null;

  return (
    <div className="relative flex flex-col gap-6">
      <Link
        href="/projects"
        className="inline-flex w-fit items-center gap-2 text-sm text-[#7975a8] hover:text-[#ececff]"
      >
        <ChevronLeftIcon />
        Go back to projects
      </Link>

      <h1 className="text-3xl font-medium text-[#ececff]">Create new project</h1>

      <form onSubmit={onSubmit} noValidate className="flex max-w-2xl flex-col gap-5">
        <Field
          id="project-name"
          label="Project name"
          value={name}
          onChange={setName}
          placeholder="Name your project"
          error={showErrors ? errors.name : undefined}
        />

        <Field
          id="project-goal"
          label="Description"
          value={goal}
          onChange={setGoal}
          placeholder="What's the goal of this project?"
          multiline
          error={showErrors ? errors.goal : undefined}
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
            {mutation.isPending ? "Creating…" : "Create project"}
          </button>
        </div>
      </form>
    </div>
  );
}

type FieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  error?: string;
};

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  multiline,
  error,
}: FieldProps) {
  const baseClasses = `w-full rounded-md border bg-[#0e0716] px-4 py-3 text-base text-[#ececff] placeholder:text-[#7975a8]/60 focus:outline-none focus:ring-1 ${
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
          rows={5}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`${baseClasses} resize-y`}
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
          className={baseClasses}
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
