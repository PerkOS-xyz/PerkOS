"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
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

function formatDate(value?: string, locale?: string): string | undefined {
  if (!value) return undefined;
  try {
    return new Date(value).toLocaleString(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return value;
  }
}

export function UpgradePanel({ agentId, agentName, ecsDeployed }: Props) {
  const { t, i18n } = useTranslation();
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
      toast.success(t("agentDetail.upgrade.complete"), {
        description: t("agentDetail.upgrade.completeDescription", {
          name: agentName,
          to: result.to,
          from: result.from ?? t("agentDetail.upgrade.unknownVersion"),
          seconds: (result.drainedAfterMs / 1000).toFixed(1),
        }),
      });
      queryClient.invalidateQueries({ queryKey: ["agent-upgrade-options", agentId] });
      queryClient.invalidateQueries({ queryKey: ["agent-hibernation", agentId] });
      queryClient.invalidateQueries({ queryKey: ["wallet-agents"] });
      setConfirmOpen(false);
      setUserSelectedTag(null);
    },
    onError: (err: Error) => {
      toast.error(t("agentDetail.upgrade.failed"), { description: err.message });
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
            {t("agentDetail.upgrade.title")}
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
            {t("agentDetail.upgrade.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">
            {(optionsQuery.error as Error).message}
          </p>
          <Button variant="outline" size="sm" className="mt-3 gap-1.5" onClick={() => optionsQuery.refetch()}>
            <RefreshCw className="h-3.5 w-3.5" />
            {t("agentDetail.upgrade.retry")}
          </Button>
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
              {t("agentDetail.upgrade.title")}
            </CardTitle>
            <CardDescription>
              {t("agentDetail.upgrade.description")}
            </CardDescription>
          </div>
          {currentTag ? (
            <div className="flex flex-col items-end gap-1">
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {t("agentDetail.upgrade.installedVersion")}
              </span>
              <Badge variant="secondary" className="max-w-64 border-0 bg-muted font-mono text-xs">
                <span className="truncate">{currentTag}</span>
              </Badge>
            </div>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {noUpdates ? (
          <p className="text-sm text-muted-foreground">
            {t("agentDetail.upgrade.latest")}
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <Label htmlFor="upgrade-tag-select">{t("agentDetail.upgrade.available")}</Label>
              <Select
                value={targetTag}
                onValueChange={(v) => setUserSelectedTag(v)}
              >
                <SelectTrigger id="upgrade-tag-select">
                  <SelectValue placeholder={t("agentDetail.upgrade.pickTag")} />
                </SelectTrigger>
                <SelectContent>
                  {available.map((opt) => (
                    <SelectItem key={opt.imageTag} value={opt.imageTag}>
                      <UpgradeOptionLabel opt={opt} locale={i18n.language} />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedOption?.notes ? (
                <p className="text-xs text-muted-foreground">
                  {t("agentDetail.upgrade.notes")}: {selectedOption.notes}
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
                {t("agentDetail.upgrade.action")}
              </Button>
            </div>
          </>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => optionsQuery.refetch()}
          disabled={optionsQuery.isFetching}
          className="w-fit gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5${optionsQuery.isFetching ? " animate-spin" : ""}`} />
          {optionsQuery.isFetching ? t("agentDetail.upgrade.checking") : t("agentDetail.upgrade.refresh")}
        </Button>
      </CardContent>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("agentDetail.upgrade.confirmTitle", { name: agentName })}
        description={
          targetTag
            ? t("agentDetail.upgrade.confirmDescription", { tag: targetTag })
            : t("agentDetail.upgrade.pickFirst")
        }
        confirmLabel={t("agentDetail.upgrade.confirmLabel")}
        pending={upgradeMutation.isPending}
        onConfirm={() => upgradeMutation.mutate()}
      />
    </Card>
  );
}

function UpgradeOptionLabel({ opt, locale }: { opt: AvailableUpgrade; locale: string }) {
  const date = formatDate(opt.publishedAt, locale);
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-xs">{opt.imageTag}</span>
      {date ? (
        <span className="text-xs text-muted-foreground">· {date}</span>
      ) : null}
    </div>
  );
}
