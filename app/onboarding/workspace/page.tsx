"use client";

import { useRouter } from "next/navigation";
import { useConnection } from "wagmi";
import { useTranslation } from "react-i18next";
import { OnboardingShell } from "../../components/OnboardingShell";
import { UsernameCard } from "../../components/UsernameCard";
import { useOnboarding } from "../../lib/onboardingState";
import { formatAddress } from "../../lib/format";

export default function WorkspacePage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { workspaceName, setWorkspaceName } = useOnboarding();
  const { address } = useConnection();

  const trimmed = workspaceName.trim();
  const canContinue = trimmed.length > 0;

  return (
    <OnboardingShell
      step="workspace"
      title={t("onboarding.workspace.title")}
      description={t("onboarding.workspace.description")}
      nextHref="/onboarding/project"
      nextDisabled={!canContinue}
      onNext={() => {
        if (canContinue) router.push("/onboarding/project");
      }}
    >
      <div className="flex flex-col gap-2">
        <label
          htmlFor="workspace-name"
          className="text-xs uppercase tracking-wide text-[#7975a8]"
        >
          {t("onboarding.workspace.nameLabel")}
        </label>
        <input
          id="workspace-name"
          type="text"
          value={workspaceName}
          onChange={(e) => setWorkspaceName(e.target.value)}
          placeholder={t("onboarding.workspace.namePlaceholder")}
          className="rounded-md border border-[#1b1833] bg-[#0e0716] px-4 py-3 text-base text-[#ececff] placeholder:text-[#7975a8]/60 focus:border-[#ec1b69] focus:outline-none focus:ring-1 focus:ring-[#ec1b69]"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs uppercase tracking-wide text-[#7975a8]">
          {t("onboarding.workspace.usernameLabel")}{" "}
          <span className="normal-case text-[#4f4b6e]">
            {t("onboarding.workspace.optional")}
          </span>
        </label>
        <UsernameCard address={address} />
        <p className="text-xs leading-relaxed text-[#7975a8]">
          {t("onboarding.workspace.usernameHelp")}
        </p>
      </div>

      <div className="flex flex-col gap-1 text-xs text-[#7975a8]">
        <span>
          <span className="text-[#ececff]">
            {t("onboarding.workspace.memberCount")}
          </span>
          <span className="px-2">·</span>
          <span>
            {t("onboarding.workspace.ownedBy", {
              address: formatAddress(address),
            })}
          </span>
        </span>
        <p className="leading-relaxed">
          {t("onboarding.workspace.inviteHint")}
        </p>
      </div>
    </OnboardingShell>
  );
}
