import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function SelectableCard({
  selected,
  onClick,
  children,
  disabled,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <label
      onClick={(event) => {
        if (disabled) {
          event.preventDefault();
          return;
        }
        onClick();
      }}
      aria-disabled={disabled || undefined}
      className={cn(
        "flex cursor-pointer flex-col rounded-lg border p-4 text-left transition-colors",
        selected
          ? "border-primary bg-primary/10 shadow-[0_0_12px_rgba(236,27,105,0.18)]"
          : "border-border bg-card hover:border-primary/40",
        disabled && "cursor-not-allowed opacity-60 hover:border-border",
      )}
    >
      {children}
    </label>
  );
}
