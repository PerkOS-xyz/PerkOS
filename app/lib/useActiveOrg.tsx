"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useAppAccount } from "./useAppAccount";

import {
  ensureDefaultOrg,
  getSharedOrgs,
  getWalletOrgs,
  type Organization,
} from "./perkosApi";

const LS_KEY = "perkos.activeOrgId";
// Pre-orgs localStorage placeholder (the old /organizations stub). We migrate
// its name onto the new default org once, then drop it.
const LEGACY_ORG_KEY = "swarm.organization.saved.v1";

function readLegacyOrgName(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = localStorage.getItem(LEGACY_ORG_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as { name?: unknown };
    return typeof parsed?.name === "string" && parsed.name.trim()
      ? parsed.name.trim()
      : undefined;
  } catch {
    return undefined;
  }
}

function clearLegacyOrg() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(LEGACY_ORG_KEY);
  } catch {
    // ignore
  }
}

type ActiveOrgState = {
  orgs: Organization[];
  activeOrg: Organization | null;
  activeOrgId: string | null;
  /** The default org's id — projects with no orgId belong here. */
  defaultOrgId: string | null;
  loading: boolean;
  setActiveOrgId: (id: string) => void;
  /** Re-fetch the org list (after create/rename); keeps the active selection. */
  refresh: () => Promise<Organization[]>;
};

const ActiveOrgContext = createContext<ActiveOrgState | null>(null);

/**
 * Provides the wallet's organizations + the currently-active one. On login it
 * guarantees a default org exists (ensureDefaultOrg) and restores the last
 * active org from localStorage. Wrap the authed app shell with this.
 */
export function ActiveOrgProvider({ children }: { children: ReactNode }) {
  const { address } = useAppAccount();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [activeOrgId, setActiveOrgIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const pickActive = useCallback((list: Organization[]) => {
    const stored =
      typeof window !== "undefined" ? localStorage.getItem(LS_KEY) : null;
    const valid = list.find((o) => o.id === stored);
    const def = list.find((o) => o.isDefault) ?? list[0] ?? null;
    return valid?.id ?? def?.id ?? null;
  }, []);

  const load = useCallback(async () => {
    if (!address) {
      setOrgs([]);
      setActiveOrgIdState(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // One-shot: carry over the name the user set in the old localStorage org
      // stub (if any) onto the new default org, then drop the stale stub.
      const migratedName = readLegacyOrgName();
      const own = await ensureDefaultOrg(address, {
        defaultName: migratedName,
      });
      if (migratedName) clearLegacyOrg();
      // Merge in orgs shared with this wallet (owned by others).
      const shared = await getSharedOrgs(address).catch(() => []);
      const list = [...own, ...shared];
      setOrgs(list);
      setActiveOrgIdState((cur) =>
        cur && list.some((o) => o.id === cur) ? cur : pickActive(list)
      );
    } catch {
      // Leave empty — header falls back to the wallet label.
    } finally {
      setLoading(false);
    }
  }, [address, pickActive]);

  useEffect(() => {
    void load();
  }, [load]);

  const setActiveOrgId = useCallback((id: string) => {
    setActiveOrgIdState(id);
    if (typeof window !== "undefined") localStorage.setItem(LS_KEY, id);
  }, []);

  const refresh = useCallback(async () => {
    if (!address) return [];
    const [own, shared] = await Promise.all([
      getWalletOrgs(address),
      getSharedOrgs(address).catch(() => []),
    ]);
    const list = [...own, ...shared];
    setOrgs(list);
    return list;
  }, [address]);

  const activeOrg = orgs.find((o) => o.id === activeOrgId) ?? null;
  const defaultOrgId =
    orgs.find((o) => o.isDefault)?.id ?? orgs[0]?.id ?? null;

  return (
    <ActiveOrgContext.Provider
      value={{
        orgs,
        activeOrg,
        activeOrgId,
        defaultOrgId,
        loading,
        setActiveOrgId,
        refresh,
      }}
    >
      {children}
    </ActiveOrgContext.Provider>
  );
}

export function useActiveOrg(): ActiveOrgState {
  const ctx = useContext(ActiveOrgContext);
  if (!ctx) {
    throw new Error("useActiveOrg must be used within <ActiveOrgProvider>");
  }
  return ctx;
}
