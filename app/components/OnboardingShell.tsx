"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

const STEPS = ["welcome", "workspace", "project", "agent"] as const;
type StepId = (typeof STEPS)[number];

const STEP_ORDER: Record<StepId, number> = {
  welcome: 1,
  workspace: 2,
  project: 3,
  agent: 4,
};

type Props = {
  step: StepId;
  title: string;
  description: string;
  children: ReactNode;
  nextHref: string;
  nextLabel?: string;
  nextDisabled?: boolean;
  onNext?: () => void;
};

export function OnboardingShell({
  step,
  title,
  description,
  children,
  nextHref,
  nextLabel,
  nextDisabled = false,
  onNext,
}: Props) {
  const { t } = useTranslation();
  const currentIndex = STEP_ORDER[step];
  const resolvedNextLabel = nextLabel ?? t("onboarding.shell.next");
  const backHref =
    currentIndex > 1 ? `/onboarding/${STEPS[currentIndex - 2]}` : null;

  return (
    <div className="flex w-full max-w-md flex-col gap-7 rounded-lg border border-[#530922] bg-[#0e0716] p-8 shadow-[0_0_5px_rgba(236,27,105,0.3)] md:max-w-2xl md:gap-10 md:p-10">
      <div className="flex items-center justify-center">
        <Image
          src="/perkos-header.png"
          alt="PerkOS"
          width={140}
          height={28}
          priority
        />
      </div>

      <ProgressDots current={currentIndex} total={STEPS.length} />

      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold text-[#ececff] md:text-3xl">
          {title}
        </h1>
        <p className="text-sm leading-relaxed text-[#7975a8]">{description}</p>
      </div>

      <div className="flex flex-col gap-5">{children}</div>

      <div className="flex items-center justify-between border-t border-[#1b1833] pt-5">
        {backHref ? (
          <Link
            href={backHref}
            className="rounded-md px-4 py-2 text-sm text-[#ececff] hover:bg-[#1b1833]/40"
          >
            {t("onboarding.shell.back")}
          </Link>
        ) : (
          <span aria-hidden className="w-[80px]" />
        )}

        <span className="text-xs text-[#7975a8]">
          {t("onboarding.shell.stepOf", {
            current: currentIndex,
            total: STEPS.length,
          })}
        </span>

        {onNext ? (
          <button
            type="button"
            onClick={onNext}
            disabled={nextDisabled}
            className="rounded-md bg-[#ec1b69] px-5 py-2 text-sm font-medium text-[#ececff] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {resolvedNextLabel}
          </button>
        ) : (
          <Link
            href={nextHref}
            aria-disabled={nextDisabled}
            className={`rounded-md bg-[#ec1b69] px-5 py-2 text-sm font-medium text-[#ececff] transition-opacity hover:opacity-90 ${
              nextDisabled ? "pointer-events-none opacity-50" : ""
            }`}
          >
            {resolvedNextLabel}
          </Link>
        )}
      </div>
    </div>
  );
}

function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => {
        const stepNumber = i + 1;
        const isDone = stepNumber < current;
        const isCurrent = stepNumber === current;
        return (
          <div key={i} className="flex flex-1 items-center gap-2">
            <span
              className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border text-xs font-medium transition-colors ${
                isCurrent
                  ? "border-[#ec1b69] bg-[#ec1b69] text-[#ececff]"
                  : isDone
                  ? "border-[#ec1b69] bg-[#ec1b69]/20 text-[#ec1b69]"
                  : "border-[#1b1833] text-[#7975a8]"
              }`}
            >
              {stepNumber}
            </span>
            {i < total - 1 ? (
              <span
                className={`h-px flex-1 ${
                  isDone ? "bg-[#ec1b69]" : "bg-[#1b1833]"
                }`}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
