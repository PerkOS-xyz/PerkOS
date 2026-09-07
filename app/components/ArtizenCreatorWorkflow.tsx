"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { authedFetch } from "../lib/apiClient";
import { ConfirmDialog } from "./ConfirmDialog";

type DraftResult = { draft: string; reviewNotes: string[]; sourcesUsed: string[] };
type Run = { requestId: string; action: "prepare-update" | "revise-update";
  phase: "queued" | "executing" | "awaiting_stop" | "settled" | "cancelled";
  result: DraftResult | null; allocatedMicros: number | null; reservedMicros: number;
  createdAtMs: number; needsAttention?: boolean };
type Memory = { revision: number; text: string; sourceRunId: string | null; updatedAtMs: number };
type State = { configured: boolean; budget: { limitMicros: number; reservedMicros: number; allocatedMicros: number } | null;
  activeRunId: string | null; runReservationMicros: number; runs: Run[]; memory: Memory };

const active = (run?: Run) => !!run && !run.needsAttention && ["queued", "executing", "awaiting_stop"].includes(run.phase);
const field = "w-full min-w-0 rounded-lg border border-border bg-background p-3 text-sm";
async function readResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error?.code || "ARTIZEN_UNAVAILABLE");
  return data as T;
}

/** Parent keys this workspace by account and project; no cross-wallet UI state. */
export function ArtizenCreatorWorkflow({ projectId }: { projectId: string }) {
  const { i18n } = useTranslation();
  const es = i18n.language.startsWith("es");
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);
  const [confirmation, setConfirmation] = useState<{ action: Run["action"]; sourceDraft?: string } | null>(null);
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
  useEffect(() => {
    if (!activeId || !needsPoll) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let inFlight = false;
    const poll = async () => {
      if (controller.signal.aborted || document.visibilityState === "hidden" || inFlight) return;
      inFlight = true;
      try {
        const run = await readResponse<Run>(await authedFetch(`${base}/runs/${activeId}`, { signal: controller.signal }));
        if (controller.signal.aborted) return;
        setState(old => old ? { ...old, runs: old.runs.map(r => r.requestId === run.requestId ? run : r) } : old);
        if (active(run)) timer = setTimeout(() => { void poll(); }, 5000);
        else if (!run.needsAttention) await load(controller.signal);
      } catch { if (!controller.signal.aborted) setError("ARTIZEN_UNAVAILABLE"); }
      finally { inFlight = false; }
    };
    const visibility = () => {
      if (timer) clearTimeout(timer);
      if (document.visibilityState !== "hidden") void poll();
    };
    timer = setTimeout(() => { void poll(); }, 5000);
    document.addEventListener("visibilitychange", visibility);
    return () => { controller.abort(); if (timer) clearTimeout(timer); document.removeEventListener("visibilitychange", visibility); };
  }, [activeId, needsPoll, base, load]);

  function errorText(code: string) {
    const messages: Record<string, [string, string]> = {
      PILOT_DISABLED: ["La ejecución del piloto aún no está habilitada.", "Pilot execution is not enabled yet."],
      PILOT_NOT_CONFIGURED: ["Este proyecto aún no tiene un presupuesto habilitado.", "This project does not have an enabled budget yet."],
      BUSY: ["Ya hay un trabajo activo. Actualiza su estado antes de reintentar.", "A run is already active. Refresh its status before retrying."],
      BUDGET_EXHAUSTED: ["El presupuesto disponible no alcanza para otra ejecución.", "The available budget cannot cover another run."],
      CONTEXT_TOO_LARGE: ["El contexto excede el límite. Reduce las notas o el ejemplo aprobado.", "Context exceeds the limit. Shorten the notes or approved example."],
      MEMORY_CONFLICT: ["El ejemplo cambió en otra sesión. Actualiza antes de guardar.", "The example changed in another session. Refresh before saving."],
      IDEMPOTENCY_CONFLICT: ["El intento anterior tiene otros datos. Actualiza para revisar su resultado.", "The previous attempt has different data. Refresh to review its result."],
    };
    return messages[code]?.[es ? 0 : 1] ?? (es ? "No se pudo completar la solicitud. Actualiza el estado antes de reintentar." : "The request could not complete. Refresh status before retrying.");
  }
  async function start() {
    if (!confirmation || pending || !notes.trim()) return;
    const payload = { ...confirmation, notes: notes.trim(), confirmed: true };
    const fingerprint = JSON.stringify(payload);
    if (!retry.current) retry.current = { fingerprint, requestId: crypto.randomUUID() };
    if (retry.current.fingerprint !== fingerprint) { setError("IDEMPOTENCY_CONFLICT"); setConfirmation(null); return; }
    setPending(true); setError(""); setNotice("");
    try {
      await readResponse(await authedFetch(`${base}/runs`, { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...payload, requestId: retry.current.requestId }) }));
      retry.current = null; setConfirmation(null); await load();
    } catch (e) {
      const code = e instanceof Error ? e.message : "ARTIZEN_UNAVAILABLE";
      if (["INVALID_INPUT", "PILOT_DISABLED", "PILOT_NOT_CONFIGURED", "BUDGET_EXHAUSTED", "BUSY", "COST_PLAN_EXPIRED"].includes(code)) retry.current = null;
      setError(code); setConfirmation(null);
    }
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
  const status = current?.needsAttention ? (es ? "Requiere revisión operativa" : "Needs operational review") : current ? ({
    queued: es ? "Preparando Hermes" : "Preparing Hermes",
    executing: es ? "Hermes está trabajando" : "Hermes is working",
    awaiting_stop: es ? "Confirmando reposo y costo" : "Confirming stop and cost",
    settled: es ? "Hermes en reposo" : "Hermes is resting",
    cancelled: es ? "Cancelado sin iniciar" : "Cancelled before start",
  })[current.phase] : es ? "Sin ejecuciones" : "No runs yet";
  return <section className="mt-5 min-w-0 space-y-4 break-words border-t border-border pt-5" aria-label={es ? "Borradores Artizen" : "Artizen drafts"}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="font-semibold">{es ? "Tu actualización para la comunidad" : "Your supporter update"}</h3>
      <Button variant="outline" size="sm" onClick={() => { void load(); }} disabled={pending}>{es ? "Actualizar estado" : "Refresh status"}</Button>
    </div>
    <p className="text-sm text-muted-foreground">{es ? "Un Hermes trabaja sólo cuando lo solicitas. Los resultados son borradores: no se publica nada ni se activan horarios." : "One Hermes works only when requested. Results are drafts: nothing is published and no schedules are enabled."}</p>
    {error && <p role="alert" className="text-sm text-destructive">{errorText(error)}</p>}
    {notice && <p role="status" className="text-sm text-emerald-500">{notice}</p>}
    {!state && !error && <p role="status">{es ? "Cargando…" : "Loading…"}</p>}
    {state && <>
      <div className="min-w-0 space-y-2 rounded-lg border border-border bg-muted/20 p-3">
        <h4 className="text-sm font-medium">{es ? "Hermes bajo demanda" : "On-demand Hermes"}</h4>
        <p role="status" aria-live="polite" className="text-sm">{status}</p>
        <p className="text-xs text-muted-foreground">{es
          ? "Cada ejecución usa un trabajador temporal. No se cuenta como agente permanente ni como tarea del tablero del proyecto."
          : "Each run uses a temporary worker. It is not counted as a permanent agent or a task on the project board."}</p>
      </div>
      {current?.phase === "settled" && !current.result && <p role="alert" className="text-sm text-destructive">{es ? "El trabajo terminó sin un borrador válido. No se volverá a generar automáticamente." : "The run ended without a valid draft. It will not regenerate automatically."}</p>}
      {state.budget && <p className="text-xs text-muted-foreground">
        {es ? "Asignado" : "Allocated"}: {money(state.budget.allocatedMicros)} · {es ? "Reservado" : "Reserved"}: {money(state.budget.reservedMicros)} · {es ? "Límite" : "Limit"}: {money(state.budget.limitMicros)}.
        {" "}{es ? "Asignación de infraestructura, no factura cloud definitiva." : "Infrastructure allocation, not a final cloud invoice."}
      </p>}
      {!state.configured && <p className="text-sm text-muted-foreground">{errorText("PILOT_NOT_CONFIGURED")}</p>}
      <label className="block text-sm font-medium" htmlFor="artizen-current-notes">{es ? "¿Qué avances puedes confirmar?" : "What progress can you confirm?"}</label>
      <textarea id="artizen-current-notes" className={`${field} min-h-28`} maxLength={4000} value={notes} onChange={e => setNotes(e.target.value)}
        placeholder={es ? "Comparte hechos de este proyecto, no instrucciones técnicas." : "Share facts about this project, not technical instructions."} />
      <Button disabled={pending || !!state.activeRunId || !state.configured || !notes.trim()} onClick={() => setConfirmation({ action: "prepare-update" })}>
        {es ? "Preparar borrador" : "Prepare draft"}
      </Button>
      {current?.result && <DraftReview key={current.requestId} run={current} memory={state.memory} es={es} pending={pending}
        canRevise={!state.activeRunId && state.configured && !!notes.trim()}
        revise={draft => setConfirmation({ action: "revise-update", sourceDraft: draft })} save={saveMemory} />}
      <MemoryEditor key={state.memory.revision} memory={state.memory} es={es} pending={pending} save={saveMemory} />
      {state.runs.length > 1 && <details className="rounded-lg border border-border p-3"><summary>{es ? "Borradores anteriores" : "Previous drafts"}</summary>
        <div className="mt-3 space-y-4">{state.runs.slice(1).filter(r => r.result).map(run => <article key={run.requestId} className="whitespace-pre-wrap break-words text-sm">
          <time className="mb-2 block text-xs text-muted-foreground">{new Date(run.createdAtMs).toLocaleString(i18n.language)}</time>{run.result?.draft}
        </article>)}</div>
      </details>}
    </>}
    <ConfirmDialog open={!!confirmation} onOpenChange={open => { if (!open && !pending) setConfirmation(null); }} pending={pending}
      title={es ? "¿Iniciar un trabajo de Hermes?" : "Start a Hermes run?"}
      description={es ? `Se reservará hasta ${money(state?.runReservationMicros ?? 0)} del presupuesto. Hermes preparará un borrador y volverá a reposo. No publicará contenido.`
        : `Up to ${money(state?.runReservationMicros ?? 0)} will be reserved. Hermes will prepare a draft and return to rest. It will not publish content.`}
      confirmLabel={es ? "Iniciar trabajo" : "Start run"} cancelLabel={es ? "Cancelar" : "Cancel"} onConfirm={() => { void start(); }} />
  </section>;
}

function DraftReview({ run, memory, es, pending, canRevise, revise, save }: { run: Run; memory: Memory; es: boolean; pending: boolean; canRevise: boolean;
  revise: (draft: string) => void; save: (text: string, sourceRunId?: string) => Promise<boolean> }) {
  const [draft, setDraft] = useState(run.result!.draft);
  const [confirm, setConfirm] = useState(false);
  const savedFromRun = !!memory.text && memory.sourceRunId === run.requestId;
  return <section className="min-w-0 space-y-3 rounded-lg border border-primary/30 p-4" aria-label={es ? "Revisión del borrador" : "Draft review"}>
    <h4 className="font-semibold">{es ? "Borrador generado · revisión humana" : "Generated draft · human review"}</h4>
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
