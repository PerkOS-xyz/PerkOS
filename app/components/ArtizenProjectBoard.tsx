"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import type { Task, AgentRow } from "../lib/perkosApi";
import { ArtizenCreatorWorkflow } from "./ArtizenCreatorWorkflow";

export function ArtizenAgentStatus({ state }: { state?: string }) {
  const { i18n } = useTranslation(); const es = i18n.language.startsWith("es");
  const label = state === "executing" ? (es ? "Trabajando" : "Working") : state === "queued" ? (es ? "Preparando" : "Preparing") : state === "awaiting_stop" ? (es ? "Volviendo a reposo" : "Returning to rest") : (es ? "En reposo" : "Resting");
  return <span className={`rounded-md border px-2 py-1 text-xs ${state && state !== "resting" ? "border-amber-500/30 text-amber-500" : "border-border text-muted-foreground"}`}>{label}</span>;
}

/** The budget controller owns task transitions; cards are intentionally not draggable. */
export function ArtizenProjectBoard({ tasks, projectId }: { tasks: Task[]; projectId: string }) {
  const { i18n } = useTranslation();
  const es = i18n.language.startsWith("es");
  const phases = [["Backlog", es ? "Por hacer" : "To do"], ["In progress", es ? "En curso" : "In progress"], ["Review", es ? "Revisión humana" : "Human review"], ["Done", es ? "Completadas" : "Done"]];
  return <section className="space-y-4" aria-label={es ? "Tareas de Artizen" : "Artizen tasks"}>
    <ArtizenWorkLink projectId={projectId} />
    <p className="text-sm text-muted-foreground">{es ? "Cada solicitud crea una tarea. Revisa y aprueba el ejemplo en el flujo de Artizen; no se publica contenido." : "Each request creates a task. Review and approve the example in the Artizen workflow; no content is published."}</p>
    <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-4">
      {phases.map(([status, label]) => <section key={status} className="min-w-0 rounded-xl border border-border p-3">
        <h3 className="mb-3 text-sm font-medium">{label} · {tasks.filter(t => t.status === status).length}</h3>
        <div className="space-y-3">{tasks.filter(t => t.status === status).map(task => <Link key={task.id} href={`/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(task.id!)}`} className="block min-w-0 rounded-lg border border-primary/30 p-3 hover:bg-muted/30 focus-visible:outline-2 focus-visible:outline-primary">
          <h4 className="break-words text-sm font-medium">{task.name === "Prepare supporter update" ? (es ? "Preparar actualización" : task.name) : task.name === "Revise supporter update" ? (es ? "Revisar actualización" : task.name) : task.name}</h4>
          <p className="mt-2 text-xs text-muted-foreground">Hermes · {task.result ? (es ? "Borrador guardado" : "Draft saved") : task.executionPhase === "settled" || task.executionPhase === "cancelled" ? (es ? "Finalizó sin borrador" : "Ended without a draft") : (es ? "Resultado pendiente" : "Result pending")}</p>
        </Link>)}</div>
        {!tasks.some(t => t.status === status) && <p className="text-xs text-muted-foreground">{es ? "No hay tareas en esta fase." : "No tasks in this phase."}</p>}
      </section>)}
    </div>
  </section>;
}

export function ArtizenWorkLink({ projectId }: { projectId: string }) {
  const { i18n } = useTranslation(); const es = i18n.language.startsWith("es");
  return <Link className="inline-flex min-h-10 items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground" href={`/projects/${encodeURIComponent(projectId)}#artizen-workflow`}>{es ? "Trabajar con Hermes" : "Work with Hermes"}</Link>;
}

export function ArtizenAgentDetail({ agent }: { agent: AgentRow }) {
  const { i18n } = useTranslation(); const es = i18n.language.startsWith("es");
  return <main className="mx-auto w-full max-w-4xl space-y-4">
    <Link href="/agents" className="text-sm text-muted-foreground underline">{es ? "Volver a agentes" : "Back to agents"}</Link>
    <h1 className="break-words text-2xl font-semibold">{agent.displayName ?? "Artizen Creator Companion"}</h1>
    <p className="text-sm text-muted-foreground">{es ? "Hermes administrado · Un agente para este proyecto, con ejecución bajo demanda y presupuesto controlado. No necesita un gateway de chat o voz." : "Managed Hermes · One agent for this project, with on-demand execution and a controlled budget. No chat or voice gateway is required."}</p>
    {agent.executionProjectId && <>
      <ArtizenWorkLink projectId={agent.executionProjectId} />
      {!agent.shared && <ArtizenCreatorWorkflow projectId={agent.executionProjectId} />}
    </>}
  </main>;
}
