"use client";

// ============================================================================
// TornadoRing — the reference's signature 3D move: image cards arranged on a
// cylinder that spins a full 360° tied to scroll ("tornado"). Pure CSS 3D
// (perspective + preserve-3d + rotateY per card); the ring's rotation is a
// scroll-linked motion value, so the wheel drives the spin directly.
//
// Decorative only (aria-hidden, no text). Tiles are fal.ai-generated 3D-render
// art. Sits as its own band — the first block that covers the pinned hero.
// ============================================================================

import Image from "next/image";
import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";

import { useMounted } from "./useMounted";

const TILES = [
  "/hero/tile-1.png",
  "/hero/tile-2.png",
  "/hero/tile-3.png",
  "/hero/tile-1.png",
  "/hero/tile-2.png",
  "/hero/tile-3.png",
];
const RADIUS = 360;

export function TornadoRing() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const rotateY = useTransform(scrollYProgress, [0, 1], [20, 380]);
  const ringScale = useTransform(scrollYProgress, [0, 0.35], [0.82, 1]);
  const mounted = useMounted();

  return (
    <section
      ref={ref}
      aria-hidden
      className="relative overflow-hidden rounded-t-[3rem] border-t border-white/[0.07] bg-background py-24 shadow-[0_-40px_120px_-24px_rgba(0,0,0,0.9)] md:py-32"
    >
      {/* floor glow */}
      <div
        className="brand-blob pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[720px] -translate-x-1/2 -translate-y-1/3 opacity-30"
      />
      <div
        className="mx-auto flex h-[380px] items-center justify-center md:h-[480px]"
        style={{ perspective: 1300 }}
      >
        {mounted ? (
          <motion.div
            className="relative h-[280px] w-[200px] md:h-[360px] md:w-[250px]"
            style={{
              rotateY,
              rotateX: -8,
              scale: ringScale,
              transformStyle: "preserve-3d",
              willChange: "transform",
            }}
          >
            {TILES.map((src, i) => (
              <div
                key={i}
                className="absolute inset-0 overflow-hidden rounded-2xl border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.55)]"
                style={{
                  transform: `rotateY(${(i * 360) / TILES.length}deg) translateZ(${RADIUS}px) translateY(${(i % 2) * 26 - 13}px)`,
                }}
              >
                <Image
                  src={src}
                  alt=""
                  fill
                  loading="eager"
                  sizes="250px"
                  className="object-cover"
                />
                {/* subtle scrim so edges read against the dark bg */}
                <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/5" />
              </div>
            ))}
          </motion.div>
        ) : (
          <div className="h-[280px] w-[200px] md:h-[360px] md:w-[250px]" />
        )}
      </div>
    </section>
  );
}
