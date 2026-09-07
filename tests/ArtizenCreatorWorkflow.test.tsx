import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ArtizenCreatorWorkflow } from "../app/components/ArtizenCreatorWorkflow";

const mock = vi.hoisted(() => ({ fetch: vi.fn(), language: "es" }));
vi.mock("../app/lib/apiClient", () => ({ authedFetch: mock.fetch }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: mock.language } }) }));
const initial = () => ({ configured: true, budget: { limitMicros: 1000000, reservedMicros: 0, allocatedMicros: 0 },
  activeRunId: null, runReservationMicros: 50000, runs: [], memory: { revision: 0, text: "", sourceRunId: null, updatedAtMs: 0 } });
const completed = () => ({ requestId: "00000000-0000-4000-8000-000000000001", action: "prepare-update", phase: "settled",
  result: { draft: "Lanzamos una demo.", reviewNotes: ["Verifica los detalles antes de compartir."], sourcesUsed: ["current notes"] },
  allocatedMicros: 1000, reservedMicros: 50000, createdAtMs: Date.UTC(2026, 8, 7) });
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
beforeEach(() => { mock.language = "es"; mock.fetch.mockReset().mockImplementation(async () => json(initial())); });
afterEach(() => { cleanup(); vi.useRealTimers(); });
async function fill() {
  const notes = await screen.findByLabelText("¿Qué avances puedes confirmar?");
  fireEvent.change(notes, { target: { value: "Lanzamos una demo." } });
  fireEvent.click(screen.getByRole("button", { name: "Preparar borrador" }));
  await screen.findByRole("dialog");
}
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
  expect(screen.getByText("No runs yet")).toBeInTheDocument();
  expect(screen.queryByText("Sin ejecuciones")).not.toBeInTheDocument();
});
it("missing budget does not offer an enabled wake action", async () => {
  mock.fetch.mockImplementation(async () => json({ ...initial(), configured: false, budget: null }));
  render(<ArtizenCreatorWorkflow projectId="template-example" />);
  expect(await screen.findByText("Este proyecto aún no tiene un presupuesto habilitado.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Preparar borrador" })).toBeDisabled();
});
