"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

type OnboardingState = {
  workspaceName: string;
  setWorkspaceName: (value: string) => void;
  hasProject: boolean;
  markProjectCreated: () => void;
  hasAgent: boolean;
  markAgentRegistered: () => void;
  reset: () => void;
};

const OnboardingContext = createContext<OnboardingState | null>(null);

const STORAGE_KEY = "swarm.onboarding.v1";

type Persisted = {
  workspaceName: string;
  hasProject: boolean;
  hasAgent: boolean;
};

function loadPersisted(): Persisted {
  if (typeof window === "undefined") {
    return { workspaceName: "", hasProject: false, hasAgent: false };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { workspaceName: "", hasProject: false, hasAgent: false };
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    return {
      workspaceName: parsed.workspaceName ?? "",
      hasProject: Boolean(parsed.hasProject),
      hasAgent: Boolean(parsed.hasAgent),
    };
  } catch {
    return { workspaceName: "", hasProject: false, hasAgent: false };
  }
}

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [workspaceName, setWorkspaceNameState] = useState("");
  const [hasProject, setHasProject] = useState(false);
  const [hasAgent, setHasAgent] = useState(false);

  useEffect(() => {
    const persisted = loadPersisted();
    setWorkspaceNameState(persisted.workspaceName);
    setHasProject(persisted.hasProject);
    setHasAgent(persisted.hasAgent);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ workspaceName, hasProject, hasAgent })
    );
  }, [workspaceName, hasProject, hasAgent]);

  const value: OnboardingState = {
    workspaceName,
    setWorkspaceName: setWorkspaceNameState,
    hasProject,
    markProjectCreated: () => setHasProject(true),
    hasAgent,
    markAgentRegistered: () => setHasAgent(true),
    reset: () => {
      setWorkspaceNameState("");
      setHasProject(false);
      setHasAgent(false);
    },
  };

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used inside OnboardingProvider");
  return ctx;
}
