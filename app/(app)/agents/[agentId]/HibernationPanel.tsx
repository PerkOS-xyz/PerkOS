"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Moon, Sun, Loader2, Archive, History, Lock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

import {
  getHibernationStatusApi,
  hibernateAgentApi,
  wakeAgentApi,
  getAgentBackupsApi,
  setBackupRetentionApi,
  type HibernationApiState,
  type HibernationStatus,
  type AgentBackup,
  type AgentBackupsResult,
} from "../../../lib/perkosApi";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { useState } from "react";

type Props = {
  agentId: string;
  agentName: string;
  /**
   * Whether the agent is in a state where hibernation makes sense.
   * - true: ECS-deployed (status==="ready") and we can talk to AWS.
   * - false: not provisioned yet, or in a non-ECS deploy mode.
   */
  ecsDeployed: boolean;
};

function stateTone(state: HibernationApiState): {
  badgeClass: string;
  label: string;
} {
  switch (state) {
    case "active":
      return {
        badgeClass: "bg-emerald-500/20 text-emerald-300",
        label: "Active",
      };
    case "hibernating":
      return {
        badgeClass: "bg-amber-500/20 text-amber-300",
        label: "Hibernating…",
      };
    case "hibernated":
      return {
        badgeClass: "bg-slate-500/20 text-slate-300",
        label: "Hibernated",
      };
    case "waking":
      return {
        badgeClass: "bg-sky-500/20 text-sky-300",
        label: "Waking up…",
      };
  }
}

function formatBytes(n: number | undefined): string {
  if (!n || n <= 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    return new Date(value).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

// Human label for one backup — its S3 timestamp, falling back to the snapshot
// id (state-<ts>) when LastModified is unavailable.
function backupLabel(b: AgentBackup): string {
  return formatDate(b.createdAt ?? undefined) ?? b.ts;
}

const RETENTION_PRESETS = [1, 3, 5, 10, 20, 30];

export function HibernationPanel({ agentId, agentName, ecsDeployed }: Props) {
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const statusQuery = useQuery<HibernationStatus>({
    queryKey: ["agent-hibernation", agentId],
    queryFn: () => getHibernationStatusApi({ agentId }),
    enabled: ecsDeployed,
    // Poll while the task is in a transient state.
    refetchInterval: (q) => {
      const s = (q.state.data as HibernationStatus | undefined)?.state;
      return s === "hibernating" || s === "waking" ? 5_000 : false;
    },
  });

  const hibernateMutation = useMutation({
    mutationFn: () => hibernateAgentApi({ agentId }),
    onSuccess: (result) => {
      toast.success(
        result.previousDesiredCount === 0
          ? `${agentName} was already hibernated.`
          : `${agentName} is hibernating — billing will stop once the task drains.`,
      );
      queryClient.invalidateQueries({ queryKey: ["agent-hibernation", agentId] });
      setConfirmOpen(false);
    },
    onError: (err: Error) => {
      toast.error("Couldn't hibernate agent", { description: err.message });
      setConfirmOpen(false);
    },
  });

  const wakeMutation = useMutation({
    mutationFn: () => wakeAgentApi({ agentId }),
    onSuccess: (result) => {
      toast.success(
        result.previousDesiredCount >= 1
          ? `${agentName} is already awake.`
          : `${agentName} is starting back up — give it ~30s to be ready.`,
      );
      queryClient.invalidateQueries({ queryKey: ["agent-hibernation", agentId] });
    },
    onError: (err: Error) => {
      toast.error("Couldn't wake agent", { description: err.message });
    },
  });

  // State backups — encrypted snapshots in S3 (inventory + keep-last-N).
  const backupsQuery = useQuery<AgentBackupsResult>({
    queryKey: ["agent-backups", agentId],
    queryFn: () => getAgentBackupsApi({ agentId }),
    enabled: ecsDeployed,
  });

  const retentionMutation = useMutation({
    mutationFn: (n: number) => setBackupRetentionApi({ agentId, retention: n }),
    onSuccess: (r) => {
      toast.success(
        `Keeping the last ${r.retention} backups — applies after the next restart.`,
      );
      queryClient.invalidateQueries({ queryKey: ["agent-backups", agentId] });
    },
    onError: (err: Error) => {
      toast.error("Couldn't update retention", { description: err.message });
    },
  });

  if (!ecsDeployed) {
    return null;
  }

  if (statusQuery.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Archive className="h-4 w-4 text-muted-foreground" />
            Hibernation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-10 animate-pulse rounded-md bg-muted" />
        </CardContent>
      </Card>
    );
  }

  if (statusQuery.error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Archive className="h-4 w-4 text-muted-foreground" />
            Hibernation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">
            {(statusQuery.error as Error).message}
          </p>
        </CardContent>
      </Card>
    );
  }

  const status = statusQuery.data;
  if (!status) return null;

  const tone = stateTone(status.state);
  const isHibernated = status.state === "hibernated";
  const isTransient = status.state === "hibernating" || status.state === "waking";

  const hibernatedAt = formatDate(status.hibernatedAt);
  const wakeStartedAt = formatDate(status.wakeStartedAt);

  const backups = backupsQuery.data?.backups ?? [];
  const retention = backupsQuery.data?.retention ?? 5;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Archive className="h-4 w-4 text-muted-foreground" />
              Hibernation
            </CardTitle>
            <CardDescription>
              Pause the agent&apos;s container to stop billing while you&apos;re not
              using it — sending a message wakes it back up. On the latest
              runtime its state is snapshotted (encrypted) and restored on
              wake; agents on older images restart fresh.
            </CardDescription>
          </div>
          <Badge variant="secondary" className={cn("border-0", tone.badgeClass)}>
            {tone.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            Desired / Running
          </dt>
          <dd className="text-right font-mono text-foreground">
            {status.desiredCount} / {status.runningCount}
            {status.pendingCount > 0 ? ` (+${status.pendingCount} pending)` : ""}
          </dd>

          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            Snapshot size
          </dt>
          <dd className="text-right text-foreground">
            {formatBytes(status.snapshot.sizeBytes)}
          </dd>

          {hibernatedAt ? (
            <>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                Hibernated at
              </dt>
              <dd className="text-right text-foreground">{hibernatedAt}</dd>
            </>
          ) : null}

          {wakeStartedAt ? (
            <>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                Wake started at
              </dt>
              <dd className="text-right text-foreground">{wakeStartedAt}</dd>
            </>
          ) : null}
        </dl>

        <div className="flex flex-wrap items-center gap-2">
          {isHibernated ? (
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
              Wake agent
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setConfirmOpen(true)}
              disabled={hibernateMutation.isPending || isTransient}
              className="gap-1.5"
            >
              {hibernateMutation.isPending || status.state === "hibernating" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Moon className="h-3.5 w-3.5" />
              )}
              Hibernate
            </Button>
          )}
          {isTransient ? (
            <span className="text-xs text-muted-foreground">
              Polling status every 5s…
            </span>
          ) : null}
        </div>

        {/* State backups — encrypted snapshot inventory + retention. */}
        <div className="rounded-md border border-border/50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <History className="h-4 w-4 text-muted-foreground" />
              State backups
              {backups.length > 0 ? (
                <Badge variant="secondary" className="border-0">
                  {backups.length}
                </Badge>
              ) : null}
            </div>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              Keep last
              <select
                className="rounded border border-border bg-background px-1.5 py-0.5 text-foreground disabled:opacity-50"
                value={retention}
                disabled={retentionMutation.isPending || backupsQuery.isLoading}
                onChange={(e) =>
                  retentionMutation.mutate(Number(e.target.value))
                }
              >
                {(RETENTION_PRESETS.includes(retention)
                  ? RETENTION_PRESETS
                  : [retention, ...RETENTION_PRESETS]
                ).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              {retentionMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : null}
            </label>
          </div>

          {backupsQuery.isLoading ? (
            <div className="mt-2 h-8 animate-pulse rounded bg-muted" />
          ) : backupsQuery.error ? (
            <p className="mt-2 text-xs text-destructive">
              {(backupsQuery.error as Error).message}
            </p>
          ) : backups.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              No backups yet. Encrypted state snapshots are captured
              automatically every few minutes while the agent runs, and restored
              when it wakes. (Agents on older runtime images restart fresh —
              relaunch to pick up the latest.)
            </p>
          ) : (
            <ul className="mt-2 flex flex-col divide-y divide-border/40">
              {backups.map((b) => (
                <li
                  key={b.ts}
                  className="flex items-center justify-between gap-2 py-1.5 text-xs"
                >
                  <span className="text-foreground">{backupLabel(b)}</span>
                  <span className="font-mono text-muted-foreground">
                    {formatBytes(b.bytes)}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
            <Lock className="h-3 w-3" />
            Encrypted client-side (AES-256) before upload — only your agent can
            decrypt them.
          </p>
        </div>
      </CardContent>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Hibernate ${agentName}?`}
        description="Stops the running container and pauses billing. Sending a message wakes it (~30-60s to come back). On the latest runtime its encrypted state is restored on wake; agents on older images restart fresh, so any in-progress context is lost."
        confirmLabel="Hibernate agent"
        pending={hibernateMutation.isPending}
        onConfirm={() => hibernateMutation.mutate()}
      />
    </Card>
  );
}
