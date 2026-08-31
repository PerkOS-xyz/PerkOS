"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Sun, X } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

import {
  ensureAgentAwakeApi,
  getHibernationStatusApi,
  type HibernationStatus,
} from "../../../lib/perkosApi";

type Props = {
  agentId: string;
  agentName: string;
  /**
   * Whether the agent is in a state where auto-wake makes sense.
   * Pass false when the agent isn't ECS-deployed (Local/VPS modes).
   */
  ecsDeployed: boolean;
};

const DISMISSED_KEY = (id: string) => `perkos:autowake-dismissed:${id}`;

/**
 * Banner that surfaces "this agent is asleep" + a one-click wake.
 * Only renders when:
 *   - ecsDeployed
 *   - hibernation state is hibernated | hibernating | waking
 *   - user hasn't explicitly dismissed for this agent in localStorage
 *
 * The dismissed flag is per-agent; reloading after a successful wake
 * clears it implicitly because the banner stops rendering when state
 * goes back to "active".
 */
export function AutoWakeBanner({ agentId, agentName, ecsDeployed }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  // Lazy initializer reads localStorage exactly once on first client
  // render. Project ESLint config rejects setState-in-effect; this
  // pattern avoids it and also avoids the post-mount flicker.
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(DISMISSED_KEY(agentId)) === "1";
  });

  const statusQuery = useQuery<HibernationStatus>({
    queryKey: ["agent-hibernation", agentId],
    queryFn: () => getHibernationStatusApi({ agentId }),
    enabled: ecsDeployed,
    refetchInterval: (q) => {
      const s = (q.state.data as HibernationStatus | undefined)?.state;
      return s === "hibernating" || s === "waking" ? 5_000 : false;
    },
  });

  const wakeMutation = useMutation({
    // Don't wait server-side — let the UI poll the hibernation status
    // for the transition rather than holding the HTTP request open.
    mutationFn: () =>
      ensureAgentAwakeApi({ agentId, waitForRunning: false }),
    onSuccess: (result) => {
      if (result.triggeredWake) {
        toast.success(t("agentDetail.wake.wakingToast", { name: agentName }), {
          description: t("agentDetail.wake.readyEstimate"),
        });
      }
      queryClient.invalidateQueries({ queryKey: ["agent-hibernation", agentId] });
    },
    onError: (err: Error) => {
      toast.error(t("agentDetail.wake.error"), { description: err.message });
    },
  });

  if (!ecsDeployed) return null;
  if (statusQuery.isLoading || !statusQuery.data) return null;
  if (dismissed) return null;

  const state = statusQuery.data.state;
  if (state === "active") return null;

  const dismiss = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DISMISSED_KEY(agentId), "1");
    }
    setDismissed(true);
  };

  // Render variants by state so the copy + CTA match reality.
  if (state === "hibernated") {
    return (
      <div className="flex items-center justify-between gap-3 rounded-md border border-slate-500/30 bg-slate-500/10 px-4 py-3 text-sm">
        <span className="text-slate-200">
          {t("agentDetail.wake.hibernatedMessage", { name: agentName })}
        </span>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => wakeMutation.mutate()}
            disabled={wakeMutation.isPending}
            className="gap-1.5"
          >
            {wakeMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sun className="h-3.5 w-3.5" />
            )}
            {t("agentDetail.wake.now")}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={dismiss}
            aria-label={t("agentDetail.common.dismiss")}
            className="h-7 w-7"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  // hibernating or waking — both are transient; banner just reports
  // status. No action since the wake (or hibernate) is already in
  // flight server-side.
  const isWaking = state === "waking";
  const tone = isWaking
    ? "border-sky-500/30 bg-sky-500/10 text-sky-200"
    : "border-amber-500/30 bg-amber-500/10 text-amber-200";
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-md border px-4 py-3 text-sm ${tone}`}
    >
      <span className="flex items-center gap-2">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {isWaking
          ? t("agentDetail.wake.progress", { name: agentName, running: statusQuery.data.runningCount, desired: statusQuery.data.desiredCount })
          : t("agentDetail.wake.hibernating", { name: agentName })}
      </span>
      <Button
        variant="ghost"
        size="icon"
        onClick={dismiss}
        aria-label={t("agentDetail.common.dismiss")}
        className="h-7 w-7"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
