"use client";

import { useEffect, useRef } from "react";

const COLORS = ["236,27,105", "255,90,106", "255,138,92"];

type Props = {
  className?: string;
  /** How many embers share the area. */
  count?: number;
  /** The largest ember's radius, in CSS pixels. */
  size?: number;
  /** How fast they rise; 1 is the pace Runtime uses behind a desk. */
  speed?: number;
};

type Ember = {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  color: string;
  phase: number;
  twinkle: number;
};

/**
 * Embers rising through an image's space: the ones Runtime keeps behind a desk,
 * a little brighter so they read around a picture, and gathered toward the
 * middle where the picture is. Positions are fractions of the area and speeds
 * are pixels per frame, so a small area and a large one move alike. They fade
 * in low and out high, stop while off screen, and never start for someone who
 * asks for less motion.
 */
export function Embers({ className, count = 40, size = 2.4, speed = 1 }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 1;
    let h = 1;
    const fit = () => {
      w = Math.max(1, canvas.offsetWidth);
      h = Math.max(1, canvas.offsetHeight);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const ember = (y: number): Ember => ({
      x: (Math.random() + Math.random()) / 2,
      y,
      r: 0.3 + Math.random() * Math.max(0, size - 0.3),
      vx: (Math.random() - 0.5) * 0.16 * speed,
      vy: -(0.08 + Math.random() * 0.3) * speed,
      color: COLORS[Math.floor(Math.random() * COLORS.length)]!,
      phase: Math.random() * Math.PI * 2,
      twinkle: 0.01 + Math.random() * 0.03,
    });
    const embers = Array.from({ length: count }, () => ember(Math.random()));

    let frame = 0;
    let last = 0;
    const draw = (now: number) => {
      // Frames of 60 Hz, so a 120 Hz screen does not rise twice as fast.
      const step = last ? Math.min(3, (now - last) / 16.7) : 1;
      last = now;
      ctx.clearRect(0, 0, w, h);
      for (const e of embers) {
        e.phase += e.twinkle * step;
        e.x += ((e.vx + Math.sin(e.phase * 0.5) * 0.05) * step) / w;
        e.y += (e.vy * step) / h;
        if (e.y < -0.05) Object.assign(e, ember(1.05));
        // Born low, gone high: the area's edges stay soft.
        const fade = Math.max(0, Math.min(1, (1.05 - e.y) * 5, (e.y + 0.05) * 2.5));
        const alpha = (0.25 + 0.6 * (Math.sin(e.phase) * 0.5 + 0.5)) * fade;
        ctx.beginPath();
        ctx.arc(e.x * w, e.y * h, e.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${e.color},${alpha})`;
        ctx.shadowColor = `rgba(${e.color},0.75)`;
        ctx.shadowBlur = 9 * dpr;
        ctx.fill();
      }
      frame = requestAnimationFrame(draw);
    };
    const start = () => {
      if (frame) return;
      last = 0;
      frame = requestAnimationFrame(draw);
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
    };

    fit();
    const resized = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(fit);
    resized?.observe(canvas);
    const seen =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(([entry]) => (entry?.isIntersecting ? start() : stop()));
    if (seen) seen.observe(canvas);
    else start();

    return () => {
      stop();
      resized?.disconnect();
      seen?.disconnect();
    };
  }, [count, size, speed]);

  return <canvas ref={ref} className={className} aria-hidden />;
}
