"use client";

import Link from "next/link";
import { Check, Plus } from "lucide-react";
import { OnboardingShell } from "../../components/OnboardingShell";
import { useOnboarding } from "../../lib/onboardingState";

export default function ProjectPage() {
  const { hasProject } = useOnboarding();

  return (
    <OnboardingShell
      step="project"
      title="Start a project"
      description="Projects keep your agents and tasks organized around a shared goal. Think of each project as a mission with its own scope, agents assigned, and tasks to complete."
      nextHref="/onboarding/agent"
    >
      {hasProject ? (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-6 py-4 font-medium text-emerald-300">
          <Check className="h-4 w-4" />
          <span className="text-base leading-none">Project created</span>
        </div>
      ) : (
        <Link
          href="/projects/new?from=onboarding"
          className="flex items-center justify-center gap-2 rounded-lg bg-[#ec1b69] px-6 py-4 font-medium text-[#ececff] transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          <span className="text-base leading-none">
            Create your first project
          </span>
        </Link>
      )}

      {!hasProject ? (
        <div className="flex justify-center">
          <Link
            href="/onboarding/agent"
            className="text-sm text-[#ec1b69] hover:underline"
          >
            Skip this step
          </Link>
        </div>
      ) : null}
    </OnboardingShell>
  );
}
