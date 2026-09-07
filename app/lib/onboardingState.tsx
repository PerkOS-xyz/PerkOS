"use client";
import {
  createContext,
  useContext,
  useCallback,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useAppAccount } from "./useAppAccount";
type WorkspaceState = {
  workspaceName: string;
  hasProject: boolean;
  hasAgent: boolean;
};
type OnboardingState = WorkspaceState & {
  setWorkspaceName: (value: string) => void;
  markProjectCreated: () => void;
  markAgentRegistered: () => void;
  reset: () => void;
};
const OnboardingContext = createContext<OnboardingState | null>(null);
const PREFIX = "perkos.workspace.v2";
const EVENT = "perkos-workspace-change";
const empty: WorkspaceState = {
  workspaceName: "",
  hasProject: false,
  hasAgent: false,
};
function read(wallet: string): string {
  if (!wallet || typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(`${PREFIX}:${wallet}`) ?? "";
  } catch {
    return "";
  }
}
function parse(raw: string): WorkspaceState {
  try {
    const d = JSON.parse(raw);
    return {
      workspaceName: typeof d.workspaceName === "string" ? d.workspaceName : "",
      hasProject: d.hasProject === true,
      hasAgent: d.hasAgent === true,
    };
  } catch {
    return empty;
  }
}
function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}
/** Legacy workspace hints only. Account onboarding is persisted by the API, not this cache.
 * Never migrate the old unscoped browser key: its owner cannot be established. */
export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { address } = useAppAccount();
  const wallet = address?.toLowerCase() ?? "";
  const snapshot = useSyncExternalStore(
    subscribe,
    useCallback(() => read(wallet), [wallet]),
    () => "",
  );
  const data = parse(snapshot);
  function update(patch: Partial<WorkspaceState>) {
    if (!wallet) return;
    try {
      window.localStorage.setItem(
        `${PREFIX}:${wallet}`,
        JSON.stringify({ ...parse(read(wallet)), ...patch }),
      );
      window.dispatchEvent(new Event(EVENT));
    } catch {
      /* Cache is optional. */
    }
  }
  return (
    <OnboardingContext.Provider
      value={{
        ...data,
        setWorkspaceName: (workspaceName) => update({ workspaceName }),
        markProjectCreated: () => update({ hasProject: true }),
        markAgentRegistered: () => update({ hasAgent: true }),
        reset: () => update(empty),
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}
export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx)
    throw new Error("useOnboarding must be used inside OnboardingProvider");
  return ctx;
}
