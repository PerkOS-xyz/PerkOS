"use client";

import { useRouter } from "next/navigation";
import { useConnection } from "wagmi";
import { OnboardingShell } from "../../components/OnboardingShell";
import { UsernameCard } from "../../components/UsernameCard";
import { useOnboarding } from "../../lib/onboardingState";
import { formatAddress } from "../../lib/format";

export default function WorkspacePage() {
  const router = useRouter();
  const { workspaceName, setWorkspaceName } = useOnboarding();
  const { address } = useConnection();

  const trimmed = workspaceName.trim();
  const canContinue = trimmed.length > 0;

  return (
    <OnboardingShell
      step="workspace"
      title="Create your Workspace"
      description="A workspace is your team's shared home in PerkOS. It groups your projects, agents, and members under one roof. You can rename it anytime from settings."
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
          Workspace name
        </label>
        <input
          id="workspace-name"
          type="text"
          value={workspaceName}
          onChange={(e) => setWorkspaceName(e.target.value)}
          placeholder="Software Workspace"
          className="rounded-md border border-[#1b1833] bg-[#0e0716] px-4 py-3 text-base text-[#ececff] placeholder:text-[#7975a8]/60 focus:border-[#ec1b69] focus:outline-none focus:ring-1 focus:ring-[#ec1b69]"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs uppercase tracking-wide text-[#7975a8]">
          Your username <span className="normal-case text-[#4f4b6e]">(optional)</span>
        </label>
        <UsernameCard address={address} />
        <p className="text-xs leading-relaxed text-[#7975a8]">
          Your @handle is how teammates and agents mention you in chats. You can
          skip and set it later, or keep your wallet address.
        </p>
      </div>

      <div className="flex flex-col gap-1 text-xs text-[#7975a8]">
        <span>
          <span className="text-[#ececff]">1 member</span>
          <span className="px-2">·</span>
          <span>Owned by {formatAddress(address)}</span>
        </span>
        <p className="leading-relaxed">
          You can invite teammates to your workspace later from the Settings panel.
        </p>
      </div>
    </OnboardingShell>
  );
}
