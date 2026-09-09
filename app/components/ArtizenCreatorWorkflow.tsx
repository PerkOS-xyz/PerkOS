"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { authedFetch } from "../lib/apiClient";
import { ConfirmDialog } from "./ConfirmDialog";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { ArtizenFormatReview, type FormatReview } from "./ArtizenFormatReview";
import { ArtizenRunFailure, isArtizenUnsuccessful } from "./ArtizenRunFailure";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type DraftResult = { draft: string; reviewNotes: string[]; sourcesUsed: string[]; formatReview?: FormatReview };
type Run = { requestId: string; action: "prepare-update" | "revise-update";
  phase: "queued" | "executing" | "awaiting_stop" | "settled" | "cancelled";
  stopReason?: string | null; failureCode?: string;
  result: DraftResult | null; allocatedMicros: number | null; reservedMicros: number;
  createdAtMs: number; scheduledForMs?: number; needsAttention?: boolean; revisionUnchanged?: boolean; draftEchoesNotes?: boolean };
type Memory = { revision: number; text: string; sourceRunId: string | null; updatedAtMs: number };
type WebhookState = { enabled: boolean; status: "disabled" | "armed" | "consumed"; url: null };
type WebhookCredential = { enabled: true; status: "armed"; url: string; secret: string; signatureVersion: "v1" };
type State = { configured: boolean; agentName: string | null; budget: { limitMicros: number; reservedMicros: number; allocatedMicros: number } | null;
  activeRunId: string | null; runReservationMicros: number; runs: Run[]; memory: Memory;
  scheduling?: { enabled: boolean; minDelayMs: number; maxDelayMs: number };
  webhook?: WebhookState;
  draftFormat?: { contract: string; paragraphs: number; minWords: number; maxWords: number } };

const active = (run?: Run) => !!run && !run.needsAttention && ["queued", "executing", "awaiting_stop"].includes(run.phase);
const field = "w-full min-w-0 rounded-lg border border-border bg-background p-3 text-sm";
async function readResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error?.code || "ARTIZEN_UNAVAILABLE");
  return data as T;
}

/** Parent keys this workspace by account and project; no cross-wallet UI state. */
export function ArtizenCreatorWorkflow({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const { i18n } = useTranslation();
  const es = i18n.language.startsWith("es");
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [notes, setNotes] = useState("");
  const [editorialNotes, setEditorialNotes] = useState("");
  const [pending, setPending] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [confirmation, setConfirmation] = useState<{ action: Run["action"]; sourceDraft?: string; scheduledForMs?: number } | null>(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [webhookAction, setWebhookAction] = useState<"rotate" | "disable" | null>(null);
  const [webhookCredential, setWebhookCredential] = useState<WebhookCredential | null>(null);
  const retry = useRef<{ fingerprint: string; requestId: string } | null>(null);
  const base = `/artizen-projects/${encodeURIComponent(projectId)}`;
  const money = (micros: number) => new Intl.NumberFormat(i18n.language, { style: "currency", currency: "USD", maximumFractionDigits: 4 }).format(micros / 1_000_000);
  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const next = await readResponse<State>(await authedFetch(base, { signal }));
      if (!signal?.aborted) {
        if (next.runs.some(r => r.requestId === retry.current?.requestId)) retry.current = null;
        setState(next); setError("");
      }
    } catch (e) { if (!signal?.aborted) setError(e instanceof Error ? e.message : "ARTIZEN_UNAVAILABLE"); }
  }, [base]);
  useEffect(() => {
    const controller = new AbortController();
    void authedFetch(base, { signal: controller.signal }).then(response => readResponse<State>(response)).then(next => {
      if (!controller.signal.aborted) { setState(next); setError(""); }
    }).catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "ARTIZEN_UNAVAILABLE"); });
    return () => controller.abort();
  }, [base]);
  const current = state?.runs[0];
  const activeId = state?.activeRunId;
  const needsPoll = !!activeId && (!current || active(current));
  const notBefore = current?.phase === "queued" ? current.scheduledForMs ?? 0 : 0;
  useEffect(() => {
    if (!activeId || !needsPoll) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let inFlight = false;
    const poll = async () => {
      if (controller.signal.aborted || document.visibilityState === "hidden" || inFlight) return;
      if (notBefore > Date.now()) { timer = setTimeout(() => { void poll(); }, Math.min(notBefore - Date.now(), 86_400_000)); return; }
      inFlight = true;
      try {
        const run = await readResponse<Run>(await authedFetch(`${base}/runs/${activeId}`, { signal: controller.signal }));
        if (controller.signal.aborted) return;
        if (!active(run) && !run.needsAttention) {
          // Publish terminal run, budget and activeRunId together. Publishing the
          // run first changes needsPoll and aborts this effect's final read.
          await load(controller.signal);
          return;
        }
        setState(old => old ? { ...old, runs: old.runs.map(r => r.requestId === run.requestId ? run : r) } : old);
        if (active(run)) timer = setTimeout(() => { void poll(); }, 5000);
      } catch { if (!controller.signal.aborted) setError("ARTIZEN_UNAVAILABLE"); }
      finally { inFlight = false; }
    };
    const visibility = () => {
      if (timer) clearTimeout(timer);
      if (document.visibilityState !== "hidden") void poll();
    };
    timer = setTimeout(() => { void poll(); }, Math.min(Math.max(5000, notBefore - Date.now()), 86_400_000));
    document.addEventListener("visibilitychange", visibility);
    return () => { controller.abort(); if (timer) clearTimeout(timer); document.removeEventListener("visibilitychange", visibility); };
  }, [activeId, needsPoll, notBefore, base, load]);

  function errorText(code: string) {
    const messages: Record<string, [string, string]> = {
      INVALID_SCHEDULE: ["Elige una fecha entre un minuto y 24 horas desde ahora. No se programó un nuevo trabajo.", "Choose a time between one minute and 24 hours from now. No new run was scheduled."],
      STOP_UNCONFIRMED: ["El trabajo ya comenzó; no se canceló. Actualiza su estado.", "The run has already started; it was not cancelled. Refresh its status."],
      PILOT_DISABLED: ["La ejecución del piloto aún no está habilitada.", "Pilot execution is not enabled yet."],
      PILOT_NOT_CONFIGURED: ["Este proyecto aún no tiene un presupuesto habilitado.", "This project does not have an enabled budget yet."],
      WORKSPACE_NOT_READY: ["Asocia primero Hermes al proyecto. No se inició ningún trabajo.", "Link Hermes to the project first. No work was started."],
      OUTPUT_CONTRACT_UNAVAILABLE: ["El proveedor aún no tiene activo el formato estructurado. No se inició consumo; requiere configuración del operador.", "The provider has not enabled structured output yet. No compute started; operator configuration is required."],
      WORKSPACE_CONFLICT: ["La asociación del agente requiere revisión. No se sobrescribieron registros existentes.", "The agent association needs review. Existing records were not overwritten."],
      BUSY: ["Ya hay un trabajo activo. Actualiza su estado antes de reintentar.", "A run is already active. Refresh its status before retrying."],
      BUDGET_EXHAUSTED: ["El presupuesto disponible no alcanza para otra ejecución.", "The available budget cannot cover another run."],
      CONTEXT_TOO_LARGE: ["El contexto excede el límite. Reduce las notas o el ejemplo aprobado.", "Context exceeds the limit. Shorten the notes or approved example."],
      MEMORY_CONFLICT: ["El ejemplo cambió en otra sesión. Actualiza antes de guardar.", "The example changed in another session. Refresh before saving."],
      IDEMPOTENCY_CONFLICT: ["El intento anterior tiene otros datos. Actualiza para revisar su resultado.", "The previous attempt has different data. Refresh to review its result."],
    };
    return messages[code]?.[es ? 0 : 1] ?? (es ? "No se pudo completar la solicitud. Actualiza el estado antes de reintentar." : "The request could not complete. Refresh status before retrying.");
  }
  async function start() {
    if (!confirmation || pending || !notes.trim() || !state?.agentName) return;
    const payload = { ...confirmation, notes: notes.trim(),
      ...(editorialNotes.trim() ? { editorialNotes: editorialNotes.trim() } : {}), confirmed: true };
    const fingerprint = JSON.stringify(payload);
    if (!retry.current) retry.current = { fingerprint, requestId: crypto.randomUUID() };
    if (retry.current.fingerprint !== fingerprint) { setError("IDEMPOTENCY_CONFLICT"); setConfirmation(null); return; }
    setPending(true); setError(""); setNotice("");
    try {
      await readResponse(await authedFetch(`${base}/runs`, { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...payload, requestId: retry.current.requestId }) }));
      retry.current = null; setConfirmation(null); setScheduleDate(""); await load();
    } catch (e) {
      const code = e instanceof Error ? e.message : "ARTIZEN_UNAVAILABLE";
      if (["INVALID_SCHEDULE", "INVALID_INPUT", "PILOT_DISABLED", "PILOT_NOT_CONFIGURED", "BUDGET_EXHAUSTED", "BUSY", "COST_PLAN_EXPIRED"].includes(code)) retry.current = null;
      setError(code); setConfirmation(null);
    }
    finally { setPending(false); }
  }
  function confirmSchedule() {
    const date = new Date(scheduleDate);
    const scheduledForMs = date.getTime();
    const local = Number.isFinite(scheduledForMs) ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}` : "";
    // Reject normalized invalid dates / nonexistent local DST times.
    const now = Date.now();
    if (!Number.isFinite(scheduledForMs) || !state?.scheduling?.enabled || local !== scheduleDate || scheduledForMs < now + state.scheduling.minDelayMs || scheduledForMs > now + state.scheduling.maxDelayMs) {
      setError("INVALID_SCHEDULE"); return;
    }
    setError(""); setConfirmation({ action: "prepare-update", scheduledForMs });
  }
  async function cancelScheduled() {
    if (!cancelId || pending) return;
    setPending(true); setError("");
    try {
      await readResponse(await authedFetch(`${base}/runs/${cancelId}/cancel`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirmed: true }) }));
      setCancelId(null); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "ARTIZEN_UNAVAILABLE"); setCancelId(null); }
    finally { setPending(false); }
  }
  async function saveMemory(text: string, sourceRunId?: string) {
    if (!state) return false;
    setPending(true); setError("");
    try {
      await readResponse(await authedFetch(`${base}/memory`, { method: "PUT", headers: { "content-type": "application/json" },
        body: JSON.stringify({ expectedRevision: state.memory.revision, text, sourceRunId, approved: true }) }));
      setNotice(es ? "Ejemplo guardado. No se publicó contenido." : "Example saved. No content was published.");
      await load(); return true;
    } catch (e) { setError(e instanceof Error ? e.message : "ARTIZEN_UNAVAILABLE"); return false; }
    finally { setPending(false); }
  }
  async function setupAgent() {
    setPending(true); setError("");
    try {
      await readResponse(await authedFetch(`${base}/agent`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirmed: true }) }));
      setSetupOpen(false); await load();
      await queryClient.invalidateQueries({ queryKey: ["wallet-agents"] });
      await queryClient.invalidateQueries({ queryKey: ["wallet-project"] });
      setNotice(es ? "Hermes asociado. Las ejecuciones anteriores ya están en Tareas. No se inició consumo." : "Hermes linked. Previous runs are now in Tasks. No compute was started.");
    } catch (e) { setError(e instanceof Error ? e.message : "ARTIZEN_UNAVAILABLE"); }
    finally { setPending(false); }
  }
  async function rotateWebhook() {
    if (pending) return;
    setPending(true); setError(""); setNotice("");
    try {
      const created = await readResponse<WebhookCredential>(await authedFetch(`${base}/webhook/rotate`, { method: "POST",
        headers: { "content-type": "application/json" }, body: JSON.stringify({ confirmed: true }) }));
      setWebhookAction(null); setWebhookCredential(created); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "ARTIZEN_UNAVAILABLE"); setWebhookAction(null); }
    finally { setPending(false); }
  }
  async function disableWebhook() {
    if (pending) return;
    setPending(true); setError("");
    try {
      await readResponse(await authedFetch(`${base}/webhook/disable`, { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmed: true }) }));
      setWebhookAction(null); setWebhookCredential(null); await load();
      setNotice(es ? "Webhook deshabilitado. La URL anterior ya no acepta eventos." : "Webhook disabled. The previous URL no longer accepts events.");
    } catch (e) { setError(e instanceof Error ? e.message : "ARTIZEN_UNAVAILABLE"); setWebhookAction(null); }
    finally { setPending(false); }
  }
  const status = current?.needsAttention ? (es ? "Requiere revisión operativa" : "Needs operational review") : current ? ({
    queued: current.scheduledForMs !== undefined ? (es ? "Programado · Hermes en reposo" : "Scheduled · Hermes is resting") : (es ? "Preparando Hermes" : "Preparing Hermes"),
    executing: es ? "Hermes está trabajando" : "Hermes is working",
    awaiting_stop: es ? "Confirmando reposo y costo" : "Confirming stop and cost",
    settled: isArtizenUnsuccessful(current) ? (es ? "Intento sin resultado · Hermes en reposo" : "Unsuccessful attempt · Hermes is resting") : (es ? "Hermes en reposo" : "Hermes is resting"),
    cancelled: es ? "Cancelado sin iniciar" : "Cancelled before start",
  })[current.phase] : state?.agentName ? (es ? "Hermes en reposo" : "Hermes is resting") : (es ? "Falta asociar Hermes" : "Link Hermes to continue");
  return <section id="artizen-workflow" className="mt-5 min-w-0 scroll-mt-20 space-y-4 break-words border-t border-border pt-5" aria-label={es ? "Borradores Artizen" : "Artizen drafts"}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="font-semibold">{es ? "Tu actualización para la comunidad" : "Your supporter update"}</h3>
      <Button variant="outline" size="sm" onClick={() => { void load(); }} disabled={pending}>{es ? "Actualizar estado" : "Refresh status"}</Button>
    </div>
    <p className="text-sm text-muted-foreground">{es ? "Un Hermes trabaja sólo con tu autorización, ahora o a una hora confirmada. Los resultados son borradores: no se publica nada ni se activan horarios recurrentes." : "One Hermes works only with your authorization, now or at a confirmed time. Results are drafts: nothing is published and no recurring schedules are enabled."}</p>
    {error && <p role="alert" className="text-sm text-destructive">{errorText(error)}</p>}
    {notice && <p role="status" className="text-sm text-emerald-500">{notice}</p>}
    {!state && !error && <p role="status">{es ? "Cargando…" : "Loading…"}</p>}
    {state && <>
      <div className="min-w-0 space-y-2 rounded-lg border border-border bg-muted/20 p-3">
        <h4 className="text-sm font-medium">{es ? "Hermes bajo demanda" : "On-demand Hermes"}</h4>
        <p role="status" aria-live="polite" className="text-sm">{status}</p>
        {current?.phase === "queued" && current.scheduledForMs !== undefined && <div className="space-y-2">
          <p className="text-sm">{es ? "Ejecución única: " : "One-time run: "}<time dateTime={new Date(current.scheduledForMs).toISOString()}>{new Date(current.scheduledForMs).toLocaleString(i18n.language, { dateStyle: "medium", timeStyle: "long" })}</time></p>
          <p className="text-xs text-muted-foreground">{es ? "La reserva y el cupo permanecen retenidos hasta ejecutar o cancelar. Hermes no consume cómputo mientras espera. Si la API no se recupera dentro de la ventana de ejecución, cancelará el trabajo sin iniciarlo." : "The budget reservation and run slot are held until execution or cancellation. Hermes uses no compute while waiting. If the API does not recover within the execution window, it cancels without starting."}</p>
          <Button variant="outline" disabled={pending} onClick={() => setCancelId(current.requestId)}>{es ? "Cancelar programación" : "Cancel scheduled run"}</Button>
        </div>}
        <p className="text-xs text-muted-foreground">{es
          ? "Tu agente conserva su identidad en el proyecto. Cada trabajo crea una tarea y usa un runtime temporal, sin cómputo ni heartbeats en reposo. El resultado queda en revisión hasta que apruebes el ejemplo."
          : "Your agent keeps its project identity. Each run creates a task and uses a temporary runtime, with no idle compute or heartbeats. Results stay in review until you approve the example."}</p>
        {state.agentName ? <Link className="inline-block text-sm text-primary underline" href={`/agents/${encodeURIComponent(state.agentName)}`}>{es ? "Ver agente Hermes" : "View Hermes agent"}</Link>
          : <Button variant="outline" disabled={pending || !!state.activeRunId} onClick={() => setSetupOpen(true)}>{es ? "Asociar Hermes al proyecto" : "Link Hermes to project"}</Button>}
      </div>
      {current && <ArtizenRunFailure run={current} />}
      {state.budget && <p className="text-xs text-muted-foreground">
        {es ? "Asignado" : "Allocated"}: {money(state.budget.allocatedMicros)} · {es ? "Reservado" : "Reserved"}: {money(state.budget.reservedMicros)} · {es ? "Límite" : "Limit"}: {money(state.budget.limitMicros)}.
        {" "}{es ? "Asignación de infraestructura, no factura cloud definitiva." : "Infrastructure allocation, not a final cloud invoice."}
      </p>}
      {!state.configured && <p className="text-sm text-muted-foreground">{errorText("PILOT_NOT_CONFIGURED")}</p>}
      <label className="block text-sm font-medium" htmlFor="artizen-current-notes">{es ? "¿Qué avances puedes confirmar?" : "What progress can you confirm?"}</label>
      <p id="artizen-facts-help" className="text-xs text-muted-foreground">{es
        ? "Sólo hechos verificados, límites y trabajo pendiente. Usa el campo de abajo para indicar cómo redactarlos."
        : "Only verified facts, limitations and ongoing work. Use the field below to say how to write them."}</p>
      <textarea id="artizen-current-notes" aria-describedby="artizen-facts-help" className={`${field} min-h-28`} maxLength={4000} value={notes} onChange={e => setNotes(e.target.value)}
        placeholder={es ? "Ejemplo: la demo funciona; las pruebas con creadores siguen pendientes." : "Example: the demo works; creator testing is still pending."} />
      <label className="block text-sm font-medium" htmlFor="artizen-editorial-notes">{es ? "Preferencias de redacción (opcional)" : "Writing preferences (optional)"}</label>
      {state.draftFormat?.contract === "artizen-update-v1" && <p className="text-sm">{es
        ? "Formato de esta plantilla: dos párrafos, 90–120 palabras en total; avances primero, límites y trabajo pendiente después. Las preferencias no cambian este formato."
        : "Template format: two paragraphs, 90–120 words total; progress first, limitations and ongoing work second. Preferences do not change this format."}</p>}
      <p id="artizen-editorial-help" className="text-xs text-muted-foreground">{es
        ? (state.draftFormat ? "Tono y estilo dentro del formato de la plantilla. Estas preferencias no son hechos." : "Tono, extensión o formato. Estas preferencias no son hechos ni deben aparecer como instrucciones en el borrador.")
        : (state.draftFormat ? "Tone and style within the template format. These preferences are not facts." : "Tone, length or format. These preferences are not facts and should not appear as instructions in the draft.")}</p>
      <textarea id="artizen-editorial-notes" aria-describedby="artizen-editorial-help" className={`${field} min-h-20`} maxLength={1000}
        value={editorialNotes} onChange={e => setEditorialNotes(e.target.value)}
        placeholder={es ? "Ejemplo: tono cercano, lenguaje sencillo, sin exageraciones." : "Example: a warm tone, plain language, no hype."} />
      <Button disabled={pending || !!state.activeRunId || !state.configured || !state.agentName || !notes.trim()} onClick={() => setConfirmation({ action: "prepare-update" })}>
        {es ? "Preparar borrador" : "Prepare draft"}
      </Button>
      {state.scheduling?.enabled && <div className="space-y-2 rounded-lg border border-border p-3">
        <label htmlFor="artizen-schedule" className="block text-sm font-medium">{es ? "Programar una vez (opcional)" : "Schedule once (optional)"}</label>
        <p id="artizen-schedule-help" className="text-xs text-muted-foreground">{es ? "Dentro de las próximas 24 horas, con al menos un minuto de anticipación. Hora local de tu navegador; las notas actuales se guardan al confirmar. No hay recurrencia." : "Within the next 24 hours, at least one minute ahead. Your browser’s local time; current notes are saved when confirmed. No recurrence."}</p>
        <input id="artizen-schedule" type="datetime-local" aria-describedby="artizen-schedule-help" className={field} value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} disabled={pending || !!state.activeRunId} />
        <Button variant="outline" disabled={pending || !!state.activeRunId || !state.configured || !state.agentName || !notes.trim() || !scheduleDate} onClick={confirmSchedule}>{es ? "Programar borrador" : "Schedule draft"}</Button>
      </div>}
      {state.webhook && <div className="space-y-2 rounded-lg border border-border p-3" aria-label={es ? "Webhook de una ejecución" : "One-time webhook"}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-medium">{es ? "Webhook de una ejecución" : "One-time webhook"}</h4>
          <span className="text-xs text-muted-foreground">{state.webhook.status === "armed"
            ? (es ? "Preparado · esperando un evento" : "Armed · waiting for one event")
            : state.webhook.status === "consumed" ? (es ? "Consumido" : "Consumed") : (es ? "Deshabilitado" : "Disabled")}</span>
        </div>
        <p className="text-xs text-muted-foreground">{es
          ? "Una fuente que conozca la URL y el secreto puede enviar un evento firmado. El primer evento válido crea como máximo un trabajo; duplicados exactos conservan el mismo resultado y otro ID se rechaza. Nada se publica automáticamente."
          : "A source with the URL and secret can send one signed event. The first valid event creates at most one run; exact duplicates keep the same result and another ID is rejected. Nothing is published automatically."}</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={pending || !!state.activeRunId || !state.configured || !state.agentName}
            onClick={() => setWebhookAction("rotate")}>{state.webhook.status === "disabled" ? (es ? "Crear webhook" : "Create webhook") : (es ? "Crear uno nuevo" : "Create a new one")}</Button>
          {state.webhook.enabled && <Button variant="outline" disabled={pending} onClick={() => setWebhookAction("disable")}>{es ? "Deshabilitar" : "Disable"}</Button>}
        </div>
      </div>}
      {current?.result && <DraftReview key={current.requestId} run={current} memory={state.memory} es={es} pending={pending}
        canRevise={!state.activeRunId && state.configured && !!state.agentName && !!notes.trim()}
        revise={draft => setConfirmation({ action: "revise-update", sourceDraft: draft })} save={saveMemory} />}
      <MemoryEditor key={state.memory.revision} memory={state.memory} es={es} pending={pending} save={saveMemory} />
      {state.runs.length > 1 && <details className="rounded-lg border border-border p-3"><summary>{es ? "Borradores anteriores" : "Previous drafts"}</summary>
        <div className="mt-3 space-y-4">{state.runs.slice(1).filter(r => r.result).map(run => <article key={run.requestId} className="whitespace-pre-wrap break-words text-sm">
          <time className="mb-2 block text-xs text-muted-foreground">{new Date(run.createdAtMs).toLocaleString(i18n.language)}</time>{run.result?.draft}
          <ArtizenFormatReview review={run.result?.formatReview} es={es} />
        </article>)}</div>
      </details>}
    </>}
    <ConfirmDialog open={setupOpen} onOpenChange={setSetupOpen} pending={pending}
      title={es ? "¿Asociar Hermes al proyecto?" : "Link Hermes to this project?"}
      description={es ? "Se registrará un agente y se vincularán los trabajos anteriores. No se iniciará cómputo ni se reservará presupuesto." : "Registers one agent and links previous runs. No compute starts and no budget is reserved."}
      confirmLabel={es ? "Asociar sin iniciar" : "Link without starting"} cancelLabel={es ? "Cancelar" : "Cancel"} onConfirm={() => { void setupAgent(); }} />
    <ConfirmDialog open={!!confirmation} onOpenChange={open => { if (!open && !pending) setConfirmation(null); }} pending={pending}
      title={confirmation?.scheduledForMs !== undefined ? (es ? "¿Programar un único trabajo?" : "Schedule one run?") : (es ? "¿Iniciar un trabajo de Hermes?" : "Start a Hermes run?")}
      description={(confirmation?.scheduledForMs !== undefined ? `${new Date(confirmation.scheduledForMs).toLocaleString(i18n.language, { dateStyle: "full", timeStyle: "long" })}. ` : "") + (es ? `Se reservará ahora hasta ${money(state?.runReservationMicros ?? 0)} del presupuesto y el cupo del proyecto. Hermes preparará un borrador y volverá a reposo. No publicará contenido.`
        : `Up to ${money(state?.runReservationMicros ?? 0)} and the project run slot will be reserved now. Hermes will prepare a draft and return to rest. It will not publish content.`)}
      confirmLabel={confirmation?.scheduledForMs !== undefined ? (es ? "Confirmar programación" : "Confirm schedule") : (es ? "Iniciar trabajo" : "Start run")} cancelLabel={es ? "Cancelar" : "Cancel"} onConfirm={() => { void start(); }} />
    <ConfirmDialog open={!!cancelId} onOpenChange={open => { if (!open && !pending) setCancelId(null); }} pending={pending} title={es ? "¿Cancelar el trabajo programado?" : "Cancel the scheduled run?"}
      description={es ? "Si aún no ha comenzado, se liberará la reserva sin iniciar Hermes. No se eliminarán borradores anteriores." : "If it has not started, the reservation will be released without starting Hermes. Previous drafts will not be deleted."}
      confirmLabel={es ? "Cancelar trabajo" : "Cancel run"} cancelLabel={es ? "Volver" : "Go back"} onConfirm={() => { void cancelScheduled(); }} />
    <ConfirmDialog open={webhookAction === "rotate"} onOpenChange={open => { if (!open && !pending) setWebhookAction(null); }} pending={pending}
      title={es ? "¿Crear un webhook de una ejecución?" : "Create a one-time webhook?"}
      description={es ? `No iniciará Hermes ahora. El primer evento firmado válido podrá reservar hasta ${money(state?.runReservationMicros ?? 0)}, crear un borrador y consumir la credencial. Una URL anterior quedará invalidada.`
        : `Hermes will not start now. The first valid signed event may reserve up to ${money(state?.runReservationMicros ?? 0)}, create one draft and consume the credential. Any previous URL will be invalidated.`}
      confirmLabel={es ? "Crear sin ejecutar" : "Create without running"} cancelLabel={es ? "Cancelar" : "Cancel"} onConfirm={() => { void rotateWebhook(); }} />
    <ConfirmDialog open={webhookAction === "disable"} onOpenChange={open => { if (!open && !pending) setWebhookAction(null); }} pending={pending}
      title={es ? "¿Deshabilitar este webhook?" : "Disable this webhook?"}
      description={es ? "La URL actual dejará de aceptar eventos. Una ejecución ya admitida no se cancela." : "The current URL will stop accepting events. A run already admitted is not cancelled."}
      confirmLabel={es ? "Deshabilitar" : "Disable"} cancelLabel={es ? "Volver" : "Go back"} onConfirm={() => { void disableWebhook(); }} />
    <WebhookCredentialDialog credential={webhookCredential} es={es} close={() => setWebhookCredential(null)} />
  </section>;
}

function WebhookCredentialDialog({ credential, es, close }: { credential: WebhookCredential | null; es: boolean; close: () => void }) {
  const copy = async (value: string) => { await navigator.clipboard.writeText(value); };
  return <Dialog open={!!credential} onOpenChange={open => { if (!open) close(); }}>
    <DialogContent className="max-w-xl">
      <DialogHeader>
        <DialogTitle>{es ? "Guarda la credencial ahora" : "Save the credential now"}</DialogTitle>
        <DialogDescription>{es
          ? "El secreto se muestra una sola vez. PerkOS no lo volverá a exponer después de cerrar este diálogo. Configura la fuente antes de cerrarlo."
          : "The secret is shown once. PerkOS will not expose it again after this dialog closes. Configure the source before closing it."}</DialogDescription>
      </DialogHeader>
      {credential && <div className="min-w-0 space-y-3">
        <div><label className="text-sm font-medium" htmlFor="artizen-webhook-url">URL</label>
          <textarea id="artizen-webhook-url" readOnly className={`${field} mt-1 min-h-20 font-mono text-xs`} value={credential.url} />
          <Button className="mt-2" variant="outline" size="sm" onClick={() => { void copy(credential.url); }}>{es ? "Copiar URL" : "Copy URL"}</Button></div>
        <div><label className="text-sm font-medium" htmlFor="artizen-webhook-secret">{es ? "Secreto HMAC" : "HMAC secret"}</label>
          <textarea id="artizen-webhook-secret" readOnly className={`${field} mt-1 min-h-20 font-mono text-xs`} value={credential.secret} />
          <Button className="mt-2" variant="outline" size="sm" onClick={() => { void copy(credential.secret); }}>{es ? "Copiar secreto" : "Copy secret"}</Button></div>
        <p className="text-xs text-muted-foreground">{es
          ? "Firma: HMAC-SHA256 sobre v1.{timestamp}.{cuerpo JSON exacto}. Envía X-PerkOS-Timestamp y X-PerkOS-Signature: v1=<hex>. El cuerpo incluye eventId y facts; editorialNotes es opcional."
          : "Signature: HMAC-SHA256 over v1.{timestamp}.{exact JSON body}. Send X-PerkOS-Timestamp and X-PerkOS-Signature: v1=<hex>. The body includes eventId and facts; editorialNotes is optional."}</p>
      </div>}
      <DialogFooter><Button onClick={close}>{es ? "Ya la guardé" : "I saved it"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}

function DraftReview({ run, memory, es, pending, canRevise, revise, save }: { run: Run; memory: Memory; es: boolean; pending: boolean; canRevise: boolean;
  revise: (draft: string) => void; save: (text: string, sourceRunId?: string) => Promise<boolean> }) {
  const [draft, setDraft] = useState(run.result!.draft);
  const [confirm, setConfirm] = useState(false);
  const savedFromRun = !!memory.text && memory.sourceRunId === run.requestId;
  return <section className="min-w-0 space-y-3 rounded-lg border border-primary/30 p-4" aria-label={es ? "Revisión del borrador" : "Draft review"}>
    <h4 className="font-semibold">{es ? "Borrador generado · revisión humana" : "Generated draft · human review"}</h4>
    <ArtizenFormatReview review={run.result?.formatReview} es={es} edited={draft !== run.result!.draft} />
    {run.draftEchoesNotes === true && <p role="alert" className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-600 dark:text-amber-300">{es
      ? "El borrador repite tus notas, salvo posibles espacios o saltos de línea. Puede no haber aplicado la redacción o el formato solicitados. Revisa y edita el texto antes de aprobarlo si hace falta. No se volverá a generar automáticamente."
      : "The draft repeats your notes, apart from possible whitespace changes. It may not have applied the requested wording or format. Review and edit before approving if needed. It will not regenerate automatically."}</p>}
    {run.action === "revise-update" && run.revisionUnchanged === true && <p role="alert" className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-600 dark:text-amber-300">{es
      ? "La revisión devolvió el mismo texto, salvo posibles espacios o saltos de línea. Tus notas podrían no haberse aplicado. Compara el borrador con tus indicaciones y edítalo antes de aprobar si hace falta. No se volverá a generar automáticamente."
      : "The revision returned the same text, apart from possible whitespace changes. Your notes may not have been applied. Compare the draft with your feedback and edit before approving if needed. It will not regenerate automatically."}</p>}
    <p className="text-xs text-muted-foreground">{es
      ? "Al recargar se muestra el borrador original. Las ediciones sólo se conservan como ejemplo al aprobar y guardar; el original no se reemplaza."
      : "Reloading shows the original draft. Edits are saved as an example only when you approve and save; the original is not replaced."}</p>
    {savedFromRun && <p className="text-sm text-emerald-500">{es
      ? "Ya guardaste un ejemplo de esta ejecución. Consulta la versión guardada en «Ejemplo de escritura aprobado»."
      : "You saved an example from this run. See the saved version in “Approved writing example”."}</p>}
    <label htmlFor="artizen-draft" className="block font-medium">{es ? "Revisa y edita tu borrador" : "Review and edit your draft"}</label>
    <textarea id="artizen-draft" className={`${field} min-h-48`} value={draft} maxLength={8000} onChange={e => setDraft(e.target.value)} />
    {draft !== run.result!.draft && (!savedFromRun || draft !== memory.text) && <p className="text-xs text-muted-foreground">{es
      ? "Ediciones locales sin guardar como ejemplo. Se perderán al salir o recargar."
      : "Local edits have not been saved as an example. They will be lost when leaving or reloading."}</p>}
    <div className="space-y-2">
      <h5 className="text-sm font-medium">{es ? "Comprobaciones antes de aprobar" : "Checks before approval"}</h5>
      <p className="text-xs text-muted-foreground">{es ? "Guía de revisión, no verificación automática de hechos." : "Review guidance, not automated fact verification."}</p>
      <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        <li>{es ? "Confirma cada afirmación con los hechos que aportaste; elimina lo que no puedas respaldar." : "Check each claim against the facts you supplied; remove anything you cannot support."}</li>
        <li>{es ? "Distingue avances confirmados de planes. No presupongas adopción, métricas ni comentarios de creadores." : "Distinguish confirmed progress from plans. Do not assume adoption, metrics or creator feedback."}</li>
        <li>{es ? "Usa el ejemplo aprobado como estilo, no como evidencia de avances actuales." : "Use the approved example for style, not as evidence of current progress."}</li>
        <li>{es ? "Comprueba que el texto hable a tu comunidad y no copie instrucciones de redacción." : "Check that the text speaks to your community and does not copy writing instructions."}</li>
      </ul>
    </div>
    <div className="flex flex-wrap gap-2">
      <Button disabled={pending || run.phase !== "settled" || !draft.trim()} onClick={() => setConfirm(true)}>{es ? "Aprobar y guardar ejemplo" : "Approve and save example"}</Button>
      <Button variant="outline" disabled={pending || !canRevise || !draft.trim()} onClick={() => revise(draft)}>{es ? "Revisar con mis notas" : "Revise with my notes"}</Button>
    </div>
    <p className="text-xs text-muted-foreground">{es ? "Aprobar no significa publicar ni autorizar entrenamiento." : "Approval does not mean publication or training consent."}</p>
    <ConfirmDialog open={confirm} onOpenChange={setConfirm} pending={pending} title={es ? "¿Guardar este ejemplo aprobado?" : "Save this approved example?"}
      description={es ? "Se usará sólo como referencia de escritura de este proyecto. No se publicará." : "It will be used only as a writing reference for this project. It will not be published."}
      confirmLabel={es ? "Guardar ejemplo" : "Save example"} cancelLabel={es ? "Cancelar" : "Cancel"}
      onConfirm={() => { void save(draft, run.requestId).then(ok => { if (ok) setConfirm(false); }); }} />
  </section>;
}

function MemoryEditor({ memory, es, pending, save }: { memory: Memory; es: boolean; pending: boolean; save: (text: string) => Promise<boolean> }) {
  const [text, setText] = useState(memory.text);
  const [confirm, setConfirm] = useState(false);
  const [expanded, setExpanded] = useState(!!memory.text);
  return <details className="min-w-0 rounded-lg border border-border p-3" open={expanded} onToggle={event => setExpanded(event.currentTarget.open)}><summary>{es ? "Ejemplo de escritura aprobado" : "Approved writing example"}</summary>
    <div className="mt-3 space-y-3">
      <p className="text-sm text-muted-foreground">{memory.text
        ? (es ? `Versión guardada · revisión ${memory.revision}. Referencia de estilo, no hechos actuales ni contenido publicado.` : `Saved version · revision ${memory.revision}. A style reference, not current facts or published content.`)
        : (es ? "Aún no hay un ejemplo guardado para futuros borradores." : "No example has been saved for future drafts yet.")}</p>
      <label htmlFor="artizen-memory" className="block text-sm">{es ? "Contexto editable para futuros borradores" : "Editable context for future drafts"}</label>
      <textarea id="artizen-memory" className={`${field} min-h-28`} value={text} maxLength={8000} onChange={e => setText(e.target.value)} />
      {text !== memory.text && <p className="text-xs text-muted-foreground">{es ? "Cambios sin guardar. La referencia anterior sigue vigente hasta confirmar el guardado." : "Unsaved changes. The previous reference remains in use until you confirm saving."}</p>}
      <p className="text-xs text-muted-foreground">{es ? "Vacía este campo y guarda para dejar de usar el ejemplo. Los borradores anteriores permanecen hasta eliminar el proyecto." : "Clear this field and save to stop using the example. Previous drafts remain until the project is deleted."}</p>
      <Button variant="outline" disabled={pending || text === memory.text} onClick={() => setConfirm(true)}>{es ? "Guardar contexto" : "Save context"}</Button>
    </div>
    <ConfirmDialog open={confirm} onOpenChange={setConfirm} pending={pending} title={es ? "¿Actualizar el contexto aprobado?" : "Update approved context?"}
      description={es ? "Esto sólo cambia el ejemplo usado en futuros borradores; no modifica contenido publicado." : "This only changes the example used in future drafts; it does not change published content."}
      confirmLabel={es ? "Guardar contexto" : "Save context"} cancelLabel={es ? "Cancelar" : "Cancel"}
      onConfirm={() => { void save(text).then(ok => { if (ok) setConfirm(false); }); }} />
  </details>;
}
