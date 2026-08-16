"use client";

import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

import { SPEECH_VOICES, updateAgent, type AgentRow, type SpeechVoice } from "../lib/perkosApi";

const SPEECH_VOICE_LABELS: Record<SpeechVoice, string> = {
  alloy: "Alloy — balanced", ash: "Ash — clear", ballad: "Ballad — expressive",
  coral: "Coral — warm", echo: "Echo — steady", fable: "Fable — narrative",
  onyx: "Onyx — deep", nova: "Nova — bright", sage: "Sage — calm",
  shimmer: "Shimmer — light", verse: "Verse — dynamic", marin: "Marin — natural",
  cedar: "Cedar — grounded",
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent: AgentRow;
  walletAddress: string;
};

export function EditAgentDialog({
  open,
  onOpenChange,
  agent,
  walletAddress,
}: Props) {
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState(agent.displayName ?? agent.name);
  const [plugins, setPlugins] = useState<string[]>(agent.plugins ?? []);
  const [speechVoice, setSpeechVoice] = useState<SpeechVoice>(agent.speechVoice ?? "alloy");
  const [pluginInput, setPluginInput] = useState("");
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    if (open) {
      setDisplayName(agent.displayName ?? agent.name);
      setPlugins(agent.plugins ?? []);
      setSpeechVoice(agent.speechVoice ?? "alloy");
      setPluginInput("");
      setAttempted(false);
    }
  }, [open, agent.displayName, agent.name, agent.plugins, agent.speechVoice]);

  const nameError =
    displayName.trim().length < 2 ? "Display name must be at least 2 characters." : null;

  const dirty = useMemo(() => {
    if (displayName.trim() !== (agent.displayName ?? agent.name)) return true;
    if (speechVoice !== (agent.speechVoice ?? "alloy")) return true;
    const a = [...(agent.plugins ?? [])].sort().join(",");
    const b = [...plugins].sort().join(",");
    return a !== b;
  }, [displayName, plugins, speechVoice, agent.displayName, agent.name, agent.plugins, agent.speechVoice]);

  const mutation = useMutation({
    mutationFn: () =>
      updateAgent({
        walletAddress,
        agentId: agent.id,
        patch: { displayName: displayName.trim(), plugins, speechVoice },
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: ["wallet-agents", walletAddress],
      });
      toast.success(
        result.applied ? "Agent updated" : "Agent profile saved",
        result.applyError
          ? { description: `Runtime update will retry on the next restart: ${result.applyError}` }
          : undefined,
      );
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast.error("Couldn't update agent", { description: err.message });
    },
  });

  function addPlugin() {
    const trimmed = pluginInput.trim();
    if (!trimmed) return;
    if (plugins.includes(trimmed)) {
      setPluginInput("");
      return;
    }
    setPlugins([...plugins, trimmed]);
    setPluginInput("");
  }

  function removePlugin(value: string) {
    setPlugins(plugins.filter((p) => p !== value));
  }

  function onPluginKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addPlugin();
    }
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAttempted(true);
    if (nameError || !dirty || mutation.isPending) return;
    mutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit agent</DialogTitle>
          <DialogDescription>
            Change the user-facing label or capabilities. The immutable runtime
            identity remains <span className="font-mono">{agent.name}</span>.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-agent-name">Display name</Label>
            <Input
              id="edit-agent-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              aria-invalid={attempted && Boolean(nameError)}
            />
            {attempted && nameError ? (
              <p className="text-xs text-destructive">{nameError}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-agent-speech-voice">Spoken audio voice</Label>
            <select
              id="edit-agent-speech-voice"
              value={speechVoice}
              onChange={(event) => setSpeechVoice(event.target.value as SpeechVoice)}
              className="h-10 rounded-md border border-input bg-card px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            >
              {SPEECH_VOICES.map((voice) => (
                <option key={voice} value={voice}>{SPEECH_VOICE_LABELS[voice]}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Used for synthesized speech in the next voice call. This does not change the agent&apos;s written personality.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-agent-plugin">Capabilities</Label>
            <div className="flex items-center gap-2 rounded-md border border-input bg-card px-3 py-2 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
              <Input
                id="edit-agent-plugin"
                value={pluginInput}
                onChange={(e) => setPluginInput(e.target.value)}
                onKeyDown={onPluginKey}
                onBlur={addPlugin}
                placeholder="e.g. web-search"
                className="border-0 bg-transparent p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={addPlugin}
                disabled={pluginInput.trim().length === 0}
                className="h-7 w-7 shrink-0 rounded-md text-muted-foreground hover:text-primary"
                aria-label="Add capability"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {plugins.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {plugins.map((p) => (
                  <Badge
                    key={p}
                    variant="secondary"
                    className="gap-1 border-border bg-muted"
                  >
                    {p}
                    <button
                      type="button"
                      onClick={() => removePlugin(p)}
                      className="opacity-70 hover:opacity-100"
                      aria-label={`Remove ${p}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!dirty || mutation.isPending || Boolean(nameError)}
              className="gap-2"
            >
              {mutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
