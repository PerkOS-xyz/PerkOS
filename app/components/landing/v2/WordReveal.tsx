"use client";

// ============================================================================
// WordReveal — scrubbed word-by-word "reading reveal" (Die Antwoord's kinetic
// type, tamed): the translated string is split on spaces at runtime and each
// word's opacity rises in sequence as the block scrolls in — reversible.
// Zero i18n changes. Languages without spaces (ja/zh) fall back to revealing
// the whole block at once (single "word").
// ============================================================================

import { motion, useTransform } from "motion/react";
import { useRef } from "react";

import { useScrubProgress } from "./Scrub";
import { useMounted } from "./useMounted";

export function WordReveal({
  text,
  className,
  as: Tag = "p",
}: {
  text: string;
  className?: string;
  as?: "h2" | "p" | "span";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const progress = useScrubProgress(ref);
  const mounted = useMounted();

  const words = text.includes(" ") ? text.split(/\s+/) : [text];

  return (
    <div ref={ref}>
      <Tag className={className}>
        {mounted
          ? words.map((w, i) => (
              <Word key={i} progress={progress} index={i} total={words.length} word={w} />
            ))
          : text}
      </Tag>
    </div>
  );
}

function Word({
  progress,
  index,
  total,
  word,
}: {
  progress: ReturnType<typeof useScrubProgress>;
  index: number;
  total: number;
  word: string;
}) {
  // Each word owns a slice of the progress; slight overlap keeps it fluid.
  const start = (index / total) * 0.75;
  const end = Math.min(start + 0.25, 1);
  const opacity = useTransform(progress, [start, end], [0.12, 1]);

  return (
    <motion.span style={{ opacity }} className="inline">
      {word}{" "}
    </motion.span>
  );
}
