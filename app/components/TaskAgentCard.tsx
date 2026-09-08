"use client";

import { useTranslation } from "react-i18next";
import type { TaskAgentView } from "../lib/perkosApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function taskAgentName(name: string, onDemand: boolean, agent?: TaskAgentView) {
  return agent?.displayName?.trim() || (onDemand ? "Hermes" : name);
}

/** Last-read metadata, NOT live presence and NOT the historical task's phase. */
export function TaskAgentCard({ name, onDemand, agent }: { name: string; onDemand: boolean; agent?: TaskAgentView }) {
  const { i18n } = useTranslation(); const es = i18n.language.startsWith("es");
  const label = taskAgentName(name, onDemand, agent);
  const states: Record<string, string> = es
    ? { resting: "En reposo", queued: "Preparando", executing: "Trabajando", awaiting_stop: "Volviendo a reposo" }
    : { resting: "Resting", queued: "Preparing", executing: "Working", awaiting_stop: "Returning to rest" };
  const state = agent?.executionMode === "artizen-on-demand" ? states[agent.executionState ?? ""] : undefined;
  return <Card>
    <CardHeader><CardTitle className="text-base">{es ? "Agente asignado a esta tarea" : "Agent on this task"}</CardTitle></CardHeader>
    <CardContent className="flex min-w-0 items-center gap-3">
      <div aria-hidden="true" className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-medium text-primary">{onDemand ? "H" : label.slice(0, 2).toUpperCase()}</div>
      <div className="min-w-0 space-y-1">
        <p className="break-words text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{onDemand ? (es ? "Hermes bajo demanda" : "On-demand Hermes") : (agent?.runtime || (es ? "Runtime sin confirmar" : "Runtime unverified"))}</p>
        {onDemand && <p className="text-xs text-muted-foreground">{state
          ? `${es ? "Último estado consultado" : "Last checked state"}: ${state}`
          : (es ? "Estado sin confirmar" : "State unverified")}</p>}
        {onDemand && <p className="text-xs text-muted-foreground">{es ? "El estado de una tarea anterior no indica que el agente esté trabajando ahora. Actualiza los datos para consultar su estado." : "A previous task's status does not mean the agent is working now. Refresh data to check its state."}</p>}
      </div>
    </CardContent>
  </Card>;
}
