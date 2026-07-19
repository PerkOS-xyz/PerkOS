"use client";

import { useEffect, useState } from "react";

import { subscribeProject, type Project } from "./perkosApi";

type State = {
  project: Project | null;
  loaded: boolean;
  error: Error | null;
};

/** Realtime project-level state, complementary to the task listener. */
export function useProject(
  walletAddress: string | null | undefined,
  projectId: string | null | undefined,
): State {
  const [state, setState] = useState<State>({ project: null, loaded: false, error: null });

  useEffect(() => {
    if (!walletAddress || !projectId) {
      setState({ project: null, loaded: false, error: null });
      return;
    }
    return subscribeProject(
      walletAddress,
      projectId,
      (project) => setState({ project, loaded: true, error: null }),
      (error) => setState({ project: null, loaded: true, error }),
    );
  }, [walletAddress, projectId]);

  return state;
}
