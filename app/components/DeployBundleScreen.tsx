"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Check,
  Copy,
  Download,
  FileCode,
  Loader2,
  Server,
  Terminal,
  Wifi,
  WifiOff,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import { fetchAgent, type DeployBundle } from "../lib/perkosApi";

type Tab = "compose" | "env" | "docker-run" | "instructions";

type Props = {
  bundle: DeployBundle;
  agentId: string;
  agentName: string;
  /** Self-hosted = full stack; imported = bridge-only. Used only for copy. */
  deployMode: "self-hosted" | "imported";
  /** Shown once, just like the legacy key-reveal dialog, in a "secret" card. */
  relayApiKey: string;
  onDone: () => void;
};

/**
 * Post-launch screen for BYO deploys (self-hosted / imported).
 *
 * Three concerns:
 *
 *   1. **Show the bundle**. Tabs for docker-compose, .env, one-liner
 *      `docker run`, and the README. Each tab has a "Copy" button and
 *      the whole bundle is downloadable as a .zip — built client-side
 *      with a vanilla data: URL so we don't pull in a zip lib.
 *
 *   2. **Pole agent until the bridge phones home**. Hits GET /agents/<id>
 *      every 5s. Flips a "Waiting for first ping…" card to "Online ✓"
 *      when `bridgeConnected: true` lands. Times out at 10 min with a
 *      "couldn't reach the bridge" hint.
 *
 *   3. **Refuse to dismiss without an explicit click**. The relayApiKey
 *      is baked into .env and shown nowhere else — once the screen
 *      closes, it's gone from the browser.
 */
export function DeployBundleScreen({
  bundle,
  agentId,
  agentName,
  deployMode,
  relayApiKey,
  onDone,
}: Props) {
  const [tab, setTab] = useState<Tab>("compose");
  const [copied, setCopied] = useState<null | Tab | "key">(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [connected, setConnected] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [pollCount, setPollCount] = useState(0);
  // pollEpoch lets the "Try again" button restart the polling effect
  // without re-mounting. Bumping it cancels any in-flight tick and
  // resets the timeout clock inside the effect.
  const [pollEpoch, setPollEpoch] = useState(0);

  // Poll /agents/<id> every 5s until bridgeConnected flips true, OR we
  // hit the 10-minute timeout. The wizard surfaces both states; the
  // user can still close the screen at any point — polling stops on
  // unmount.
  useEffect(() => {
    let cancelled = false;
    const POLL_MS = 5_000;
    const TIMEOUT_MS = 10 * 60 * 1000;
    const startTs = Date.now();

    const tick = async () => {
      if (cancelled) return;
      if (Date.now() - startTs >= TIMEOUT_MS) {
        setTimedOut(true);
        return;
      }
      try {
        const agent = await fetchAgent(agentId);
        if (cancelled) return;
        setPollCount((c) => c + 1);
        if (agent.bridgeConnected) {
          setConnected(true);
          return;
        }
      } catch {
        // ignore transient errors; keep polling
      }
      window.setTimeout(tick, POLL_MS);
    };

    void tick();
    return () => {
      cancelled = true;
    };
  }, [agentId, pollEpoch]);

  const copyText = useCallback(async (text: string, kind: Tab | "key") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      // Clipboard blocked — operator can select manually.
    }
  }, []);

  const downloadBundle = useCallback(() => {
    // Bundle as a plain text README + the two files concatenated; not
    // a real .zip (the browser zip APIs are heavy and we don't need
    // archive compression for ~3 small text files). The user gets a
    // multipart text bundle they can split on the markers.
    const contents = [
      `# perkos-${agentName} deploy bundle\n`,
      `# generated for agentId ${agentId}\n\n`,
      `# ---- compose.yml ----\n`,
      bundle.composeYaml,
      `\n# ---- .env ----\n`,
      bundle.envFile,
      bundle.dockerRunCommand
        ? `\n# ---- docker run (one-liner) ----\n${bundle.dockerRunCommand}\n`
        : "",
      `\n# ---- INSTRUCTIONS.md ----\n`,
      bundle.instructions,
    ].join("");
    const blob = new Blob([contents], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `perkos-${agentName}-bundle.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [agentId, agentName, bundle]);

  const tabContent =
    tab === "compose"
      ? bundle.composeYaml
      : tab === "env"
        ? bundle.envFile
        : tab === "docker-run"
          ? bundle.dockerRunCommand ?? "(no one-liner available for this bundle)"
          : bundle.instructions;

  const dockerRunAvailable = Boolean(bundle.dockerRunCommand);

  return (
    <Dialog open onOpenChange={(o) => !o && acknowledged && onDone()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Server className="h-5 w-5 text-primary" />
            {deployMode === "self-hosted"
              ? "Your agent is ready to deploy"
              : "Add the bridge sidecar"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <Card className="border-dashed">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                Relay API Key (one-shot)
              </CardTitle>
              <CardDescription>
                Baked into the .env below. We never show it again — keep
                the bundle safe.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 p-2 font-mono text-xs">
                <span className="truncate text-foreground">{relayApiKey}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto h-7 gap-1.5"
                  onClick={() => copyText(relayApiKey, "key")}
                >
                  {copied === "key" ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  {copied === "key" ? "Copied" : "Copy"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Tabs */}
          <div className="flex flex-wrap items-center gap-1 rounded-md border border-border bg-muted/30 p-1">
            <TabButton
              active={tab === "compose"}
              onClick={() => setTab("compose")}
              icon={FileCode}
              label="docker-compose"
            />
            <TabButton
              active={tab === "env"}
              onClick={() => setTab("env")}
              icon={FileCode}
              label=".env"
            />
            {dockerRunAvailable ? (
              <TabButton
                active={tab === "docker-run"}
                onClick={() => setTab("docker-run")}
                icon={Terminal}
                label="docker run"
              />
            ) : null}
            <TabButton
              active={tab === "instructions"}
              onClick={() => setTab("instructions")}
              icon={FileCode}
              label="INSTRUCTIONS"
            />
            <div className="ml-auto flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="gap-1.5"
                onClick={() => copyText(tabContent, tab)}
              >
                {copied === tab ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {copied === tab ? "Copied" : "Copy"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="gap-1.5"
                onClick={downloadBundle}
              >
                <Download className="h-3.5 w-3.5" />
                Download bundle
              </Button>
            </div>
          </div>

          <pre
            className={cn(
              "max-h-72 overflow-auto rounded-md border border-border bg-muted/50 p-3 font-mono text-[11px] leading-relaxed text-foreground",
            )}
          >
            {tabContent}
          </pre>

          {/* Waiting-for-first-ping card */}
          <Card
            className={cn(
              connected && "border-emerald-500/40 bg-emerald-500/5",
              timedOut && !connected && "border-amber-500/40 bg-amber-500/5",
            )}
          >
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-3">
                {connected ? (
                  <Wifi className="h-5 w-5 text-emerald-400" />
                ) : timedOut ? (
                  <WifiOff className="h-5 w-5 text-amber-400" />
                ) : (
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                )}
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-foreground">
                    {connected
                      ? "Online — bridge connected"
                      : timedOut
                        ? "Couldn't reach the bridge"
                        : "Waiting for first ping…"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {connected
                      ? "Heartbeat received from your bridge. You can close this window."
                      : timedOut
                        ? "Check the bridge container logs and confirm outbound 443 to chat.perkos.xyz is open."
                        : `Polled ${pollCount} ${pollCount === 1 ? "time" : "times"}. Usually flips within 30s of \`docker compose up -d\`.`}
                  </span>
                </div>
              </div>
              {connected ? (
                <Badge
                  variant="secondary"
                  className="border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                >
                  Online ✓
                </Badge>
              ) : timedOut ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setTimedOut(false);
                    setPollCount(0);
                    setPollEpoch((e) => e + 1);
                  }}
                >
                  Try again
                </Button>
              ) : null}
            </CardContent>
          </Card>

          <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-amber-300">
            <input
              type="checkbox"
              id="ack-bundle"
              className="mt-0.5 h-3.5 w-3.5"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
            />
            <label htmlFor="ack-bundle" className="cursor-pointer">
              I saved the bundle (copied or downloaded). I understand the
              relay API key is shown only here.
            </label>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="default"
              disabled={!acknowledged}
              onClick={onDone}
            >
              Done — take me to the agent
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof FileCode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium transition-colors",
        active
          ? "bg-primary/15 text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
