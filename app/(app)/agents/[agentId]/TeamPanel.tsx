"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Loader2, LogOut, Plus, Users, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { getWalletAgents, setAgentHost, type AgentRow } from "../../../lib/perkosApi";
import { ConfirmDialog } from "../../../components/ConfirmDialog";

/**
 * Team panel (Phase 1 multi-agent). Two modes:
 *  - This agent is a HOST → manage its co-residents (add/remove other agents to
 *    run inside its runtime).
 *  - This agent is itself a co-resident → show which host it runs in + leave.
 * A team change reprovisions the host so one runtime serves the whole team.
 */
export function TeamPanel({ agent }: { agent: AgentRow }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const agentsQuery = useQuery({
    queryKey: ["wallet-agents", agent.walletAddress],
    queryFn: () => getWalletAgents(agent.walletAddress),
    enabled: Boolean(agent.walletAddress),
  });
  const agents = useMemo(() => agentsQuery.data ?? [], [agentsQuery.data]);

  const coResidents = useMemo(
    () => agents.filter((a) => a.hostAgent === agent.id),
    [agents, agent.id],
  );
  // Agents that can join THIS host: owner's other PerkOS-managed agents that
  // aren't already co-resident and aren't hosts of others.
  const addable = useMemo(
    () =>
      agents.filter(
        (a) =>
          a.id !== agent.id &&
          !a.external &&
          !a.hostAgent &&
          !agents.some((x) => x.hostAgent === a.id),
      ),
    [agents, agent.id],
  );

  const [selected, setSelected] = useState("");
  const [leaveOpen, setLeaveOpen] = useState(false);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["wallet-agents", agent.walletAddress] });

  const setHost = useMutation({
    mutationFn: (v: { id: string; host: string | null }) => setAgentHost(v.id, v.host),
    onSuccess: () => {
      toast.success(t("agentDetail.team.updated"));
      setSelected("");
      invalidate();
    },
    onError: (e: Error) => toast.error(t("agentDetail.team.updateError"), { description: e.message }),
    onSettled: () => setLeaveOpen(false),
  });

  // ---- This agent is a co-resident: show its host + a Leave button ----------
  if (agent.hostAgent) {
    const host = agents.find((a) => a.id === agent.hostAgent);
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-muted-foreground" />
            {t("agentDetail.team.title")}
          </CardTitle>
          <CardDescription>
            {t("agentDetail.team.coResidentDescription", { host: host ? `“${host.name}”` : t("agentDetail.team.anotherAgent") })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-destructive hover:text-destructive"
            onClick={() => setLeaveOpen(true)}
          >
            <LogOut className="h-4 w-4" />
            {t("agentDetail.team.leave")}
          </Button>
        </CardContent>
        <ConfirmDialog
          open={leaveOpen}
          onOpenChange={setLeaveOpen}
          title={t("agentDetail.team.leaveTitle")}
          description={t("agentDetail.team.leaveDescription")}
          confirmLabel={t("agentDetail.team.leaveConfirm")}
          pending={setHost.isPending}
          onConfirm={() => setHost.mutate({ id: agent.id, host: null })}
        />
      </Card>
    );
  }

  // External agents run on their own host — they can't host a PerkOS team.
  if (agent.external) return null;

  // ---- Host view: manage co-residents ---------------------------------------
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-muted-foreground" />
            {t("agentDetail.team.title")}
          </CardTitle>
          <Badge variant="secondary">
            {t("agentDetail.team.coResidents", { count: coResidents.length })}
          </Badge>
        </div>
        <CardDescription>
          {t("agentDetail.team.description")}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {agentsQuery.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> {t("agentDetail.common.loading")}
          </div>
        ) : coResidents.length > 0 ? (
          <ul className="flex flex-col gap-1">
            {coResidents.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2 text-sm"
              >
                <span>{c.name}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 text-destructive hover:text-destructive"
                  disabled={setHost.isPending}
                  onClick={() => setHost.mutate({ id: c.id, host: null })}
                >
                  <X className="h-3.5 w-3.5" />
                  {t("agentDetail.team.remove")}
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t("agentDetail.team.empty")}
          </p>
        )}

        {addable.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="h-9 min-w-48 rounded-md border border-border bg-background px-3 text-sm"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              <option value="">{t("agentDetail.team.chooseAgent")}</option>
              {addable.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              className="gap-2"
              disabled={!selected || setHost.isPending}
              onClick={() => setHost.mutate({ id: selected, host: agent.id })}
            >
              <Plus className="h-4 w-4" />
              {t("agentDetail.team.add")}
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            {t("agentDetail.team.noneAvailable")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
