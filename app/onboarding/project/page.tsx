"use client";

import Link from "next/link";
import { Check, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { OnboardingShell } from "../../components/OnboardingShell";
import { useOnboarding } from "../../lib/onboardingState";

export default function ProjectPage() {
  const { t } = useTranslation();
  const { hasProject } = useOnboarding();

  return (
    <OnboardingShell
      step="project"
      title={t("onboarding.project.title")}
      description={t("onboarding.project.description")}
      nextHref="/onboarding/agent"
    >
      {hasProject ? (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-6 py-4 font-medium text-emerald-300">
          <Check className="h-4 w-4" />
          <span className="text-base leading-none">
            {t("onboarding.project.created")}
          </span>
        </div>
      ) : (
        <Link
          href="/projects/new?from=onboarding"
          className="flex items-center justify-center gap-2 rounded-lg bg-[#ec1b69] px-6 py-4 font-medium text-[#ececff] transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          <span className="text-base leading-none">
            {t("onboarding.project.createCta")}
          </span>
        </Link>
      )}

      {!hasProject ? (
        <div className="flex justify-center">
          <Link
            href="/onboarding/agent"
            className="text-sm text-[#ec1b69] hover:underline"
          >
            {t("onboarding.project.skip")}
          </Link>
        </div>
      ) : null}
    </OnboardingShell>
  );
}
