"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bot, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { OnboardingShell } from "../../components/OnboardingShell";
import { useOnboarding } from "../../lib/onboardingState";

export default function AgentPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { hasAgent } = useOnboarding();

  return (
    <OnboardingShell
      step="agent"
      title={t("onboarding.agent.title")}
      description={t("onboarding.agent.description")}
      nextHref="/dashboard"
      nextLabel={t("onboarding.agent.finish")}
      onNext={() => router.push("/dashboard")}
    >
      {hasAgent ? (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-6 py-4 font-medium text-emerald-300">
          <Check className="h-4 w-4" />
          <span className="text-base leading-none">
            {t("onboarding.agent.registered")}
          </span>
        </div>
      ) : (
        <Link
          href="/agents/new?from=onboarding"
          className="flex items-center justify-center gap-2 rounded-lg bg-[#ec1b69] px-6 py-4 font-medium text-[#ececff] transition-opacity hover:opacity-90"
        >
          <Bot className="h-4 w-4" />
          <span className="text-base leading-none">
            {t("onboarding.agent.registerCta")}
          </span>
        </Link>
      )}

      <div className="flex flex-col gap-2 rounded-md border border-[#1b1833] bg-[#0e0716] px-4 py-3 text-xs leading-relaxed text-[#7975a8]">
        <span className="font-medium text-[#ececff]">
          {t("onboarding.agent.needsTitle")}
        </span>
        <ul className="flex flex-col gap-1">
          <li>• {t("onboarding.agent.needs.name")}</li>
          <li>• {t("onboarding.agent.needs.model")}</li>
          <li>• {t("onboarding.agent.needs.skills")}</li>
        </ul>
      </div>

      {!hasAgent ? (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="text-sm text-[#ec1b69] hover:underline"
          >
            {t("onboarding.agent.skip")}
          </button>
        </div>
      ) : null}
    </OnboardingShell>
  );
}
