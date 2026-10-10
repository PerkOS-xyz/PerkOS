"use client";

import { useTranslation } from "react-i18next";
import {
  AppWindow,
  AudioLines,
  Brain,
  GitBranch,
  MapPin,
  MonitorSmartphone,
  MoonStar,
  MousePointerClick,
  Search,
  Sparkles,
  SquareTerminal,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Optional OpenClaw features, off by default so a new agent starts light. Each
// id here is the contract: it must match FEATURE_IDS in PerkOS-API provision.ts
// and the case arms in the OpenClaw docker-entrypoint.sh, which turn on the
// bundled plugins behind it. Labels/descriptions are resolved via i18n keyed by
// id (wizard.capabilities.features.<id>.*). `needs` names what must be on first:
// a built-in tool (`tool:<id>`) or another feature.
export const OPTIONAL_FEATURES: {
  id: string;
  icon: LucideIcon;
  needs?: string;
}[] = [
  { id: "dreaming", icon: MoonStar, needs: "tool:memory" },
  { id: "github", icon: GitBranch },
  { id: "location", icon: MapPin },
  { id: "voice-talk", icon: AudioLines },
  { id: "paired-devices", icon: MonitorSmartphone },
  { id: "computer-use", icon: MousePointerClick, needs: "paired-devices" },
];

// Features with a real effect on a PerkOS-managed agent today, and the only
// ones the App shows. GitHub reader and Approximate location only feed
// OpenClaw's own Control UI, and the device features need a phone or computer
// paired to the gateway, which a PerkOS agent does not expose yet.
export const CLOUD_READY_FEATURES = new Set(["dreaming"]);

// Built-in tools, on by default (the wizard's Capabilities step owns the same
// ids). Must match CAPABILITY_IDS in PerkOS-API provision.ts.
export const BUILT_IN_TOOLS: { id: string; icon: LucideIcon }[] = [
  { id: "web-search", icon: Search },
  { id: "code-execution", icon: SquareTerminal },
  { id: "browser", icon: AppWindow },
  { id: "memory", icon: Brain },
];

export function sameIds(a: readonly string[], b: readonly string[]): boolean {
  return [...a].sort().join(",") === [...b].sort().join(",");
}

function FeatureSwitch({
  enabled,
  disabled,
  onToggle,
  label,
}: {
  enabled: boolean;
  disabled?: boolean;
  onToggle: (next: boolean) => void;
  label: string;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      aria-label={t("wizard.capabilities.toolSwitchAria", {
        label,
        state: enabled ? t("wizard.capabilities.on") : t("wizard.capabilities.off"),
      })}
      onClick={() => onToggle(!enabled)}
      className={cn(
        "relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50",
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

function ToggleRow({
  icon: Icon,
  label,
  description,
  hint,
  enabled,
  locked,
  onToggle,
}: {
  icon: LucideIcon;
  label: string;
  description: string;
  hint?: string;
  enabled: boolean;
  locked?: boolean;
  onToggle: (next: boolean) => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-md border p-3 transition-colors",
        enabled ? "border-border bg-card" : "border-dashed border-border bg-muted/30",
      )}
    >
      <Icon
        className={cn(
          "h-4 w-4 shrink-0",
          enabled ? "text-primary" : "text-muted-foreground",
        )}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className={cn("text-sm", enabled ? "text-foreground" : "text-muted-foreground")}>
          {label}
        </span>
        <span className="text-xs text-muted-foreground">{description}</span>
        {hint ? <span className="text-[11px] text-primary/80">{hint}</span> : null}
      </div>
      <FeatureSwitch enabled={enabled} disabled={locked} onToggle={onToggle} label={label} />
    </div>
  );
}

/** Optional features (OpenClaw). Off by default; the list holds the ids the
 *  wallet turned ON. Turning a feature off also turns off what needs it. */
export function AgentFeatureToggles({
  enabledFeatures,
  disabledTools,
  onChange,
  className,
  compact,
}: {
  enabledFeatures: string[];
  disabledTools: string[];
  onChange: (next: string[]) => void;
  className?: string;
  /** One column, for narrow containers such as a dialog. */
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const on = new Set(enabledFeatures);
  const toolOff = new Set(disabledTools);

  const needsMet = (needs?: string) => {
    if (!needs) return true;
    if (needs.startsWith("tool:")) return !toolOff.has(needs.slice("tool:".length));
    return on.has(needs);
  };
  const needsLabel = (needs: string) =>
    needs.startsWith("tool:")
      ? t(`wizard.capabilities.tools.${needs.slice("tool:".length)}.label`)
      : t(`wizard.capabilities.features.${needs}.label`);

  const setEnabled = (id: string, enabled: boolean) => {
    if (enabled) {
      if (!on.has(id)) onChange([...enabledFeatures, id]);
      return;
    }
    const dependents = new Set(
      OPTIONAL_FEATURES.filter((f) => f.needs === id).map((f) => f.id),
    );
    onChange(enabledFeatures.filter((fid) => fid !== id && !dependents.has(fid)));
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border border-border bg-card/50 p-4",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-medium text-foreground">
          {t("wizard.capabilities.extraFeatures")}
        </h3>
        <Badge variant="secondary" className="text-[10px]">
          OpenClaw
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        {t("wizard.capabilities.extraFeaturesHelp")}
      </p>
      <div className={cn("grid grid-cols-1 gap-2", !compact && "sm:grid-cols-2")}>
        {OPTIONAL_FEATURES.filter((f) => CLOUD_READY_FEATURES.has(f.id)).map((feature) => {
          const met = needsMet(feature.needs);
          const enabled = met && on.has(feature.id);
          return (
            <ToggleRow
              key={feature.id}
              icon={feature.icon}
              label={t(`wizard.capabilities.features.${feature.id}.label`)}
              description={t(`wizard.capabilities.features.${feature.id}.description`)}
              hint={
                !met && feature.needs
                  ? t("wizard.capabilities.needsFeature", { feature: needsLabel(feature.needs) })
                  : undefined
              }
              enabled={enabled}
              locked={!met}
              onToggle={(v) => setEnabled(feature.id, v)}
            />
          );
        })}
      </div>
    </div>
  );
}

/** Built-in tools (both runtimes). On by default; the list holds the ids the
 *  wallet turned OFF. */
export function AgentToolToggles({
  disabledTools,
  onChange,
  className,
  compact,
}: {
  disabledTools: string[];
  onChange: (next: string[]) => void;
  className?: string;
  /** One column, for narrow containers such as a dialog. */
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const off = new Set(disabledTools);
  const setEnabled = (id: string, enabled: boolean) => {
    onChange(
      enabled
        ? disabledTools.filter((tid) => tid !== id)
        : off.has(id)
          ? disabledTools
          : [...disabledTools, id],
    );
  };
  return (
    <div className={cn("grid grid-cols-1 gap-2", !compact && "sm:grid-cols-2", className)}>
      {BUILT_IN_TOOLS.map((tool) => (
        <ToggleRow
          key={tool.id}
          icon={tool.icon}
          label={t(`wizard.capabilities.tools.${tool.id}.label`)}
          description={t(`wizard.capabilities.tools.${tool.id}.description`)}
          enabled={!off.has(tool.id)}
          onToggle={(v) => setEnabled(tool.id, v)}
        />
      ))}
    </div>
  );
}
