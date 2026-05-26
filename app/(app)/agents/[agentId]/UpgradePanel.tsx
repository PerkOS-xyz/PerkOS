"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowUpCircle, Loader2, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  getUpgradeOptionsApi,
  upgradeAgentApi,
  type AvailableUpgrade,
  type UpgradeOptions,
} from "../../../lib/perkosApi";
import { ConfirmDialog } from "../../../components/ConfirmDialog";

type Props = {
  agentId: string;
  agentName: string;
  /** Whether the agent is ECS-deployed and the upgrade flow makes sense. */
  ecsDeployed: boolean;
};

function formatDate(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    return new Date(value).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return value;
  }
}

export function UpgradePanel({ agentId, agentName, ecsDeployed }: Props) {
  const queryClient = useQueryClient();
  // `null` = user hasn't picked yet; the derived `effectiveTarget` below
  // defaults to the newest available tag in that case. We deliberately
  // don't sync state in an effect — it's both unnecessary and the
  // project ESLint config rejects setState-in-effect.
  const [userSelectedTag, setUserSelectedTag] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const optionsQuery = useQuery<UpgradeOptions>({
    queryKey: ["agent-upgrade-options", agentId],
    queryFn: () => getUpgradeOptionsApi({ agentId }),
    enabled: ecsDeployed,
  });

  const available = optionsQuery.data?.available ?? [];
  const currentTag = optionsQuery.data?.currentImageTag ?? null;
  const firstAvailableTag = available[0]?.imageTag;
  // Effective target = whatever the user picked, falling back to the
  // newest available tag. Derived inline so we never have to sync state.
  const targetTag = userSelectedTag ?? firstAvailableTag ?? "";

  const upgradeMutation = useMutation({
    mutationFn: () => upgradeAgentApi({ agentId, imageTag: targetTag }),
    onSuccess: (result) => {
      toast.success("Upgrade complete", {
        description: `${agentName} is now on ${result.to}${
          result.from ? ` (was ${result.from})` : ""
        }. State restored in ${(result.drainedAfterMs / 1000).toFixed(1)}s.`,
      });
      queryClient.invalidateQueries({ queryKey: ["agent-upgrade-options", agentId] });
      queryClient.invalidateQueries({ queryKey: ["agent-hibernation", agentId] });
      queryClient.invalidateQueries({ queryKey: ["wallet-agents"] });
      setConfirmOpen(false);
      setUserSelectedTag(null);
    },
    onError: (err: Error) => {
      toast.error("Upgrade failed", { description: err.message });
      setConfirmOpen(false);
    },
  });

  if (!ecsDeployed) return null;

  if (optionsQuery.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ArrowUpCircle className="h-4 w-4 text-muted-foreground" />
            Runtime upgrade
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-10 animate-pulse rounded-md bg-muted" />
        </CardContent>
      </Card>
    );
  }

  if (optionsQuery.error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ArrowUpCircle className="h-4 w-4 text-muted-foreground" />
            Runtime upgrade
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">
            {(optionsQuery.error as Error).message}
          </p>
        </CardContent>
      </Card>
    );
  }

  const noUpdates = available.length === 0;
  const selectedOption = available.find((a) => a.imageTag === targetTag);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <ArrowUpCircle className="h-4 w-4 text-muted-foreground" />
              Runtime upgrade
            </CardTitle>
            <CardDescription>
              Upgrade to a newer runtime image. The agent hibernates, the new
              container starts on the new image, and your conversation history
              is restored from the snapshot. Downtime is typically 60-90s.
            </CardDescription>
          </div>
          {currentTag ? (
            <Badge variant="secondary" className="border-0 bg-muted font-mono text-xs">
              {currentTag}
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {noUpdates ? (
          <p className="text-sm text-muted-foreground">
            You&apos;re on the latest available image.
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <Label htmlFor="upgrade-tag-select">Available upgrades</Label>
              <Select
                value={targetTag}
                onValueChange={(v) => setUserSelectedTag(v)}
              >
                <SelectTrigger id="upgrade-tag-select">
                  <SelectValue placeholder="Pick a tag" />
                </SelectTrigger>
                <SelectContent>
                  {available.map((opt) => (
                    <SelectItem key={opt.imageTag} value={opt.imageTag}>
                      <UpgradeOptionLabel opt={opt} />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedOption?.notes ? (
                <p className="text-xs text-muted-foreground">
                  Notes: {selectedOption.notes}
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                onClick={() => setConfirmOpen(true)}
                disabled={
                  upgradeMutation.isPending || !targetTag || targetTag === currentTag
                }
                className="gap-1.5"
              >
                {upgradeMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ArrowUpCircle className="h-3.5 w-3.5" />
                )}
                Upgrade
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => optionsQuery.refetch()}
                disabled={optionsQuery.isFetching}
                className="gap-1.5"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5${
                    optionsQuery.isFetching ? " animate-spin" : ""
                  }`}
                />
                Refresh
              </Button>
            </div>
          </>
        )}
      </CardContent>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Upgrade ${agentName}?`}
        description={
          targetTag
            ? `Hibernates the current task, registers a new task definition pinned to ${targetTag}, and starts a fresh container that restores from the snapshot. The agent is unreachable for ~60-90 seconds. State (memory + history) is preserved.`
            : "Pick a target tag first."
        }
        confirmLabel="Upgrade agent"
        pending={upgradeMutation.isPending}
        onConfirm={() => upgradeMutation.mutate()}
      />
    </Card>
  );
}

function UpgradeOptionLabel({ opt }: { opt: AvailableUpgrade }) {
  const date = formatDate(opt.publishedAt);
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-xs">{opt.imageTag}</span>
      {date ? (
        <span className="text-xs text-muted-foreground">· {date}</span>
      ) : null}
    </div>
  );
}
