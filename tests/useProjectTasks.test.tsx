import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, render, renderHook, screen } from "@testing-library/react";
import type { Task } from "../app/lib/perkosApi";
type Converter = { fromFirestore(snap: { id: string; data(): Record<string, unknown> }): Task };
type Ref = { path: string; converter?: Converter; withConverter(c: Converter): Ref };
const mock = vi.hoisted(() => ({
  rows: [] as Record<string, unknown>[], language: "es", unsubscribe: vi.fn(), subscribe: vi.fn(),
  emit: null as null | (() => void), fail: null as null | ((e: Error) => void),
  getDocs: vi.fn(), updateDoc: vi.fn(),
}));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ i18n: { language: mock.language } }) }));
vi.mock("../app/lib/firebase", () => ({ firebaseDb: () => ({}) }));
vi.mock("../app/lib/activityEvents", () => ({ logActivity: vi.fn() }));
vi.mock("../app/lib/edges", () => ({ entityKey: vi.fn(), writeEdge: vi.fn() }));
vi.mock("firebase/firestore", async importOriginal => {
  const actual = await importOriginal<typeof import("firebase/firestore")>();
  const ref = (_db: unknown, ...parts: string[]): Ref => ({ path: parts.join("/"), withConverter(c) { return { ...this, converter: c }; } });
  const snapshot = (r: Ref) => ({ size: mock.rows.length, docs: mock.rows.map((row, i) => ({ id: `task-${i}`, data: () => {
    if (!r.converter) throw Error("missing_shared_converter");
    return r.converter.fromFirestore({ id: `task-${i}`, data: () => row });
  } })) });
  return { ...actual, collection: ref, doc: ref, query: (r: Ref) => r, updateDoc: mock.updateDoc,
    getDoc: async () => ({ exists: () => true, data: () => ({ name: "Fixture", tasks: mock.rows.length, agents: 0, agentIds: [] }) }),
    getDocs: (r: Ref) => { mock.getDocs(r.path); return Promise.resolve(r.path.endsWith("/tasks") ? snapshot(r) : { size: 0, docs: [] }); },
    onSnapshot: (r: Ref, next: (s: ReturnType<typeof snapshot>) => void, error: (e: Error) => void) => {
      mock.subscribe(r.path, r.converter);
      mock.emit = () => next(snapshot(r)); mock.fail = error; mock.emit(); return mock.unsubscribe;
    },
  };
});
import { useProjectTasks } from "../app/lib/useProjectTasks";
import { taskConverter } from "../app/lib/projectTaskConverter";
import { getWalletProject } from "../app/lib/perkosApi";
import { ArtizenProjectBoard } from "../app/components/ArtizenProjectBoard";
const failed = { name: "Prepare supporter update", status: "Review", priority: "Medium", agent: "Hermes", result: "", executionMode: "artizen-on-demand", artizenRunId: "fixture-run", executionPhase: "awaiting_stop", stopReason: "failed" };
function Board() { const { tasks } = useProjectTasks("FIXTURE-OWNER", "fixture-project"); return <ArtizenProjectBoard projectId="fixture-project" tasks={tasks} />; }
beforeEach(() => { vi.clearAllMocks(); mock.rows = [{ ...failed }]; mock.language = "es"; mock.emit = null; mock.fail = null; });
afterEach(cleanup);

it.each(["es", "en"])("keeps failed realtime snapshots outside review in %s, including replay", language => {
  mock.language = language; const view = render(<Board />);
  expect(screen.getByText(language === "es" ? "Sin resultado · 1" : "Unsuccessful · 1")).toBeInTheDocument();
  expect(screen.getByText(language === "es" ? "Revisión humana · 0" : "Human review · 0")).toBeInTheDocument();
  expect(screen.getByRole("alert")).toHaveTextContent(language === "es" ? "reserva sigue retenida" : "reservation remains held");
  expect(screen.queryByText(/Resultado pendiente|Result pending/)).not.toBeInTheDocument();
  act(() => mock.emit?.());
  expect(mock.subscribe).toHaveBeenCalledTimes(1);
  expect(mock.subscribe).toHaveBeenCalledWith("wallets/fixture-owner/projects/fixture-project/tasks", taskConverter);
  view.unmount(); expect(mock.unsubscribe).toHaveBeenCalledTimes(1);
  render(<Board />);
  expect(screen.getByRole("alert")).toHaveTextContent(language === "es" ? "No se volverá a generar" : "will not regenerate automatically");
  expect(mock.updateDoc).not.toHaveBeenCalled(); expect(mock.getDocs).not.toHaveBeenCalled();
});
it("preserves failure settlement, review drafts, approval metadata and legacy task data", () => {
  mock.rows = [
    { ...failed, executionPhase: "settled", failureCode: "runtime-start-failed" },
    { ...failed, result: "Draft", stopReason: "completed", executionPhase: "settled" },
    { ...failed, result: "Approved draft", status: "Done", humanApproved: true, approvedExample: "Example" },
    { name: "Ordinary task", status: "Backlog", priority: "Low", agent: "Regular", attachments: [{ name: "file" }], logs: ["log"], createdAt: { toDate: () => new Date("2026-01-01T00:00:00Z") } },
  ];
  const { result } = renderHook(() => useProjectTasks("fixture-owner", "fixture-project"));
  expect(result.current.tasks[0]).toMatchObject({ ...failed, id: "task-0", executionPhase: "settled", failureCode: "runtime-start-failed" });
  expect(result.current.tasks[2]).toMatchObject({ humanApproved: true, approvedExample: "Example", status: "Done" });
  expect(result.current.tasks[3]).toMatchObject({ attachments: [{ name: "file" }], logs: ["log"], createdAt: "2026-01-01T00:00:00.000Z" });
  render(<ArtizenProjectBoard tasks={result.current.tasks} projectId="fixture-project" />);
  expect(screen.getByText("Sin resultado · 1")).toBeInTheDocument();
  expect(screen.getByText("Revisión humana · 1")).toBeInTheDocument();
  expect(screen.getByText("Completadas · 1")).toBeInTheDocument();
  expect(screen.getByRole("alert")).toHaveTextContent("reserva se ha conciliado");
});
it("initial project reads and realtime use identical projections", async () => {
  const initial = await getWalletProject({ walletAddress: "fixture-owner", projectId: "fixture-project" });
  const { result } = renderHook(() => useProjectTasks("fixture-owner", "fixture-project"));
  expect(result.current.tasks).toEqual(initial.tasks);
  expect(mock.getDocs).toHaveBeenCalledTimes(3); expect(mock.updateDoc).not.toHaveBeenCalled();
});
it("keeps missing scope dormant, handles errors and unsubscribes when scope changes", () => {
  const { result, rerender, unmount } = renderHook(({ project }: { project: string | null }) => useProjectTasks("fixture-owner", project), { initialProps: { project: null } as { project: string | null } });
  expect(mock.subscribe).not.toHaveBeenCalled(); expect(result.current.loaded).toBe(false);
  rerender({ project: "fixture-project" }); expect(mock.subscribe).toHaveBeenCalledTimes(1);
  const error = Error("permission-denied"); act(() => mock.fail?.(error));
  expect(result.current).toEqual({ tasks: [], loaded: true, error });
  rerender({ project: "second-project" }); expect(mock.unsubscribe).toHaveBeenCalledTimes(1);
  unmount(); expect(mock.unsubscribe).toHaveBeenCalledTimes(2);
});
