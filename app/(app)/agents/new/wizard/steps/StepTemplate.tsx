"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, ChevronDown, ChevronUp, ExternalLink, Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { useQuery } from "@tanstack/react-query";

import { AgentOrb } from "@/app/components/AgentOrb";
import { agentVisual } from "@/app/lib/agentVisuals";
import { findPreset, presetSystemPrompt, type AgentPreset } from "@/app/lib/agentPresets";
import type { AgentRuntime } from "@/app/lib/perkosApi";
import { fetchActiveRuntimes } from "@/app/lib/runtimeImages";

import type { StepProps } from "../types";
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

const RUNTIME_HINT: Record<AgentRuntime, string> = {
  OpenClaw: "Autonomous — multi-step work & tools",
  Hermes: "Conversational — fast, chat-driven",
};

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
  const preset =
    presets.find((p) => p.id === state.personaId) ?? findPreset(state.personaId);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [filter, setFilter] = useState<"all" | Origin>("all");
  const [search, setSearch] = useState("");
  const defaultPrompt = preset ? presetSystemPrompt(preset, state.agentName) : "";

  const { data: runtimes } = useQuery({ queryKey: ["wizard", "runtimes"], queryFn: fetchActiveRuntimes });
  const tagFor = (rt: AgentRuntime): string | null => {
    const list = rt === "OpenClaw" ? runtimes?.openclaw : runtimes?.hermes;
    return list && list.length ? list[0].primaryTag : null;
  };
  const available: AgentRuntime[] = [
    ...(runtimes?.openclaw?.length ? (["OpenClaw"] as AgentRuntime[]) : []),
    ...(runtimes?.hermes?.length ? (["Hermes"] as AgentRuntime[]) : []),
  ];
  // Pick a template + resolve its engine: locked by origin for community
  // templates, else default to the first available (the user can switch
  // portable PerkOS/Custom templates in the detail view).
  const pickTemplate = (p: AgentPreset) => {
    const rt =
      defaultRuntimeFor(originOf(p)) ??
      (available.includes("OpenClaw") ? "OpenClaw" : available[0] ?? "OpenClaw");
    onChange({
      personaId: p.id,
      agentName: state.agentName || p.name,
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
    return r;
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
          Change persona
        </button>

        <div className="flex flex-col items-center gap-3">
          <TeammateIdCard
            name={preset.name}
            presetId={preset.id}
            tagline={`Your ${preset.name.toLowerCase()} teammate`}
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
                  aria-label={`View ${ORIGIN_META[origin].label} source on GitHub (opens in new tab)`}
                  className={cn(
                    "inline-flex items-center gap-1 text-xs underline-offset-2 hover:underline",
                    ORIGIN_META[origin].link,
                  )}
                >
                  <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
                  View source on GitHub
                </a>
              </>
            ) : (
              <span className="text-xs text-muted-foreground">Hand-crafted by PerkOS</span>
            )}
          </div>
        ) : null}

        {/* Engine — every template is portable; it defaults to its origin's
            engine (tagged "recommended") but the user can switch to either. */}
        <div className="flex flex-col gap-2">
          <Label className="text-xs text-muted-foreground">Engine</Label>
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
                          recommended
                        </span>
                      ) : null}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{RUNTIME_HINT[rt]}</span>
                  </button>
                );
              })}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="agent-name" className="text-xs text-muted-foreground">
            Agent name
          </Label>
          <Input
            id="agent-name"
            value={state.agentName}
            onChange={(e) => onChange({ agentName: e.target.value })}
            placeholder={preset.name}
            className="h-10"
          />
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
            {showPrompt ? "Hide" : "Show"} system prompt
            {state.systemPromptOverride &&
            state.systemPromptOverride !== defaultPrompt ? (
              <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] text-primary">
                edited
              </span>
            ) : null}
          </button>
          {showPrompt ? (
            <>
              <Label htmlFor="system-prompt" className="sr-only">
                System prompt
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Becomes SOUL.md / IDENTITY.md inside the runtime container.
              </p>
              <Textarea
                id="system-prompt"
                value={state.systemPromptOverride || defaultPrompt}
                onChange={(e) => onChange({ systemPromptOverride: e.target.value })}
                rows={5}
                className="font-mono text-xs"
                placeholder="You are a …"
              />
              {state.systemPromptOverride &&
              state.systemPromptOverride !== defaultPrompt ? (
                <button
                  type="button"
                  className="self-start text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                  onClick={() => onChange({ systemPromptOverride: "" })}
                >
                  Reset to the {preset.name} default
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
              Advanced — {showAdvanced ? "hide" : "view"} full soul
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
        title="Pick your Agent"
        description="Choose the agent you want to work with — from PerkOS, the OpenClaw and Hermes communities, or build your own. Each is editable later."
      />

      {/* Filter by origin + search. */}
      <div className="flex flex-col gap-2">
        <div role="radiogroup" aria-label="Filter agents by origin" className="flex flex-wrap gap-1.5">
          {(["all", ...FILTERS] as const).map((f) => {
            const label = f === "all" ? "All" : ORIGIN_META[f].label;
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
            Search agents
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
            placeholder="Search agents…"
            className="h-9 pl-9 pr-9"
          />
          {search ? (
            <button
              type="button"
              aria-label="Clear search"
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
            No agents match {search ? `“${search}”` : "this filter"}.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setFilter("all");
            }}
            className="rounded-md border border-border px-3 py-1.5 text-xs text-foreground transition-colors hover:border-primary/40"
          >
            Show all agents
          </button>
        </div>
      ) : (
        <div
          role="radiogroup"
          aria-label="Choose an agent persona"
          aria-live="polite"
          className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 lg:grid-cols-4"
        >
          {filtered.map((p) => {
            const o = originOf(p);
            const selected = state.personaId === p.id;
            return (
              // Wrapper is the hover group; the source link is a SIBLING overlay
              // (not nested in the radio button — that would be invalid HTML).
              <div key={p.id} className="group relative">
                <button
                  role="radio"
                  aria-checked={selected}
                  type="button"
                  onClick={() => pickTemplate(p)}
                  className={cn(
                    "flex w-full flex-col overflow-hidden rounded-xl border bg-card transition-colors",
                    selected
                      ? "border-primary/60 ring-1 ring-primary/30"
                      : "border-border hover:border-primary/40",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                  )}
                >
                  <div
                    className="grid aspect-square w-full place-items-center"
                    style={{
                      background: `linear-gradient(160deg, hsla(${agentVisual({ presetId: p.id }).hue}, 55%, 18%, 0.35) 0%, hsla(${agentVisual({ presetId: p.id }).hue}, 40%, 10%, 0.12) 100%)`,
                    }}
                  >
                    <AgentOrb name={p.name} presetId={p.id} size={64} />
                  </div>
                  <div className="flex w-full items-center gap-1 px-2 pb-2 pt-1">
                    <OriginBadge origin={o} />
                    <span className="min-w-0 flex-1 truncate text-right text-xs font-medium text-foreground">
                      {p.name}
                    </span>
                  </div>
                </button>
                {p.sourceUrl ? (
                  <a
                    href={p.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`View ${ORIGIN_META[o].label} source on GitHub (opens in new tab)`}
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
