import { AgentOrb } from "@/app/components/AgentOrb";
import { agentVisual } from "@/app/lib/agentVisuals";

/** "Teammate ID card" — the wizard hero: a credential, not a robot portrait. */
export function TeammateIdCard({
  name,
  presetId,
  tagline,
}: {
  name: string;
  presetId: string;
  tagline: string;
}) {
  const { hue } = agentVisual({ presetId, name });
  return (
    <div
      className="flex h-60 w-60 flex-col items-center justify-center gap-3 rounded-2xl border"
      style={{
        background: `linear-gradient(160deg, hsla(${hue}, 60%, 20%, 0.35) 0%, hsla(${hue}, 40%, 10%, 0.15) 100%)`,
        borderColor: `hsla(${hue}, 60%, 50%, 0.25)`,
      }}
    >
      <AgentOrb name={name} presetId={presetId} size={96} />
      <span
        className="text-[11px] font-semibold uppercase tracking-widest"
        style={{ color: `hsla(${hue}, 80%, 75%, 0.95)` }}
      >
        {name}
      </span>
      <span className="px-6 text-center text-[11px] text-muted-foreground">
        {tagline}
      </span>
    </div>
  );
}
