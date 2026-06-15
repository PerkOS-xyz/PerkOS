import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Check, Plus } from "lucide-react";

import { cn } from "@/lib/utils";

export function GatewayCard({
  title,
  icon: Icon,
  enabled,
  onToggle,
  blurb,
  children,
}: {
  title: string;
  icon: LucideIcon;
  enabled: boolean;
  onToggle: (next: boolean) => void;
  blurb: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border p-3 transition-colors",
        enabled ? "border-primary bg-primary/5" : "border-border bg-card",
      )}
    >
      <button
        type="button"
        onClick={() => onToggle(!enabled)}
        className="flex w-full items-start justify-between gap-3 text-left"
      >
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "grid h-8 w-8 shrink-0 place-items-center rounded-md",
              enabled ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-foreground">{title}</span>
            <span className="text-xs text-muted-foreground">{blurb}</span>
          </div>
        </div>
        {enabled ? (
          <Check className="h-4 w-4 text-primary" />
        ) : (
          <Plus className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {enabled ? <div className="border-t border-border pt-3">{children}</div> : null}
    </div>
  );
}
