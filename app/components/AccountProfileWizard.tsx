"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useAppAccount } from "../lib/useAppAccount";
import {
  emptyAccountProfile,
  readAccountProfile,
  saveAccountProfile,
  type AccountProfile,
} from "../lib/accountOnboarding";
import { accountCopy } from "../lib/accountOnboardingCopy";
import {
  SUPPORTED_LANGUAGES,
  persistLanguagePreference,
  type LanguageCode,
} from "../lib/i18n";
import { UsernameCard } from "./UsernameCard";
import { Button } from "@/components/ui/button";

export function AccountProfileWizard({
  settings = false,
}: {
  settings?: boolean;
}) {
  const { address } = useAppAccount();
  return address ? (
    <ProfileForm
      key={address.toLowerCase()}
      settings={settings}
      address={address}
    />
  ) : null;
}
function ProfileForm({
  settings,
  address,
}: {
  settings: boolean;
  address: string;
}) {
  const router = useRouter();
  const { i18n } = useTranslation();
  const copy = accountCopy(i18n.language);
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [error, setError] = useState<keyof typeof copy | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [reload, setReload] = useState(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    readAccountProfile(controller.signal)
      .then(({ account, suggestedDisplayName }) => {
        if (controller.signal.aborted) return;
        setProfile(
          account ?? {
            ...emptyAccountProfile(
              i18n.language.split("-")[0],
              Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
            ),
            displayName: suggestedDisplayName,
          },
        );
      })
      .catch(() => {
        if (!controller.signal.aborted) setError("loadError");
      });
    return () => controller.abort();
    // Changing language must not overwrite unsaved fields with a network reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, reload]);
  async function save(step: number, finish: boolean) {
    if (!profile || saving) return;
    if (!profile.displayName.trim()) {
      setError("nameRequired");
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const next = await saveAccountProfile({
        ...profile,
        step,
        completed: profile.completed || finish,
      });
      if (!mounted.current) return;
      setProfile(next);
      setSaved(true);
      await i18n.changeLanguage(next.language);
      persistLanguagePreference(next.language as LanguageCode);
      if (finish && !settings && mounted.current) router.push("/dashboard");
    } catch (e) {
      if (mounted.current)
        setError(
          e instanceof Error && e.message === "PROFILE_CONFLICT"
            ? "conflict"
            : "saveError",
        );
    } finally {
      if (mounted.current) setSaving(false);
    }
  }
  const fieldClass =
    "w-full min-w-0 rounded-md border border-border bg-background px-3 py-2 text-foreground";
  const show = (step: number) => settings || profile?.step === step;
  const update = (patch: Partial<AccountProfile>) => {
    setProfile((p) => p && { ...p, ...patch });
    setSaved(false);
  };
  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-5 rounded-xl border border-border bg-card p-5 sm:p-8">
      <header>
        <h1 className="text-2xl font-semibold">{copy.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{copy.intro}</p>
      </header>
      {!settings && profile && (
        <ol className="flex flex-wrap gap-3 text-sm" aria-label={copy.title}>
          {[copy.profile, copy.preferences, copy.socials].map((label, i) => (
            <li
              key={label}
              aria-current={profile.step === i ? "step" : undefined}
              className={
                profile.step === i
                  ? "font-semibold text-primary"
                  : "text-muted-foreground"
              }
            >
              {i + 1}. {label}
            </li>
          ))}
        </ol>
      )}
      {error && (
        <div role="alert" className="text-sm text-destructive">
          {copy[error]}
          {["loadError", "conflict"].includes(error) && (
            <Button
              variant="outline"
              className="ml-2"
              onClick={() => {
                setProfile(null);
                setError(null);
                setReload((n) => n + 1);
              }}
            >
              {copy.retry}
            </Button>
          )}
        </div>
      )}
      {!profile && !error && <p role="status">{copy.loading}</p>}
      {profile && (
        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            void save(
              Math.min(2, profile.step + 1),
              settings || profile.step === 2,
            );
          }}
        >
          <fieldset
            disabled={saving}
            className="flex min-w-0 flex-col gap-5 disabled:opacity-70"
          >
            {show(0) && (
              <div className="flex flex-col gap-4">
                <label className="flex flex-col gap-2">
                  {copy.displayName}
                  <input
                    required
                    maxLength={80}
                    autoComplete="name"
                    className={fieldClass}
                    value={profile.displayName}
                    onChange={(e) => update({ displayName: e.target.value })}
                  />
                </label>
                {!settings && (
                  <div>
                    <p className="mb-2 text-sm">
                      {copy.username} · {copy.optional}
                    </p>
                    <UsernameCard address={address} />
                  </div>
                )}
              </div>
            )}
            {show(1) && (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-2">
                  {copy.language}
                  <select
                    className={fieldClass}
                    value={profile.language}
                    onChange={(e) => update({ language: e.target.value })}
                  >
                    {SUPPORTED_LANGUAGES.map((l) => (
                      <option key={l.code} value={l.code}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-2">
                  {copy.timeZone}
                  <input
                    required
                    list="account-timezones"
                    className={fieldClass}
                    value={profile.timeZone}
                    onChange={(e) => update({ timeZone: e.target.value })}
                  />
                  <datalist id="account-timezones">
                    {[
                      "UTC",
                      "America/New_York",
                      "America/Los_Angeles",
                      "America/Lima",
                      "Europe/Madrid",
                      "Europe/London",
                      "Asia/Tokyo",
                    ].map((zone) => (
                      <option key={zone} value={zone} />
                    ))}
                  </datalist>
                </label>
              </div>
            )}
            {show(2) && (
              <div className="flex flex-col gap-4">
                <p className="text-sm text-muted-foreground">
                  {copy.socialHelp}
                </p>
                {(["x", "instagram", "tiktok", "website"] as const).map(
                  (key) => (
                    <label key={key} className="flex flex-col gap-2">
                      {
                        {
                          x: "X",
                          instagram: "Instagram",
                          tiktok: "TikTok",
                          website: copy.website,
                        }[key]
                      }{" "}
                      · {copy.optional}
                      <input
                        type={key === "website" ? "url" : "text"}
                        maxLength={2048}
                        autoComplete="off"
                        className={fieldClass}
                        value={profile.socials[key]}
                        placeholder={key === "website" ? "https://…" : "@…"}
                        onChange={(e) =>
                          update({
                            socials: {
                              ...profile.socials,
                              [key]: e.target.value,
                            },
                          })
                        }
                      />
                    </label>
                  ),
                )}
              </div>
            )}
          </fieldset>
          <footer className="flex flex-wrap items-center justify-between gap-3">
            {!settings && profile.step > 0 ? (
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => void save(profile.step - 1, false)}
              >
                {copy.back}
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit" disabled={saving || error === "conflict"}>
              {saving
                ? copy.saving
                : settings
                  ? copy.save
                  : profile.step === 2
                    ? copy.finish
                    : copy.next}
            </Button>
          </footer>
          {saved && settings && (
            <p role="status" className="text-sm text-emerald-500">
              {copy.done}
            </p>
          )}
        </form>
      )}
      <Link
        href="/dashboard"
        className="text-sm text-muted-foreground underline"
      >
        {copy.dashboard}
      </Link>
    </section>
  );
}
