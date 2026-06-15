import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

/** Progress rail. `current` is 1-based; `total` is the branch's step count. */
export function Stepper({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex w-full items-center gap-2">
      {Array.from({ length: total }).map((_, i) => {
        const idx = i + 1;
        const done = idx < current;
        const active = idx === current;
        return (
          <div key={i} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                "grid h-7 w-7 shrink-0 place-items-center rounded-full border text-xs font-medium transition-colors",
                active &&
                  "border-primary bg-primary text-primary-foreground shadow-[0_0_8px_rgba(236,27,105,0.5)]",
                done && "border-primary bg-primary/20 text-primary",
                !active && !done && "border-border text-muted-foreground",
              )}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : idx}
            </span>
            {i < total - 1 ? (
              <span
                className={cn(
                  "h-px flex-1 transition-colors",
                  done ? "bg-primary" : "bg-border",
                )}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
