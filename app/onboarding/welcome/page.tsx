"use client";

import { useTranslation } from "react-i18next";
import { OnboardingShell } from "../../components/OnboardingShell";

const STATS = [
  { key: "projects", count: 0 },
  { key: "tasks", count: 0 },
  { key: "agents", count: 0 },
];

export default function WelcomePage() {
  const { t } = useTranslation();

  return (
    <OnboardingShell
      step="welcome"
      title={t("onboarding.welcome.title")}
      description={t("onboarding.welcome.description")}
      nextHref="/onboarding/workspace"
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {STATS.map((stat) => (
          <div
            key={stat.key}
            className="flex flex-col gap-1 rounded-md border border-[#530922] bg-[#0e0716] px-4 py-3"
          >
            <span className="text-xs uppercase tracking-wide text-[#7975a8]">
              {t(`onboarding.welcome.stats.${stat.key}.label`)}
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-semibold text-[#ececff]">
                {stat.count}
              </span>
              <span className="text-xs text-[#7975a8]">
                {t(`onboarding.welcome.stats.${stat.key}.suffix`)}
              </span>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs leading-relaxed text-[#7975a8]">
        {t("onboarding.welcome.emptyNote")}
      </p>
    </OnboardingShell>
  );
}
