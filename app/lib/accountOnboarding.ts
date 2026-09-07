import { authedFetch } from "./apiClient";

export type AccountProfile = {
  displayName: string;
  language: string;
  timeZone: string;
  socials: { x: string; instagram: string; tiktok: string; website: string };
  step: number;
  completed: boolean;
  revision: number;
};
export async function readAccountProfile(
  signal?: AbortSignal,
): Promise<{ account: AccountProfile | null; suggestedDisplayName: string }> {
  const res = await authedFetch("/account/onboarding", {
    signal,
    cache: "no-store",
  });
  if (!res.ok) throw new Error("PROFILE_LOAD_FAILED");
  return res.json();
}
export async function saveAccountProfile(
  profile: AccountProfile,
): Promise<AccountProfile> {
  const { revision, ...values } = profile;
  // Explicit allowlist: API response metadata is never echoed as editable fields.
  const body = {
    displayName: values.displayName,
    language: values.language,
    timeZone: values.timeZone,
    socials: values.socials,
    step: values.step,
    completed: values.completed,
    expectedRevision: revision,
  };
  const res = await authedFetch("/account/onboarding", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok)
    throw new Error(
      res.status === 409 ? "PROFILE_CONFLICT" : "PROFILE_SAVE_FAILED",
    );
  return (await res.json()).account;
}

export function emptyAccountProfile(
  language: string,
  timeZone: string,
): AccountProfile {
  return {
    displayName: "",
    language,
    timeZone,
    socials: { x: "", instagram: "", tiktok: "", website: "" },
    step: 0,
    completed: false,
    revision: 0,
  };
}
