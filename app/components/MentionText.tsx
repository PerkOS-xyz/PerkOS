"use client";

import { Fragment } from "react";

import {
  segmentMentions,
  mentionsWallet,
  type MentionParticipant,
} from "../lib/mentions";

/**
 * Render chat text with `@mention` chips. Plain text otherwise. A mention of
 * the current wallet (`meWallet`) is highlighted stronger so you can spot
 * messages aimed at you.
 */
export function MentionText({
  text,
  participants,
  meWallet,
  className,
}: {
  text: string;
  participants: MentionParticipant[];
  meWallet?: string | null;
  className?: string;
}) {
  const segs = segmentMentions(text, participants);
  return (
    <span className={className} style={{ whiteSpace: "pre-wrap" }}>
      {segs.map((s, i) => {
        if (s.type === "text") return <Fragment key={i}>{s.value}</Fragment>;
        const isMe =
          s.participant.kind === "human" &&
          mentionsWallet([s.participant.id], meWallet);
        return (
          <span
            key={i}
            className={
              isMe
                ? "rounded bg-[#ec1b69]/25 px-1 font-medium text-[#ff5c93]"
                : "rounded bg-[#1b1833] px-1 font-medium text-[#a9a4d4]"
            }
            title={s.participant.id}
          >
            @{s.label}
          </span>
        );
      })}
    </span>
  );
}

export { mentionsWallet };
