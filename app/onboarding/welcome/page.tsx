"use client";

import { OnboardingShell } from "../../components/OnboardingShell";

const STATS = [
  { label: "Projects", count: 0, suffix: "active projects" },
  { label: "Tasks", count: 0, suffix: "completed tasks" },
  { label: "Agents", count: 0, suffix: "registered agents" },
];

export default function WelcomePage() {
  return (
    <OnboardingShell
      step="welcome"
      title="Welcome to PerkOS"
      description="PerkOS is your command center for AI-first accountable work. Organize your agents, dispatch tasks, and track results — all in one place. Let's get you set up in a few quick steps."
      nextHref="/onboarding/workspace"
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {STATS.map((stat) => (
          <div
            key={stat.label}
            className="flex flex-col gap-1 rounded-md border border-[#530922] bg-[#0e0716] px-4 py-3"
          >
            <span className="text-xs uppercase tracking-wide text-[#7975a8]">
              {stat.label}
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-semibold text-[#ececff]">
                {stat.count}
              </span>
              <span className="text-xs text-[#7975a8]">{stat.suffix}</span>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs leading-relaxed text-[#7975a8]">
        Your dashboard starts empty. By the end of this setup, you&apos;ll have
        your first project and agent ready to go.
      </p>
    </OnboardingShell>
  );
}
