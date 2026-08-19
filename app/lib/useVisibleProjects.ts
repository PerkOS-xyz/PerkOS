"use client";

import { useQuery } from "@tanstack/react-query";

import { getOrgProjects, type Project } from "./perkosApi";
import { useActiveOrg } from "./useActiveOrg";
import { useAppAccount } from "./useAppAccount";

/**
 * The projects visible in the active organization — the single source for the
 * project list, the task list and task creation.
 *
 * These used to disagree. /projects read the ORG OWNER's subtree (so a member
 * saw the org's projects), while /tasks and /tasks/new read the caller's own
 * (so a member saw none). The result was a member who could open a project and
 * then be told "No projects yet — tasks live inside projects", with the project
 * dropdown empty and a `projectId` in the URL that had nothing to match, so a
 * submit would have created a task attached to no project at all.
 */
export function useVisibleProjects(): {
  projects: Project[];
  isLoading: boolean;
  error: unknown;
} {
  const { address } = useAppAccount();
  const { activeOrgId, defaultOrgId, activeOrg } = useActiveOrg();

  const { data, isLoading, error } = useQuery({
    queryKey: ["wallet-projects", address, activeOrgId],
    queryFn: () =>
      getOrgProjects({
        org: activeOrg!,
        myWallet: address!,
        defaultOrgId: defaultOrgId ?? undefined,
      }),
    enabled: Boolean(address) && Boolean(activeOrg),
  });

  return { projects: data ?? [], isLoading, error };
}
