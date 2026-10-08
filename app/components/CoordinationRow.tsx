"use client";

/**
 * One line of the project's coordination story inside the conversation:
 * Sparky (PerkOS coordination) handing work to a teammate, a teammate's
 * result, or a short system note. Chat messages keep their own row.
 */

import Image from "next/image";
import Link from "next/link";
import { useId, useState } from "react";
import { ArrowUpRight, CheckCircle2, CircleAlert, FileText } from "lucide-react";

import { cn } from "@/lib/utils";

import { deriveAgentAvatarIdentity } from "../lib/agentAvatarIdentity";
import type { CoordinationMessage } from "../lib/useCoordinationLog";
import { AgentOrb } from "./AgentOrb";
import { useAgentHue, useAgentLabel } from "./ProjectAgentIdentity";
import { Markdown } from "./Markdown";

function agentName(identity: string): string {
  return identity.replace(/^agent:/, "");
}

/** The agent's own avatar hue, so its name and bubble match its orb. */
export function agentHue(name: string, alpha = 1): string {
  const { accentHue } = deriveAgentAvatarIdentity(name);
  return `hsl(${accentHue} 80% 66% / ${alpha})`;
}

/** Longer than this, an assignment shows its first lines and folds the rest. */
const BRIEF_PREVIEW_CHARS = 220;

/**
 * Sparky's goal or assignment: the task and the first lines of its brief, with
 * the full brief one tap away, so a few assignments don't bury the
 * conversation.
 */
function BriefText({ text }: { text: string }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const long = text.length > BRIEF_PREVIEW_CHARS;
  return (
    <>
      <div
        id={id}
        className={cn(long && !open && "max-h-[4.75rem] overflow-hidden [mask-image:linear-gradient(to_bottom,#000_55%,transparent)]")}
      >
        <Markdown>{text}</Markdown>
      </div>
      {long ? (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((v) => !v)}
          className="mt-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
        >
          {open ? "Show less" : "Show the full brief"}
        </button>
      ) : null}
    </>
  );
}

function Time({ iso }: { iso: string }) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return (
    <time dateTime={iso} className="shrink-0 font-mono text-[10px] text-muted-foreground/70">
      {d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
    </time>
  );
}

function SparkyFace({ dim = false }: { dim?: boolean }) {
  return (
    <Image
      src="/runtime/sparky-head.webp"
      alt=""
      width={28}
      height={28}
      className={cn("h-7 w-7 shrink-0 rounded-full object-cover", dim && "opacity-80")}
    />
  );
}

export function CoordinationRow({
  message,
  taskHref,
}: {
  message: CoordinationMessage;
  taskHref?: (taskId: string) => string;
}) {
  const { kind, to, taskId, ok } = message.coordination;
  const hue = useAgentHue();
  const label = useAgentLabel();

  if (kind === "system") {
    return (
      <div
        className={cn(
          "flex items-center gap-2 py-0.5 text-[11px]",
          ok === false ? "text-amber-300/90" : "text-muted-foreground",
        )}
      >
        <span className="h-px flex-1 bg-border" />
        {ok === false ? <CircleAlert className="h-3 w-3 shrink-0" /> : <CheckCircle2 className="h-3 w-3 shrink-0" />}
        <span className="max-w-[80%] text-center">{message.text}</span>
        <Time iso={message.timestamp} />
        <span className="h-px flex-1 bg-border" />
      </div>
    );
  }

  if (message.from.startsWith("agent:")) {
    const name = agentName(message.from);
    return (
      <div className="mr-6 flex gap-2.5" data-agent={name}>
        <AgentOrb name={name} size={28} />
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center gap-2 text-xs">
            <span className="truncate font-medium" style={{ color: hue(name) }} title={name}>{label(name)}</span>
            <Time iso={message.timestamp} />
          </div>
          <div
            className="rounded-2xl rounded-tl-md px-3.5 py-2.5 text-sm leading-relaxed text-foreground/90"
            style={{ background: hue(name, 0.08), boxShadow: `inset 0 0 0 1px ${hue(name, 0.22)}` }}
          >
            <div className={cn(kind === "result" && "line-clamp-6")}>
              <Markdown>{message.text}</Markdown>
            </div>
            {kind === "result" && taskId && taskHref ? (
              <Link
                href={taskHref(taskId)}
                className="mt-2 flex w-fit items-center gap-1.5 rounded-lg border border-border bg-background/60 px-2.5 py-1.5 text-xs text-foreground hover:border-primary/40"
              >
                <FileText className="h-3.5 w-3.5 text-primary" />
                Open the result
                <ArrowUpRight className="h-3 w-3 text-muted-foreground" />
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  // Sparky (or PerkOS) speaking to a teammate: the goal or an assignment.
  const target = to.startsWith("agent:") ? agentName(to) : null;
  return (
    <div className="mr-6 flex gap-2.5" data-agent={target ?? undefined}>
      <SparkyFace dim={Boolean(target)} />
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="font-medium">Sparky</span>
          {target ? (
            <>
              <ArrowUpRight className="h-3 w-3 text-muted-foreground" />
              <span
                className="max-w-[14rem] truncate rounded-full px-1.5 py-0.5 text-[11px] font-medium"
                style={{ color: hue(target), background: hue(target, 0.12) }}
              >
                @{label(target)}
              </span>
            </>
          ) : null}
          <Time iso={message.timestamp} />
        </div>
        <div
          className="rounded-2xl rounded-tl-md border border-dashed px-3.5 py-2.5 text-sm leading-relaxed text-foreground/80"
          style={target ? { borderColor: hue(target, 0.35) } : undefined}
        >
          <BriefText text={message.text} />
        </div>
      </div>
    </div>
  );
}
