"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ChevronDown, ChevronUp, ExternalLink, Plus, Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { useQuery } from "@tanstack/react-query";

import { AgentOrb } from "@/app/components/AgentOrb";
import { findPreset, presetSystemPrompt, type AgentPreset } from "@/app/lib/agentPresets";
import type { AgentRuntime } from "@/app/lib/perkosApi";
import { fetchActiveRuntimes } from "@/app/lib/runtimeImages";

import { isValidAgentName, normalizeAgentName, type StepProps } from "../types";
import { StepHeader } from "../ui/StepHeader";
import { TeammateIdCard } from "../ui/TeammateIdCard";
import { SoulDetailCard } from "../ui/SoulDetailCard";

// ---------------------------------------------------------------------------
// Origin (provenance) display. PerkOS presets have no `origin` (treated as
// "perkos"); the "custom" card is its own origin. Imported templates carry
// `origin` + `sourceUrl` (a GitHub link, shown so users can inspect them).
// ---------------------------------------------------------------------------

type Origin = "perkos" | "openclaw" | "hermes" | "custom";

const ORIGIN_META: Record<Origin, { label: string; badge: string; link: string }> = {
  perkos: { label: "PerkOS", badge: "bg-primary/15 text-primary", link: "" },
  openclaw: {
    label: "OpenClaw",
    badge: "bg-[hsla(210,70%,55%,0.15)] text-[hsl(210,70%,72%)]",
    link: "text-[hsl(210,70%,66%)]",
  },
  hermes: {
    label: "Hermes",
    badge: "bg-[hsla(45,80%,55%,0.15)] text-[hsl(45,80%,70%)]",
    link: "text-[hsl(45,80%,62%)]",
  },
  custom: { label: "Custom", badge: "bg-[hsla(280,55%,60%,0.15)] text-[hsl(280,60%,78%)]", link: "" },
};

const FILTERS: Origin[] = ["perkos", "openclaw", "hermes", "custom"];

function originOf(p: AgentPreset): Origin {
  if (p.id === "custom") return "custom";
  return p.origin ?? "perkos";
}

// Every soul is portable (it's just a system prompt). A template DEFAULTS to
// its origin's engine, but the user can switch — so a Hermes user can run any
// template too. PerkOS/Custom have no origin engine (default to first available).
function defaultRuntimeFor(origin: Origin): AgentRuntime | null {
  if (origin === "openclaw") return "OpenClaw";
  if (origin === "hermes") return "Hermes";
  return null;
}

// Card description. Community blurbs are raw 2nd-person SOUL.md first sentences
// ("You are Sentinel, an AI churn … agent.") — normalize to an outcome line with
// no internal name leak. PerkOS blurbs (no "You are") pass through unchanged.
function displayBlurb(p: AgentPreset): string {
  let b = (p.blurb || "").trim();
  b = b.replace(/^you are\s+[^,.]+,\s*an?\s+/i, ""); // "You are Sentinel, an " → ""
  b = b.replace(/^you are\s+an?\s+/i, ""); // "You are a technical " → "technical "
  b = b.replace(/^you are\s+/i, "");
  b = b.trim();
  if (b) b = b.charAt(0).toUpperCase() + b.slice(1);
  return b.length < 12 ? p.blurb || p.name : b;
}

function OriginBadge({ origin }: { origin: Origin }) {
  const m = ORIGIN_META[origin];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold leading-none",
        m.badge,
      )}
    >
      <span className="h-1 w-1 rounded-full bg-current" aria-hidden />
      {m.label}
    </span>
  );
}

// Pick a template (or "custom"), name the agent, optionally edit its soul.
// Two-state flow per the UX research: picker grid OR focused detail, never
// both — picking a persona is the most emotionally weighty step, so the
// chosen teammate gets the screen.
export function StepTemplate({
  state,
  onChange,
  presets,
}: StepProps & { presets: AgentPreset[] }) {
  const { t } = useTranslation();
  const preset =
    presets.find((p) => p.id === state.personaId) ?? findPreset(state.personaId);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [filter, setFilter] = useState<"all" | Origin>("all");
  const [search, setSearch] = useState("");
  const defaultPrompt = preset ? presetSystemPrompt(preset, state.agentName) : "";
  const nameError =
    state.agentName.length > 0 && !isValidAgentName(state.agentName)
      ? t("wizard.external.nameError")
      : undefined;

  const { data: runtimes } = useQuery({ queryKey: ["wizard", "runtimes"], queryFn: fetchActiveRuntimes });
  const tagFor = (rt: AgentRuntime): string | null => {
    const list = rt === "OpenClaw" ? runtimes?.openclaw : runtimes?.hermes;
    return list && list.length ? list[0].primaryTag : null;
  };
  const available: AgentRuntime[] = [
    ...(runtimes?.openclaw?.length ? (["OpenClaw"] as AgentRuntime[]) : []),
    ...(runtimes?.hermes?.length ? (["Hermes"] as AgentRuntime[]) : []),
  ];
  // A persona can be selected before the runtime query settles. Resolve the
  // concrete image as soon as it arrives so Review never becomes silently
  // blocked by that network race.
  useEffect(() => {
    if (!state.runtime || state.imageTag) return;
    const runtimeImages =
      state.runtime === "OpenClaw" ? runtimes?.openclaw : runtimes?.hermes;
    const imageTag = runtimeImages?.[0]?.primaryTag ?? null;
    if (imageTag) onChange({ imageTag });
  }, [runtimes, state.runtime, state.imageTag, onChange]);
  // Pick a template + resolve its engine: locked by origin for community
  // templates, else default to the first available (the user can switch
  // portable PerkOS/Custom templates in the detail view).
  const pickTemplate = (p: AgentPreset) => {
    const rt =
      defaultRuntimeFor(originOf(p)) ??
      (available.includes("OpenClaw") ? "OpenClaw" : available[0] ?? "OpenClaw");
    onChange({
      personaId: p.id,
      agentName: state.agentName || normalizeAgentName(p.name),
      systemPromptOverride: "",
      runtime: rt,
      imageTag: tagFor(rt),
    });
  };

  const counts = useMemo(() => {
    const c: Record<Origin, number> = { perkos: 0, openclaw: 0, hermes: 0, custom: 0 };
    for (const p of presets) c[originOf(p)]++;
    return c;
  }, [presets]);

  const filtered = useMemo(() => {
    let r = presets;
    if (filter !== "all") r = r.filter((p) => originOf(p) === filter);
    const q = search.trim().toLowerCase();
    if (q) r = r.filter((p) => p.name.toLowerCase().includes(q) || p.blurb.toLowerCase().includes(q));
    // "Build your own" pinned first (create-from-scratch is always the first
    // card); every other template sorted alphabetically by name.
    return [...r].sort((a, b) => {
      if (a.id === "custom") return -1;
      if (b.id === "custom") return 1;
      return a.name.localeCompare(b.name);
    });
  }, [presets, filter, search]);

  if (preset) {
    const origin = originOf(preset);
    return (
      <div className="flex flex-col gap-5">
        <button
          type="button"
          onClick={() => {
            setShowAdvanced(false);
            onChange({ personaId: null, systemPromptOverride: "", runtime: null, imageTag: null });
          }}
          className="inline-flex min-h-11 -ml-2 items-center gap-1.5 self-start px-2 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("wizard.template.changePersona")}
        </button>

        <div className="flex flex-col items-center gap-3">
          <TeammateIdCard
            name={preset.name}
            presetId={preset.id}
            tagline={t("wizard.template.teammateTagline", { name: preset.name.toLowerCase() })}
          />
          <p className="text-xl font-semibold text-foreground">{preset.name}</p>
          <p className="-mt-1 text-center text-xs text-muted-foreground">{preset.blurb}</p>
          {preset.soul.identity ? (
            <p className="max-w-md text-center text-sm italic leading-relaxed text-foreground/80">
              {preset.soul.identity}
            </p>
          ) : null}
        </div>

        {/* Provenance row — origin + (for imported) the GitHub source link. */}
        {preset.id !== "custom" ? (
          <div className="flex flex-wrap items-center gap-2.5 self-stretch rounded-lg border border-border bg-card/50 px-3 py-2">
            <OriginBadge origin={origin} />
            {preset.sourceUrl ? (
              <>
                <span className="text-border" aria-hidden>
                  |
                </span>
                <a
                  href={preset.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={t("wizard.template.viewSourceAria", { origin: ORIGIN_META[origin].label })}
                  className={cn(
                    "inline-flex items-center gap-1 text-xs underline-offset-2 hover:underline",
                    ORIGIN_META[origin].link,
                  )}
                >
                  <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
                  {t("wizard.template.viewSourceLink")}
                </a>
              </>
            ) : (
              <span className="text-xs text-muted-foreground">{t("wizard.template.handCrafted")}</span>
            )}
          </div>
        ) : null}

        {/* Engine — every template is portable; it defaults to its origin's
            engine (tagged "recommended") but the user can switch to either. */}
        <div className="flex flex-col gap-2">
          <Label className="text-xs text-muted-foreground">{t("wizard.template.engine")}</Label>
          <div className="grid grid-cols-2 gap-2">
            {(["OpenClaw", "Hermes"] as AgentRuntime[])
              .filter((rt) => available.includes(rt))
              .map((rt) => {
                const recommended = defaultRuntimeFor(origin) === rt;
                return (
                  <button
                    key={rt}
                    type="button"
                    onClick={() => onChange({ runtime: rt, imageTag: tagFor(rt) })}
                    className={cn(
                      "flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left transition-colors",
                      state.runtime === rt
                        ? "border-primary/60 bg-primary/10"
                        : "border-border hover:border-primary/40",
                    )}
                  >
                    <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                      {rt}
                      {recommended ? (
                        <span className="rounded bg-primary/15 px-1 py-0.5 text-[9px] font-semibold uppercase text-primary">
                          {t("wizard.template.recommended")}
                        </span>
                      ) : null}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {t(`wizard.template.runtimeHint.${rt}`)}
                    </span>
                  </button>
                );
              })}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="agent-name" className="text-xs text-muted-foreground">
            {t("wizard.template.agentName")}
          </Label>
          <Input
            id="agent-name"
            value={state.agentName}
            onChange={(e) => onChange({ agentName: e.target.value })}
            placeholder={preset.name}
            className="h-10"
            maxLength={32}
            pattern="[A-Za-z0-9_-]{2,32}"
            aria-invalid={Boolean(nameError)}
          />
          {nameError ? <span className="text-xs text-destructive">{nameError}</span> : null}
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setShowPrompt((v) => !v)}
            className="flex items-center gap-1.5 self-start text-xs font-medium text-primary hover:underline"
          >
            {showPrompt ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
            {showPrompt ? t("wizard.template.hidePrompt") : t("wizard.template.showPrompt")}
            {state.systemPromptOverride &&
            state.systemPromptOverride !== defaultPrompt ? (
              <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] text-primary">
                {t("wizard.template.edited")}
              </span>
            ) : null}
          </button>
          {showPrompt ? (
            <>
              <Label htmlFor="system-prompt" className="sr-only">
                {t("wizard.template.systemPromptSr")}
              </Label>
              <p className="text-[11px] text-muted-foreground">
                {t("wizard.template.systemPromptHelp")}
              </p>
              <Textarea
                id="system-prompt"
                value={state.systemPromptOverride || defaultPrompt}
                onChange={(e) => onChange({ systemPromptOverride: e.target.value })}
                rows={5}
                className="font-mono text-xs"
                placeholder={t("wizard.template.systemPromptPlaceholder")}
              />
              {state.systemPromptOverride &&
              state.systemPromptOverride !== defaultPrompt ? (
                <button
                  type="button"
                  className="self-start text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                  onClick={() => onChange({ systemPromptOverride: "" })}
                >
                  {t("wizard.template.resetToDefault", { name: preset.name })}
                </button>
              ) : null}
            </>
          ) : null}
        </div>

        {/* Structured-soul presets get the "full soul" card. Imported (community)
            templates ship raw soulMarkdown — their content is the system-prompt
            preview above, so the structured card (empty) is hidden. */}
        {preset.id !== "custom" && !preset.soulMarkdown ? (
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="flex items-center gap-1.5 self-start text-xs font-medium text-primary hover:underline"
            >
              {showAdvanced ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
              {showAdvanced ? t("wizard.template.advancedHide") : t("wizard.template.advancedView")}
            </button>
            {showAdvanced ? <SoulDetailCard soul={preset.soul} /> : null}
          </div>
        ) : null}
      </div>
    );
  }

  // Picker state — filter bar + responsive grid (2 cols mobile / 3 md / 4 lg).
  return (
    <div className="flex flex-col gap-4">
      <StepHeader
        title={t("wizard.template.pickTitle")}
        description={t("wizard.template.pickDescription")}
      />

      {/* Filter by origin + search. */}
      <div className="flex flex-col gap-2">
        <div role="radiogroup" aria-label={t("wizard.template.filterAria")} className="flex flex-wrap gap-1.5">
          {(["all", ...FILTERS] as const).map((f) => {
            const label = f === "all" ? t("wizard.template.filterAll") : ORIGIN_META[f].label;
            const count = f === "all" ? presets.length : counts[f];
            const active = filter === f;
            return (
              <button
                key={f}
                role="radio"
                aria-checked={active}
                type="button"
                onClick={() => setFilter(f)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  active
                    ? "border-primary/50 bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground",
                )}
              >
                {label}
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] tabular-nums",
                    active ? "bg-primary/15 text-primary" : "bg-background text-muted-foreground",
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative">
          <Label htmlFor="template-search" className="sr-only">
            {t("wizard.template.searchSr")}
          </Label>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            id="template-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("wizard.template.searchPlaceholder")}
            className="h-9 pl-9 pr-9"
          />
          {search ? (
            <button
              type="button"
              aria-label={t("wizard.template.clearSearch")}
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            {search
              ? t("wizard.template.noMatchQuery", { query: search })
              : t("wizard.template.noMatchFilter")}
          </p>
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setFilter("all");
            }}
            className="rounded-md border border-border px-3 py-1.5 text-xs text-foreground transition-colors hover:border-primary/40"
          >
            {t("wizard.template.showAll")}
          </button>
        </div>
      ) : (
        <div
          role="radiogroup"
          aria-label={t("wizard.template.chooseAria")}
          aria-live="polite"
          className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4"
        >
          {filtered.map((p) => {
            const o = originOf(p);
            const selected = state.personaId === p.id;
            const isCustom = p.id === "custom";
            return (
              // Wrapper is the hover group; the source link is a SIBLING overlay
              // (not nested in the radio button — that would be invalid HTML).
              <div key={p.id} className="group relative h-full">
                <button
                  role="radio"
                  aria-checked={selected}
                  type="button"
                  onClick={() => pickTemplate(p)}
                  className={cn(
                    "flex h-full w-full flex-col gap-2 rounded-xl border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                    selected && "border-primary/60 bg-primary/5 ring-1 ring-primary/30",
                    // The "build your own" tile is a create ACTION, not a template:
                    // a dashed purple border + "+" set it apart so it reads as the
                    // escape hatch from the ready-made roster.
                    !selected &&
                      isCustom &&
                      "border-dashed border-[hsla(280,55%,60%,0.55)] bg-[hsla(280,55%,60%,0.05)] hover:border-[hsl(280,60%,70%)]",
                    !selected && !isCustom && "border-border bg-card hover:border-primary/40",
                  )}
                >
                  {/* Header: an orb identifies a template; the custom tile shows a
                      "+" so it reads as "start a new one". The NAME is the label. */}
                  <div className="flex items-center gap-2">
                    {isCustom ? (
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-dashed border-[hsl(280,55%,62%)] text-[hsl(280,60%,80%)]">
                        <Plus className="h-4 w-4" aria-hidden />
                      </span>
                    ) : (
                      <AgentOrb name={p.name} presetId={p.id} size={32} />
                    )}
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                      {p.name}
                    </span>
                  </div>
                  {/* Description: the "what it does" — the actual decision driver.
                      Clamped to 2 lines with a reserved height so the grid aligns. */}
                  <p className="line-clamp-2 min-h-[2.25rem] text-xs leading-snug text-muted-foreground">
                    {displayBlurb(p)}
                  </p>
                  {/* Footer: provenance, lowest priority — pinned to the bottom. */}
                  <div className="mt-auto">
                    <OriginBadge origin={o} />
                  </div>
                </button>
                {p.sourceUrl ? (
                  <a
                    href={p.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={t("wizard.template.viewSourceAria", { origin: ORIGIN_META[o].label })}
                    onClick={(e) => e.stopPropagation()}
                    className={cn(
                      "absolute right-1.5 top-1.5 z-10 inline-flex items-center rounded-md bg-background/70 p-1 opacity-0 backdrop-blur-sm transition-opacity hover:bg-background focus:opacity-100 group-hover:opacity-100",
                      ORIGIN_META[o].link,
                    )}
                  >
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  </a>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
