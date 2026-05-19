"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bot, Check } from "lucide-react";
import { OnboardingShell } from "../../components/OnboardingShell";
import { useOnboarding } from "../../lib/onboardingState";

export default function AgentPage() {
  const router = useRouter();
  const { hasAgent } = useOnboarding();

  return (
    <OnboardingShell
      step="agent"
      title="Register your first agent"
      description="Agents are the workers in your flock. Each agent connects to Hermes or OpenClaw runtime, executes tasks, and reports results. Register one now to be ready to assign to a project."
      nextHref="/dashboard"
      nextLabel="Finish"
      onNext={() => router.push("/dashboard")}
    >
      {hasAgent ? (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-6 py-4 font-medium text-emerald-300">
          <Check className="h-4 w-4" />
          <span className="text-base leading-none">Agent registered</span>
        </div>
      ) : (
        <Link
          href="/agents/new?from=onboarding"
          className="flex items-center justify-center gap-2 rounded-lg bg-[#ec1b69] px-6 py-4 font-medium text-[#ececff] transition-opacity hover:opacity-90"
        >
          <Bot className="h-4 w-4" />
          <span className="text-base leading-none">Register an agent</span>
        </Link>
      )}

      <div className="flex flex-col gap-2 rounded-md border border-[#1b1833] bg-[#0e0716] px-4 py-3 text-xs leading-relaxed text-[#7975a8]">
        <span className="font-medium text-[#ececff]">What you&apos;ll need</span>
        <ul className="flex flex-col gap-1">
          <li>• An agent name and optional description</li>
          <li>• A model (Claude, GPT, etc.) and runtime (Hermes or OpenClaw)</li>
          <li>• Skills/plugins to enable</li>
        </ul>
      </div>

      {!hasAgent ? (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="text-sm text-[#ec1b69] hover:underline"
          >
            Skip this step
          </button>
        </div>
      ) : null}
    </OnboardingShell>
  );
}
