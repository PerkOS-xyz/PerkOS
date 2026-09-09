import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ArtizenCreatorWorkflow } from "../app/components/ArtizenCreatorWorkflow";

const mock = vi.hoisted(() => ({ fetch: vi.fn(), language: "es" }));
vi.mock("../app/lib/apiClient", () => ({ authedFetch: mock.fetch }));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: vi.fn() }) }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: mock.language } }) }));
const initial = () => ({ configured: true, agentName: "Artizen-fixture", budget: { limitMicros: 1000000, reservedMicros: 0, allocatedMicros: 0 },
  activeRunId: null, runReservationMicros: 50000, runs: [], memory: { revision: 0, text: "", sourceRunId: null, updatedAtMs: 0 } });
const completed = () => ({ requestId: "00000000-0000-4000-8000-000000000001", action: "prepare-update", phase: "settled",
  result: { draft: "Lanzamos una demo.", reviewNotes: ["Verifica los detalles antes de compartir."], sourcesUsed: ["current notes"] },
  allocatedMicros: 1000, reservedMicros: 50000, createdAtMs: Date.UTC(2026, 8, 7) });
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
beforeEach(() => { mock.language = "es"; mock.fetch.mockReset().mockImplementation(async () => json(initial())); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

it.each(["en", "es"])("shows recovered startup failure after reload without generating in %s", async language => {
  mock.language = language;
  mock.fetch.mockImplementation(async () => json({ ...initial(), runs: [{ ...completed(), result: null, stopReason: "failed", failureCode: "runtime-start-failed" }] }));
  render(<ArtizenCreatorWorkflow projectId="template-example" />);
  expect(await screen.findByRole("alert")).toHaveTextContent(language === "es" ? "No se llamó al modelo" : "The model was not called");
  expect(screen.getByRole("alert")).toHaveTextContent(language === "es" ? "se ha conciliado" : "has been reconciled");
  expect(mock.fetch).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("button", { name: /Approve and save|Aprobar y guardar/ })).not.toBeInTheDocument();
});

it.each(["en", "es"])("shows structured format, failed historical assessment and local editing without POST in %s", async language => {
  mock.language = language;
  const run = { ...completed(), result: { ...completed().result, formatReview: {
    contract: "artizen-update-v1", status: "needs-review", wordCount: 4, paragraphCount: 1, issues: ["word_count", "paragraph_count"] } } };
  mock.fetch.mockResolvedValue(json({ ...initial(), draftFormat: { contract: "artizen-update-v1", paragraphs: 2, minWords: 90, maxWords: 120 }, runs: [run] }));
  render(<ArtizenCreatorWorkflow projectId="template-example" />);
  const textarea = await screen.findByRole("textbox", { name: language === "es" ? "Revisa y edita tu borrador" : "Review and edit your draft" });
  expect(screen.getByText(language === "es" ? /Formato de esta plantilla:/ : /Template format:/)).toHaveTextContent("90–120");
  fireEvent.change(textarea, { target: { value: "Edited first paragraph.\n\nEdited second paragraph." } });
  expect(screen.getByText(language === "es" ? /Estos resultados corresponden/ : /These results describe/)).toBeVisible();
  expect(mock.fetch).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("button", { name: language === "es" ? "Aprobar y guardar ejemplo" : "Approve and save example" })).toBeEnabled();
});

it.each([["en", "prepare-update"], ["es", "prepare-update"], ["en", "revise-update"], ["es", "revise-update"]])("warns of copied notes in %s/%s without changing the draft or generating again", async (language, action) => {
  mock.language = language;
  mock.fetch.mockImplementation(async () => json({ ...initial(), runs: [{ ...completed(), action, draftEchoesNotes: true }] }));
  render(<ArtizenCreatorWorkflow projectId="template-example" />);
  expect(await screen.findByRole("alert")).toHaveTextContent(language === "es" ? "El borrador repite tus notas" : "The draft repeats your notes");
  expect(screen.getByRole("alert")).toHaveTextContent(language === "es" ? "No se volverá a generar automáticamente" : "It will not regenerate automatically");
  expect(screen.getByLabelText(language === "es" ? "Revisa y edita tu borrador" : "Review and edit your draft")).toHaveValue(completed().result.draft);
  expect(mock.fetch.mock.calls.filter(c=>c[1]?.method)).toHaveLength(0);
});
it.each([false, undefined])("does not invent a note-echo warning for absent/false API flags: %s", async draftEchoesNotes => {
  mock.fetch.mockImplementation(async () => json({ ...initial(), runs: [{ ...completed(), draftEchoesNotes }] }));
  render(<ArtizenCreatorWorkflow projectId="template-example" />);
  await screen.findByLabelText("Revisa y edita tu borrador");
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
async function fill() {
  const notes = await screen.findByLabelText("¿Qué avances puedes confirmar?");
  fireEvent.change(notes, { target: { value: "Lanzamos una demo." } });
  fireEvent.click(screen.getByRole("button", { name: "Preparar borrador" }));
  await screen.findByRole("dialog");
}
it.each(["es", "en"])("links a legacy project explicitly without starting inference in %s", async language => {
  mock.language = language; let linked = false;
  mock.fetch.mockImplementation(async (_path, init) => {
    if (init?.method === "POST") { linked = true; return json({ agentName: "Artizen-fixture" }); }
    return json({ ...initial(), agentName: linked ? "Artizen-fixture" : null });
  });
  render(<ArtizenCreatorWorkflow projectId="template-example" />);
  const setup = await screen.findByRole("button", { name: language === "es" ? "Asociar Hermes al proyecto" : "Link Hermes to project" });
  expect(mock.fetch).toHaveBeenCalledTimes(1);
  fireEvent.click(setup);
  expect(screen.getByRole("dialog")).toHaveTextContent(language === "es" ? "No se iniciará cómputo" : "No compute starts");
  fireEvent.click(screen.getByRole("button", { name: language === "es" ? "Asociar sin iniciar" : "Link without starting" }));
  await screen.findByRole("link", { name: language === "es" ? "Ver agente Hermes" : "View Hermes agent" });
  const writes = mock.fetch.mock.calls.filter(c => c[1]?.method === "POST");
  expect(writes).toHaveLength(1); expect(writes[0][0]).toBe("/artizen-projects/template-example/agent");
  expect(JSON.parse(writes[0][1].body)).toEqual({ confirmed: true });
});
it("blank notes never wake Hermes; confirmation is a web dialog", async () => {
  render(<ArtizenCreatorWorkflow projectId="template-example" />);
  expect(await screen.findByRole("button", { name: "Preparar borrador" })).toBeDisabled();
  await fill();
  expect(screen.getByRole("dialog")).toHaveTextContent("No publicará contenido");
  expect(mock.fetch.mock.calls.filter(c => c[1]?.method === "POST")).toHaveLength(0);
  fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(mock.fetch).toHaveBeenCalledTimes(1);
});
it("requires explicit start and sends no budget, model or owner chosen in the browser", async () => {
  render(<ArtizenCreatorWorkflow projectId="template-example" />); await fill();
  fireEvent.click(screen.getByRole("button", { name: "Iniciar trabajo" }));
  await waitFor(() => expect(mock.fetch.mock.calls.some(c => c[1]?.method === "POST")).toBe(true));
  const call = mock.fetch.mock.calls.find(c => c[1]?.method === "POST")!;
  expect(call[0]).toBe("/artizen-projects/template-example/runs");
  expect(JSON.parse(call[1].body)).toEqual({ requestId: expect.any(String), action: "prepare-update", notes: "Lanzamos una demo.", confirmed: true });
});
it("an uncertain response reuses the same idempotency key", async () => {
  mock.fetch.mockImplementation(async (_path, init) => { if (init?.method === "POST") throw Error("network"); return json(initial()); });
  render(<ArtizenCreatorWorkflow projectId="template-example" />); await fill();
  fireEvent.click(screen.getByRole("button", { name: "Iniciar trabajo" }));
  await screen.findByRole("alert");
  fireEvent.click(screen.getByRole("button", { name: "Preparar borrador" }));
  fireEvent.click(await screen.findByRole("button", { name: "Iniciar trabajo" }));
  await waitFor(() => expect(mock.fetch.mock.calls.filter(c => c[1]?.method === "POST")).toHaveLength(2));
  const calls = mock.fetch.mock.calls.filter(c => c[1]?.method === "POST");
  expect(JSON.parse(calls[0][1].body).requestId).toBe(JSON.parse(calls[1][1].body).requestId);
});

it.each(["es", "en"])("separates accessible facts and optional editorial fields in %s", async language => {
  mock.language = language;
  render(<ArtizenCreatorWorkflow projectId="template-example" />);
  const facts = await screen.findByLabelText(language === "es" ? "¿Qué avances puedes confirmar?" : "What progress can you confirm?");
  const editorial = screen.getByLabelText(language === "es" ? "Preferencias de redacción (opcional)" : "Writing preferences (optional)");
  expect(facts).toHaveAttribute("maxlength", "4000");
  expect(editorial).toHaveAttribute("maxlength", "1000");
  expect(facts).toHaveAccessibleDescription(language === "es"
    ? "Sólo hechos verificados, límites y trabajo pendiente. Usa el campo de abajo para indicar cómo redactarlos."
    : "Only verified facts, limitations and ongoing work. Use the field below to say how to write them.");
  expect(editorial).toHaveAccessibleDescription(language === "es"
    ? "Tono, extensión o formato. Estas preferencias no son hechos ni deben aparecer como instrucciones en el borrador."
    : "Tone, length or format. These preferences are not facts and should not appear as instructions in the draft.");
  fireEvent.change(editorial, { target: { value: "Under 100 words." } });
  expect(screen.getByRole("button", { name: language === "es" ? "Preparar borrador" : "Prepare draft" })).toBeDisabled();
  expect(mock.fetch).toHaveBeenCalledTimes(1);
});

it.each(["prepare-update", "revise-update"])("sends editorial preferences separately for %s", async action => {
  mock.fetch.mockImplementation(async () => json({ ...initial(), runs: action === "revise-update" ? [completed()] : [] }));
  render(<ArtizenCreatorWorkflow projectId="template-example" />);
  fireEvent.change(await screen.findByLabelText("¿Qué avances puedes confirmar?"), { target: { value: "La prueba sigue en curso." } });
  fireEvent.change(screen.getByLabelText("Preferencias de redacción (opcional)"), { target: { value: "  Menos de 100 palabras. No afirmes que terminó.  " } });
  fireEvent.click(screen.getByRole("button", { name: action === "revise-update" ? "Revisar con mis notas" : "Preparar borrador" }));
  fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Iniciar trabajo" }));
  await waitFor(() => expect(mock.fetch.mock.calls.some(c => c[1]?.method === "POST")).toBe(true));
  const call = mock.fetch.mock.calls.find(c => c[1]?.method === "POST")!;
  expect(JSON.parse(call[1].body)).toMatchObject({ action, notes: "La prueba sigue en curso.", editorialNotes: "Menos de 100 palabras. No afirmes que terminó." });
  if (action === "revise-update") expect(JSON.parse(call[1].body).sourceDraft).toBe(completed().result.draft);
});

it("blocks changed editorial preferences after an uncertain admission instead of starting a second run", async () => {
  mock.fetch.mockImplementation(async (_path, init) => { if (init?.method === "POST") throw Error("network"); return json(initial()); });
  render(<ArtizenCreatorWorkflow projectId="template-example" />);
  fireEvent.change(await screen.findByLabelText("¿Qué avances puedes confirmar?"), { target: { value: "La demo está lista." } });
  fireEvent.change(screen.getByLabelText("Preferencias de redacción (opcional)"), { target: { value: "Tono cálido." } });
  fireEvent.click(screen.getByRole("button", { name: "Preparar borrador" }));
  fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Iniciar trabajo" }));
  await screen.findByRole("alert");
  fireEvent.change(screen.getByLabelText("Preferencias de redacción (opcional)"), { target: { value: "Usa viñetas." } });
  fireEvent.click(screen.getByRole("button", { name: "Preparar borrador" }));
  fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Iniciar trabajo" }));
  await screen.findByText("El intento anterior tiene otros datos. Actualiza para revisar su resultado.");
  expect(mock.fetch.mock.calls.filter(c => c[1]?.method === "POST")).toHaveLength(1);
});
it("reload shows persisted draft; approval saves edited text and never starts a model", async () => {
  mock.fetch.mockImplementation(async () => json({ ...initial(), runs: [completed()] }));
  render(<ArtizenCreatorWorkflow projectId="template-example" />);
  fireEvent.change(await screen.findByLabelText("Revisa y edita tu borrador"), { target: { value: "Nuestra demo ya está lista." } });
  fireEvent.click(screen.getByRole("button", { name: "Aprobar y guardar ejemplo" }));
  expect(await screen.findByRole("dialog")).toHaveTextContent("No se publicará");
  fireEvent.click(screen.getByRole("button", { name: "Guardar ejemplo" }));
  await waitFor(() => expect(mock.fetch.mock.calls.some(c => c[1]?.method === "PUT")).toBe(true));
  const call = mock.fetch.mock.calls.find(c => c[1]?.method === "PUT")!;
  expect(call[0]).toMatch(/\/memory$/);
  expect(JSON.parse(call[1].body)).toMatchObject({ expectedRevision: 0, text: "Nuestra demo ya está lista.", sourceRunId: completed().requestId, approved: true });
  expect(mock.fetch.mock.calls.some(c => c[1]?.method === "POST")).toBe(false);
});
it("requires settled lifecycle before approval and blocks a second active run", async () => {
  mock.fetch.mockImplementation(async () => json({ ...initial(), activeRunId: completed().requestId, runs: [{ ...completed(), phase: "awaiting_stop" }] }));
  render(<ArtizenCreatorWorkflow projectId="template-example" />);
  expect(await screen.findByRole("button", { name: "Aprobar y guardar ejemplo" })).toBeDisabled();
  expect(screen.getByText("Confirmando reposo y costo")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Preparar borrador" })).toBeDisabled();
});
it("idle UI does not poll the database", async () => {
  render(<ArtizenCreatorWorkflow projectId="template-example" />);
  await screen.findByLabelText("¿Qué avances puedes confirmar?");
  vi.useFakeTimers(); await act(async () => { await vi.advanceTimersByTimeAsync(60000); });
  expect(mock.fetch).toHaveBeenCalledTimes(1);
});
it("keeps UI copy in English when English is selected", async () => {
  mock.language = "en";
  render(<ArtizenCreatorWorkflow projectId="template-example" />);
  expect(await screen.findByLabelText("What progress can you confirm?")).toBeInTheDocument();
  expect(screen.getByText("Hermes is resting")).toBeInTheDocument();
  expect(screen.queryByText("Hermes en reposo")).not.toBeInTheDocument();
});
it("missing budget does not offer an enabled wake action", async () => {
  mock.fetch.mockImplementation(async () => json({ ...initial(), configured: false, budget: null }));
  render(<ArtizenCreatorWorkflow projectId="template-example" />);
  expect(await screen.findByText("Este proyecto aún no tiene un presupuesto habilitado.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Preparar borrador" })).toBeDisabled();
});

it.each(["es", "en"])("separates temporary work and neutral review guidance in %s", async language => {
  mock.language = language;
  const run = completed();
  run.result.reviewNotes = ["Add testimonials from your many happy creators."];
  mock.fetch.mockImplementation(async () => json({ ...initial(), runs: [run] }));
  render(<ArtizenCreatorWorkflow projectId="template-example" />);
  expect(await screen.findByText(language === "es" ? "Hermes bajo demanda" : "On-demand Hermes")).toBeInTheDocument();
  expect(screen.getByText(language === "es" ? /Cada trabajo crea una tarea/ : /Each run creates a task/)).toBeInTheDocument();
  expect(screen.getByText(language === "es" ? "Comprobaciones antes de aprobar" : "Checks before approval")).toBeInTheDocument();
  expect(screen.queryByText(run.result.reviewNotes[0])).not.toBeInTheDocument();
  expect(screen.getByText(language === "es" ? /no verificación automática/ : /not automated fact verification/)).toBeInTheDocument();
  expect(screen.getByText(language === "es" ? /no copie instrucciones de redacción/ : /does not copy writing instructions/)).toBeInTheDocument();
  expect(mock.fetch).toHaveBeenCalledTimes(1);
});

it("reload distinguishes original draft from the approved edited example and opens saved memory", async () => {
  const memory = { revision: 1, text: "Ejemplo revisado por la persona.", sourceRunId: completed().requestId, updatedAtMs: Date.now() };
  mock.fetch.mockImplementation(async () => json({ ...initial(), runs: [completed()], memory }));
  const view = render(<ArtizenCreatorWorkflow projectId="template-example" />);
  await screen.findByText(/Ya guardaste un ejemplo de esta ejecución/);
  expect(screen.getByLabelText("Revisa y edita tu borrador")).toHaveValue(completed().result.draft);
  const example = screen.getByLabelText("Contexto editable para futuros borradores");
  expect(example).toHaveValue(memory.text);
  expect(example.closest("details")).toHaveAttribute("open");
  expect(screen.getByText(/Versión guardada · revisión 1/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Revisa y edita tu borrador"), { target: { value: "Cambio local" } });
  expect(screen.getByText(/Ediciones locales sin guardar/)).toBeInTheDocument();
  view.unmount();
  render(<ArtizenCreatorWorkflow projectId="template-example" />);
  expect(await screen.findByLabelText("Revisa y edita tu borrador")).toHaveValue(completed().result.draft);
  expect(screen.getByLabelText("Contexto editable para futuros borradores")).toHaveValue(memory.text);
  expect(mock.fetch.mock.calls.some(c => c[1]?.method)).toBe(false);
});

it("does not label an unrelated run as the source of approved memory", async () => {
  mock.fetch.mockImplementation(async () => json({ ...initial(), runs: [completed()], memory: {
    revision: 2, text: completed().result.draft, sourceRunId: "00000000-0000-4000-8000-000000000002", updatedAtMs: 1,
  } }));
  render(<ArtizenCreatorWorkflow projectId="template-example" />);
  await screen.findByText(/Versión guardada · revisión 2/);
  expect(screen.queryByText(/Ya guardaste un ejemplo de esta ejecución/)).not.toBeInTheDocument();
});

it("approval reveals the persisted edited example without replacing the original or calling the model", async () => {
  const persisted = { ...initial(), runs: [completed()] };
  mock.fetch.mockImplementation(async (_path, init) => {
    if (init?.method === "PUT") {
      const input = JSON.parse(init.body);
      persisted.memory = { revision: 1, text: input.text, sourceRunId: input.sourceRunId, updatedAtMs: 1 };
      return json(persisted.memory);
    }
    return json(persisted);
  });
  render(<ArtizenCreatorWorkflow projectId="template-example" />);
  fireEvent.change(await screen.findByLabelText("Revisa y edita tu borrador"), { target: { value: "Hechos revisados." } });
  fireEvent.click(screen.getByRole("button", { name: "Aprobar y guardar ejemplo" }));
  fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Guardar ejemplo" }));
  await screen.findByText(/Ya guardaste un ejemplo de esta ejecución/);
  expect(screen.getByLabelText("Contexto editable para futuros borradores")).toHaveValue("Hechos revisados.");
  expect(screen.queryByText(/Ediciones locales sin guardar/)).not.toBeInTheDocument();
  expect(persisted.runs[0].result.draft).toBe(completed().result.draft);
  expect(mock.fetch.mock.calls.filter(c => c[1]?.method === "PUT")).toHaveLength(1);
  expect(mock.fetch.mock.calls.some(c => c[1]?.method === "POST")).toBe(false);
});

it("memory edits stay local until the web confirmation is accepted", async () => {
  mock.fetch.mockImplementation(async () => json({ ...initial(), memory: { revision: 1, text: "Ejemplo guardado", sourceRunId: null, updatedAtMs: 1 } }));
  render(<ArtizenCreatorWorkflow projectId="template-example" />);
  fireEvent.change(await screen.findByLabelText("Contexto editable para futuros borradores"), { target: { value: "Nuevo estilo" } });
  expect(screen.getByText(/La referencia anterior sigue vigente/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Guardar contexto" }));
  fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Cancelar" }));
  expect(mock.fetch.mock.calls.some(c => c[1]?.method)).toBe(false);
});

it.each(["es", "en"])("shows a durable unchanged-revision warning in %s without retrying", async language => {
  mock.language = language;
  const run = { ...completed(), action: "revise-update", revisionUnchanged: true };
  mock.fetch.mockImplementation(async () => json({ ...initial(), runs: [run] }));
  const view = render(<ArtizenCreatorWorkflow projectId="template-example" />);
  const warning = await screen.findByRole("alert");
  expect(warning).toHaveTextContent(language === "es" ? "La revisión devolvió el mismo texto" : "The revision returned the same text");
  expect(warning).toHaveTextContent(language === "es" ? "No se volverá a generar automáticamente" : "It will not regenerate automatically");
  view.unmount();
  render(<ArtizenCreatorWorkflow projectId="template-example" />);
  expect(await screen.findByRole("alert")).toHaveTextContent(language === "es" ? "Tus notas podrían no haberse aplicado" : "Your notes may not have been applied");
  vi.useFakeTimers(); await act(async () => { await vi.advanceTimersByTimeAsync(60000); });
  expect(mock.fetch).toHaveBeenCalledTimes(2);
  expect(mock.fetch.mock.calls.some(c => c[1]?.method)).toBe(false);
});

it.each([
  { action: "revise-update", revisionUnchanged: false },
  { action: "revise-update", revisionUnchanged: undefined },
  { action: "prepare-update", revisionUnchanged: true },
])("does not infer an unchanged revision from missing or irrelevant evidence: %j", async evidence => {
  mock.fetch.mockImplementation(async () => json({ ...initial(), runs: [{ ...completed(), ...evidence }] }));
  render(<ArtizenCreatorWorkflow projectId="template-example" />);
  await screen.findByLabelText("Revisa y edita tu borrador");
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it("lets a human fix and approve an unchanged response without a new inference", async () => {
  const persisted = { ...initial(), runs: [{ ...completed(), action: "revise-update", revisionUnchanged: true }] };
  mock.fetch.mockImplementation(async (_path, init) => {
    if (init?.method === "PUT") {
      const input = JSON.parse(init.body);
      persisted.memory = { revision: 1, text: input.text, sourceRunId: input.sourceRunId, updatedAtMs: 1 };
      return json(persisted.memory);
    }
    return json(persisted);
  });
  render(<ArtizenCreatorWorkflow projectId="template-example" />);
  await screen.findByRole("alert");
  fireEvent.change(screen.getByLabelText("Revisa y edita tu borrador"), { target: { value: "La demo ya fue retirada; seguimos probando la revisión." } });
  fireEvent.click(screen.getByRole("button", { name: "Aprobar y guardar ejemplo" }));
  expect(mock.fetch.mock.calls.some(c => c[1]?.method)).toBe(false);
  fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Guardar ejemplo" }));
  await screen.findByText(/Ya guardaste un ejemplo de esta ejecución/);
  expect(persisted.memory.text).toBe("La demo ya fue retirada; seguimos probando la revisión.");
  expect(persisted.runs[0].result.draft).toBe(completed().result.draft);
  expect(mock.fetch.mock.calls.filter(c => c[1]?.method === "PUT")).toHaveLength(1);
  expect(mock.fetch.mock.calls.some(c => c[1]?.method === "POST")).toBe(false);
});

it("sends the edited source and current creator notes for revision only after confirmation", async () => {
  mock.fetch.mockImplementation(async () => json({ ...initial(), runs: [completed()] }));
  render(<ArtizenCreatorWorkflow projectId="template-example" />);
  fireEvent.change(await screen.findByLabelText("¿Qué avances puedes confirmar?"), { target: { value: "La demo ya fue retirada." } });
  fireEvent.change(screen.getByLabelText("Revisa y edita tu borrador"), { target: { value: "Nuestro borrador anterior." } });
  fireEvent.click(screen.getByRole("button", { name: "Revisar con mis notas" }));
  expect(await screen.findByRole("dialog")).toHaveTextContent("No publicará contenido");
  expect(mock.fetch.mock.calls.some(c => c[1]?.method === "POST")).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Iniciar trabajo" }));
  await waitFor(() => expect(mock.fetch.mock.calls.filter(c => c[1]?.method === "POST")).toHaveLength(1));
  const payload = JSON.parse(mock.fetch.mock.calls.find(c => c[1]?.method === "POST")![1].body);
  expect(payload).toEqual({ requestId: expect.any(String), action: "revise-update", sourceDraft: "Nuestro borrador anterior.", notes: "La demo ya fue retirada.", confirmed: true });
});
