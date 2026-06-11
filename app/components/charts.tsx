"use client";

/**
 * Tiny hand-rolled SVG/CSS charts for the visibility widgets. No chart
 * library on purpose: the mini-app ships to mobile wallets, and a donut +
 * bar list + day-grid heatmap are a few dozen lines of SVG each — themed,
 * accessible, and ~0 KB of dependencies.
 */

import { cn } from "@/lib/utils";

/** Stable per-agent hue so every chart colors an agent the same way. */
export function agentHue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}

export function agentColor(name: string, alpha = 1): string {
  return `hsla(${agentHue(name)}, 75%, 60%, ${alpha})`;
}

export type DonutSegment = {
  label: string;
  value: number;
  color: string;
};

/**
 * Donut chart with a center stat. Segments are SVG circle strokes offset
 * around the ring — no path math, crisp at any size.
 */
export function DonutChart({
  segments,
  centerValue,
  centerLabel,
  size = 168,
}: {
  segments: DonutSegment[];
  centerValue: string;
  centerLabel: string;
  size?: number;
}) {
  const total = segments.reduce((acc, s) => acc + s.value, 0);
  const r = 40;
  const c = 2 * Math.PI * r;
  const gap = segments.filter((s) => s.value > 0).length > 1 ? 2.5 : 0;
  let offset = 0;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={`${centerValue} ${centerLabel}`}>
        <circle cx="50" cy="50" r={r} fill="none" stroke="#1b1833" strokeWidth="11" />
        {total > 0
          ? segments
              .filter((s) => s.value > 0)
              .map((s) => {
                const frac = s.value / total;
                const len = Math.max(frac * c - gap, 0.5);
                const el = (
                  <circle
                    key={s.label}
                    cx="50"
                    cy="50"
                    r={r}
                    fill="none"
                    stroke={s.color}
                    strokeWidth="11"
                    strokeLinecap="round"
                    strokeDasharray={`${len} ${c - len}`}
                    strokeDashoffset={-offset}
                    transform="rotate(-90 50 50)"
                  />
                );
                offset += frac * c;
                return el;
              })
          : null}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-semibold leading-none text-foreground">
          {centerValue}
        </span>
        <span className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
          {centerLabel}
        </span>
      </div>
    </div>
  );
}

/** Horizontal bar list — "who's doing the work" at a glance. */
export function BarList({
  rows,
}: {
  rows: { label: string; value: number; color: string; hint?: string }[];
}) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="flex w-full flex-col gap-2">
      {rows.map((r) => (
        <li key={r.label} className="flex items-center gap-2">
          <span className="w-28 shrink-0 truncate text-xs text-foreground" title={r.label}>
            {r.label}
          </span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#1b1833]">
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{ width: `${(r.value / max) * 100}%`, background: r.color }}
            />
          </div>
          <span className="w-10 shrink-0 text-right font-mono text-xs text-muted-foreground">
            {r.value}
            {r.hint ? <span className="text-[9px]"> {r.hint}</span> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * GitHub-style day grid for the last `weeks` weeks. `counts` maps
 * YYYY-MM-DD → event count. Proof the team works while the owner sleeps.
 */
export function ActivityHeatmap({
  counts,
  weeks = 12,
  className,
}: {
  counts: Record<string, number>;
  weeks?: number;
  className?: string;
}) {
  const today = new Date();
  // Build columns of 7 days, ending on today's week (Mon-first).
  const days: { key: string; count: number }[] = [];
  const totalDays = weeks * 7;
  const start = new Date(today);
  start.setDate(start.getDate() - (totalDays - 1));
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    days.push({ key, count: counts[key] ?? 0 });
  }
  const max = Math.max(...days.map((d) => d.count), 1);
  const level = (count: number) => {
    if (count === 0) return "bg-[#1b1833]";
    const f = count / max;
    if (f > 0.66) return "bg-primary";
    if (f > 0.33) return "bg-primary/60";
    return "bg-primary/30";
  };

  const columns: { key: string; count: number }[][] = [];
  for (let w = 0; w < weeks; w++) {
    columns.push(days.slice(w * 7, w * 7 + 7));
  }

  return (
    <div className={cn("flex gap-1 overflow-x-auto", className)} role="img" aria-label="Daily activity for the last weeks">
      {columns.map((col, i) => (
        <div key={i} className="flex flex-col gap-1">
          {col.map((d) => (
            <span
              key={d.key}
              title={`${d.key}: ${d.count} event${d.count === 1 ? "" : "s"}`}
              className={cn("h-2.5 w-2.5 rounded-[3px]", level(d.count))}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
