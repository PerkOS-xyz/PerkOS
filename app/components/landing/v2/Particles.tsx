"use client";

// ============================================================================
// Particles — lightweight ember/spark field on a 2D canvas. Zero dependencies
// (deliberately chosen over three.js for this effect: same visual, ~200KB
// lighter). Brand-tinted particles drift upward with a soft twinkle. Pauses
// via rAF when the tab is hidden. Decorative (aria-hidden, pointer-events
// none). If we later want a true WebGL hero (mouse-reactive shaders), the
// upgrade path is three + @react-three/fiber.
// ============================================================================

import { useEffect, useRef } from "react";

type P = {
  x: number; y: number; r: number;
  vx: number; vy: number;
  c: string; tw: number; tws: number;
};

export function Particles({
  className,
  density = 70,
}: {
  className?: string;
  density?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let W = 0;
    let H = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      W = canvas.width = Math.max(1, Math.floor(canvas.offsetWidth * dpr));
      H = canvas.height = Math.max(1, Math.floor(canvas.offsetHeight * dpr));
    };
    resize();
    window.addEventListener("resize", resize);

    const COLORS = ["236,27,105", "240,91,87", "255,178,120"];
    const ps: P[] = Array.from({ length: density }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() * 1.6 + 0.4,
      vx: (Math.random() - 0.5) * 0.0002,
      vy: -(Math.random() * 0.00035 + 0.0001),
      c: COLORS[(Math.random() * COLORS.length) | 0],
      tw: Math.random() * Math.PI * 2,
      tws: Math.random() * 0.03 + 0.01,
    }));

    const tick = () => {
      ctx.clearRect(0, 0, W, H);
      for (const p of ps) {
        p.x += p.vx;
        p.y += p.vy;
        p.tw += p.tws;
        if (p.y < -0.05) { p.y = 1.05; p.x = Math.random(); }
        if (p.x < -0.05) p.x = 1.05;
        else if (p.x > 1.05) p.x = -0.05;

        const a = 0.22 + 0.38 * (Math.sin(p.tw) * 0.5 + 0.5);
        ctx.beginPath();
        ctx.arc(p.x * W, p.y * H, p.r * dpr, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.c},${a})`;
        ctx.shadowColor = `rgba(${p.c},0.8)`;
        ctx.shadowBlur = 6 * dpr;
        ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [density]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className={`pointer-events-none h-full w-full ${className ?? ""}`}
    />
  );
}
