"use client";

/**
 * Progress of a team the server is launching (project doc `launch`). The seats
 * below already show each teammate "Starting up"; this line adds the ones not
 * on the board yet, so the owner sees the whole team arrive even after closing
 * the wizard tab. A note stays for a day when a teammate could not start.
 */

import { useState } from "react";
import { Loader2, UserPlus } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";

import { teamLaunchInProgress, type TeamLaunchProgress } from "../lib/teamLaunch";

const NOTE_MS = 24 * 60 * 60_000;

export function TeamLaunchStatus({ launch, now: nowProp }: { launch?: TeamLaunchProgress; now?: number }) {
  const { t } = useTranslation();
  const [mountedAt] = useState(() => Date.now());
  const now = nowProp ?? mountedAt;
  if (!launch) return null;

  if (teamLaunchInProgress(launch, now)) {
    const settled = launch.launched + launch.failed.length;
    return (
      <div role="status" className="flex flex-col gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
        <p className="flex items-center gap-2 text-sm text-foreground">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" aria-hidden />
          {t("projectRoom.launch.launching", { launched: launch.launched, total: launch.total })}
        </p>
        <div className="flex gap-1" aria-hidden>
          {Array.from({ length: launch.total }, (_, i) => (
            <span
              key={i}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors duration-500",
                i < launch.launched
                  ? "bg-primary"
                  : i < settled
                    ? "bg-muted-foreground/30"
                    : i === settled
                      ? "animate-pulse bg-primary/40"
                      : "bg-white/10",
              )}
            />
          ))}
        </div>
      </div>
    );
  }

  const at = launch.updatedAt ? Date.parse(launch.updatedAt) : Number.NaN;
  const recent = Number.isFinite(at) && now - at < NOTE_MS;
  if (!recent || launch.failed.length === 0 || (launch.status !== "partial" && launch.status !== "failed")) {
    return null;
  }
  return (
    <p
      role="note"
      title={launch.failed.map((f) => `${f.role}: ${f.error}`).join("\n")}
      className="flex items-center gap-2 rounded-lg border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground"
    >
      <UserPlus className="h-4 w-4 shrink-0 text-primary" aria-hidden />
      {launch.status === "partial"
        ? t("projectRoom.launch.partial", {
            launched: launch.launched,
            total: launch.total,
            names: launch.failed.map((f) => f.role).join(", "),
          })
        : t("projectRoom.launch.failed")}
    </p>
  );
}
