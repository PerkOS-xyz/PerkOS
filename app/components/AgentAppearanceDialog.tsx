"use client";

import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AGENT_AVATAR_ARCHETYPES, isAgentAppearance, type AgentAppearance, type RegisteredAgentAppearance } from "../lib/agentAvatarIdentity";
import { AgentOrb } from "./AgentOrb";

const RASTER_TYPES = ["image/png", "image/jpeg", "image/webp"];

async function readAvatar(file: File): Promise<string> {
  if (!RASTER_TYPES.includes(file.type) || file.size > 5 * 1024 * 1024) throw new Error("Invalid image");
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 96;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Image decoder unavailable");
    const edge = Math.min(bitmap.width, bitmap.height);
    context.fillStyle = "#171221";
    context.fillRect(0, 0, 96, 96);
    context.drawImage(bitmap, (bitmap.width - edge) / 2, (bitmap.height - edge) / 2, edge, edge, 0, 0, 96, 96);
    const jpeg = canvas.toDataURL("image/jpeg", 0.76);
    if (!isAgentAppearance(jpeg)) throw new Error("Invalid image");
    return jpeg;
  } finally {
    bitmap.close();
  }
}

export function AgentAppearanceDialog({ agent, open, onOpenChange, onSave }: {
  agent: RegisteredAgentAppearance;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (appearance: AgentAppearance) => Promise<void>;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [draft, setDraft] = useState<AgentAppearance>(agent.avatarAppearance ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!busy) onOpenChange(next); }}>
      <DialogContent className="max-h-[85dvh] w-[calc(100%-2rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("agentAppearance.title")}</DialogTitle>
          <DialogDescription>{t("agentAppearance.description")}</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-4 rounded-xl border border-border bg-muted/30 p-3">
          <AgentOrb name={agent.name} agent={{ ...agent, avatarAppearance: draft }} size={64} />
          <p className="min-w-0 break-words font-medium [overflow-wrap:anywhere]">{agent.displayName || agent.name}</p>
        </div>
        <div className="space-y-2">
          <label htmlFor={id} className="text-sm font-medium">{t("agentAppearance.style")}</label>
          <select
            id={id}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring"
            disabled={busy}
            value={typeof draft === "string" ? "photo" : String(draft ?? "")}
            onChange={(event) => { setDraft(event.target.value ? Number(event.target.value) : null); setError(""); }}
          >
            <option value="">{t("agentAppearance.default")}</option>
            {typeof draft === "string" && <option value="photo">{t("agentAppearance.photo")}</option>}
            {AGENT_AVATAR_ARCHETYPES.map((item) => <option key={item.id} value={item.id}>#{item.id} · {item.label}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`${id}-upload`} className="text-sm font-medium">{t("agentAppearance.upload")}</label>
          <input
            id={`${id}-upload`}
            type="file"
            accept={RASTER_TYPES.join(",")}
            aria-describedby={`${id}-help`}
            disabled={busy}
            className="block w-full min-w-0 text-xs text-muted-foreground file:mr-2 file:rounded-md file:border file:border-border file:bg-muted file:px-2 file:py-2 file:text-foreground"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              setError(""); setBusy(true);
              try { setDraft(await readAvatar(file)); }
              catch { setError(t("agentAppearance.invalidPhoto")); }
              finally { setBusy(false); }
            }}
          />
          <p id={`${id}-help`} className="text-xs text-muted-foreground">{t("agentAppearance.uploadHelp")}</p>
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>{t("agentAppearance.cancel")}</Button>
          <Button type="button" disabled={busy || draft === (agent.avatarAppearance ?? null)} onClick={async () => {
            setError(""); setBusy(true);
            try { await onSave(draft); onOpenChange(false); }
            catch { setError(t("agentAppearance.saveError")); }
            finally { setBusy(false); }
          }}>{busy ? t("agentAppearance.working") : t("agentAppearance.save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
