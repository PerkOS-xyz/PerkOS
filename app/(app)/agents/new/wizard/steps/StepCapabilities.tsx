"use client";

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Layers,
  Check,
  Plus,
  GitFork,
  ExternalLink,
  ShieldAlert,
  ShieldCheck,
  Search,
  SquareTerminal,
  AppWindow,
  Brain,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { findPreset } from "@/app/lib/agentPresets";
import {
  SKILLS_CATALOG,
  findSkillPack,
  parseUserRepo,
  runtimeCompatLabel,
  type SkillPack,
} from "@/app/lib/skillsCatalog";

import type { StepProps } from "../types";
import { StepHeader } from "../ui/StepHeader";

// Built-in tools BOTH runtimes ship with, on by default. These are now REAL
// toggles: turning one off sends its id in the launch payload's `disabledTools`,
// and each runtime entrypoint translates it to that runtime's native disable —
// OpenClaw `tools.deny`, Hermes a custom toolset bundle. The ids here are the
// contract; they must match CAPABILITY_IDS in PerkOS-API provision.ts + the
// case arms in both docker-entrypoint.sh scripts. Labels/descriptions are
// resolved via i18n keyed by id (wizard.capabilities.tools.<id>.*).
const BUILT_IN_TOOLS: {
  id: string;
  icon: LucideIcon;
}[] = [
  { id: "web-search", icon: Search },
  { id: "code-execution", icon: SquareTerminal },
  { id: "browser", icon: AppWindow },
  { id: "memory", icon: Brain },
];

// A small on/off switch (no Switch primitive in the design system yet — this
// mirrors the clickable-toggle pattern GatewayCard already uses).
function ToolSwitch({
  enabled,
  onToggle,
  label,
}: {
  enabled: boolean;
  onToggle: (next: boolean) => void;
  label: string;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={t("wizard.capabilities.toolSwitchAria", {
        label,
        state: enabled ? t("wizard.capabilities.on") : t("wizard.capabilities.off"),
      })}
      onClick={() => onToggle(!enabled)}
      className={cn(
        "relative h-5 w-9 shrink-0 rounded-full transition-colors",
        enabled ? "bg-primary" : "bg-muted",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-4 w-4 rounded-full bg-background shadow transition-transform",
          enabled ? "translate-x-4" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

export function StepCapabilities({ state, onChange }: StepProps) {
  const { t } = useTranslation();
  const preset = findPreset(state.personaId);

  const toggleSkill = (id: string) => {
    const next = state.skills.includes(id)
      ? state.skills.filter((s) => s !== id)
      : [...state.skills, id];
    onChange({ skills: next });
  };

  const disabled = new Set(state.disabledTools);
  const setToolEnabled = (id: string, enabled: boolean) => {
    const next = enabled
      ? state.disabledTools.filter((tid) => tid !== id)
      : state.disabledTools.includes(id)
        ? state.disabledTools
        : [...state.disabledTools, id];
    onChange({ disabledTools: next });
  };
  const anyDisabled = state.disabledTools.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <StepHeader
        title={t("wizard.capabilities.title")}
        description={t("wizard.capabilities.description")}
      />

      {/* Built-in tools — real per-tool toggles. On by default; turning one off
          sends its id in disabledTools, which each runtime entrypoint maps to
          its native disable (OpenClaw tools.deny / Hermes custom toolset). */}
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card/50 p-4">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-medium text-foreground">{t("wizard.capabilities.builtInTools")}</h3>
          <Badge variant="secondary" className="text-[10px]">
            Hermes + OpenClaw
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          {t("wizard.capabilities.builtInHelp")}
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {BUILT_IN_TOOLS.map((tool) => {
            const enabled = !disabled.has(tool.id);
            const Icon = tool.icon;
            const label = t(`wizard.capabilities.tools.${tool.id}.label`);
            return (
              <div
                key={tool.id}
                className={cn(
                  "flex items-center gap-3 rounded-md border p-3 transition-colors",
                  enabled
                    ? "border-border bg-card"
                    : "border-dashed border-border bg-muted/30",
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0",
                    enabled ? "text-primary" : "text-muted-foreground",
                  )}
                />
                <div className="flex flex-1 flex-col">
                  <span
                    className={cn(
                      "text-sm",
                      enabled ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t(`wizard.capabilities.tools.${tool.id}.description`)}
                  </span>
                </div>
                <ToolSwitch
                  enabled={enabled}
                  onToggle={(v) => setToolEnabled(tool.id, v)}
                  label={label}
                />
              </div>
            );
          })}
        </div>
        {anyDisabled ? (
          <p className="text-[11px] text-muted-foreground">
            {t("wizard.capabilities.turnedOffLabel")}{" "}
            <span className="text-foreground">
              {state.disabledTools
                .map((id) => {
                  const tool = BUILT_IN_TOOLS.find((bt) => bt.id === id);
                  return tool ? t(`wizard.capabilities.tools.${id}.label`) : id;
                })
                .join(", ")}
            </span>
            {t("wizard.capabilities.turnedOffEffect")}
          </p>
        ) : null}
      </div>

      <OpenSourceSkills
        state={state}
        onChange={onChange}
        recommendedSkillIds={preset?.recommendedSkills ?? []}
        toggleSkill={toggleSkill}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// OpenSourceSkills — markdown SKILL.md packs from public GitHub repos. Each
// card links to its source so the user can inspect what gets injected into
// the agent's instructions. Recommended packs (from the preset) surface
// first; community packs the user pastes get an "Unverified" warning.
// ---------------------------------------------------------------------------

function OpenSourceSkills({
  state,
  onChange,
  recommendedSkillIds,
  toggleSkill,
}: StepProps & {
  recommendedSkillIds: string[];
  toggleSkill: (id: string) => void;
}) {
  const { t } = useTranslation();
  const [repoInput, setRepoInput] = useState("");
  const [repoError, setRepoError] = useState<string | null>(null);

  const packs = useMemo(() => {
    const byId = new Map<string, SkillPack>();
    for (const p of SKILLS_CATALOG) byId.set(p.id, p);
    for (const p of state.communitySkills) byId.set(p.id, p);
    const all = Array.from(byId.values());
    const rec = new Set(recommendedSkillIds);
    return all.sort((a, b) => {
      const ra = rec.has(a.id) ? 0 : 1;
      const rb = rec.has(b.id) ? 0 : 1;
      return ra - rb;
    });
  }, [state.communitySkills, recommendedSkillIds]);

  const recommended = useMemo(
    () => new Set(recommendedSkillIds),
    [recommendedSkillIds],
  );

  const addRepo = () => {
    const pack = parseUserRepo(repoInput);
    if (!pack) {
      setRepoError(t("wizard.capabilities.repoError"));
      return;
    }
    setRepoError(null);
    setRepoInput("");
    if (!state.communitySkills.some((p) => p.id === pack.id) && !findSkillPack(pack.id)) {
      onChange({ communitySkills: [...state.communitySkills, pack] });
    }
    if (!state.skills.includes(pack.id)) {
      onChange({ skills: [...state.skills, pack.id] });
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-medium text-foreground">{t("wizard.capabilities.openSourceTitle")}</h3>
        <p className="text-xs text-muted-foreground">
          {t("wizard.capabilities.openSourceHelp")}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {packs.map((pack) => {
          const active = state.skills.includes(pack.id);
          const isRecommended = recommended.has(pack.id);
          return (
            <div
              key={pack.id}
              className={cn(
                "flex flex-col gap-2 rounded-lg border p-3 transition-colors",
                active
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card hover:border-primary/40",
              )}
            >
              <button
                type="button"
                onClick={() => toggleSkill(pack.id)}
                className="flex items-start justify-between gap-3 text-left"
              >
                <div className="flex flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-medium text-foreground">{pack.name}</span>
                    {isRecommended ? (
                      <Badge
                        variant="secondary"
                        className="border-primary/30 bg-primary/10 text-primary"
                      >
                        {t("wizard.capabilities.recommended")}
                      </Badge>
                    ) : null}
                  </div>
                  <span className="text-xs text-muted-foreground">{pack.description}</span>
                </div>
                {active ? (
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                ) : (
                  <Plus className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                )}
              </button>

              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="secondary" className="text-[10px]">
                  {runtimeCompatLabel(pack.runtimeCompat)}
                </Badge>
                {pack.trust === "community" ? (
                  <Badge
                    variant="secondary"
                    className="gap-1 border-amber-500/40 bg-amber-500/15 text-amber-300"
                  >
                    <ShieldAlert className="h-3 w-3" />
                    {t("wizard.capabilities.unverified")}
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1 text-muted-foreground">
                    <ShieldCheck className="h-3 w-3" />
                    {t("wizard.capabilities.openSource")}
                  </Badge>
                )}
                <span className="text-[11px] text-muted-foreground">
                  {t("wizard.capabilities.byAuthor", { author: pack.author })}
                </span>
                <a
                  href={pack.githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="ml-auto inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                >
                  <GitFork className="h-3.5 w-3.5" />
                  {t("wizard.capabilities.inspect")}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-1.5 rounded-lg border border-dashed border-border p-3">
        <Label htmlFor="skill-repo" className="text-xs text-muted-foreground">
          {t("wizard.capabilities.addGithubSkill")}
        </Label>
        <div className="flex gap-2">
          <Input
            id="skill-repo"
            value={repoInput}
            onChange={(e) => {
              setRepoInput(e.target.value);
              if (repoError) setRepoError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addRepo();
              }
            }}
            placeholder="https://github.com/owner/repo/blob/main/path/SKILL.md"
            className="font-mono text-xs"
            aria-invalid={Boolean(repoError)}
            aria-describedby={repoError ? "skill-repo-error" : undefined}
          />
          <Button type="button" variant="outline" onClick={addRepo}>
            <Plus className="mr-1 h-4 w-4" />
            {t("wizard.capabilities.add")}
          </Button>
        </div>
        {repoError ? (
          <p id="skill-repo-error" className="text-xs text-destructive">
            {repoError}
          </p>
        ) : null}
      </div>
    </div>
  );
}
