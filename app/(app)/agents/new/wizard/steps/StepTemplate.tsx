"use client";

import { useState } from "react";
import { ArrowLeft, ChevronDown, ChevronUp } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { AgentOrb } from "@/app/components/AgentOrb";
import { agentVisual } from "@/app/lib/agentVisuals";
import { findPreset, presetSystemPrompt, type AgentPreset } from "@/app/lib/agentPresets";

import type { StepProps } from "../types";
import { StepHeader } from "../ui/StepHeader";
import { TeammateIdCard } from "../ui/TeammateIdCard";
import { SoulDetailCard } from "../ui/SoulDetailCard";

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
  const defaultPrompt = preset ? presetSystemPrompt(preset, state.agentName) : "";

  if (preset) {
    return (
      <div className="flex flex-col gap-5">
        <button
          type="button"
          onClick={() => {
            setShowAdvanced(false);
            onChange({ personaId: null, systemPromptOverride: "" });
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

        {preset.id !== "custom" ? (
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

  // Picker state — 2 cols mobile / 3 md / 4 lg.
  return (
    <div className="flex flex-col gap-4">
      <StepHeader
        title="Pick your Agent"
        description="Choose the agent you want to work with. Each one ships with a name, a soul, and a recommended skill set — all editable later."
      />

      <div
        role="radiogroup"
        aria-label="Choose an agent persona"
        className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 lg:grid-cols-4"
      >
        {presets.map((p) => (
          <button
            key={p.id}
            role="radio"
            aria-checked={false}
            type="button"
            onClick={() =>
              onChange({
                personaId: p.id,
                agentName: state.agentName || p.name,
                systemPromptOverride: "",
              })
            }
            className={cn(
              "group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors",
              "hover:border-primary/40",
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
            <span className="w-full truncate px-2 py-1.5 text-center text-xs font-medium text-foreground">
              {p.name}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
