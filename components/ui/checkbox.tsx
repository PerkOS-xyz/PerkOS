"use client";

import { Check, Minus } from "lucide-react";

import { cn } from "@/lib/utils";

type CheckedState = boolean | "indeterminate";

/**
 * Minimal accessible checkbox — native input under the hood, styled to the
 * PerkOS dark/pink system. Supports an indeterminate "some selected" state
 * for select-all headers.
 */
export function Checkbox({
  checked,
  onCheckedChange,
  "aria-label": ariaLabel,
  className,
  disabled,
}: {
  checked: CheckedState;
  onCheckedChange: (checked: boolean) => void;
  "aria-label"?: string;
  className?: string;
  disabled?: boolean;
}) {
  const isOn = checked === true;
  const isIndeterminate = checked === "indeterminate";
  return (
    <label
      className={cn(
        "relative inline-flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center",
        disabled && "cursor-not-allowed opacity-50",
        className
      )}
    >
      <input
        type="checkbox"
        className="peer sr-only"
        checked={isOn}
        aria-label={ariaLabel}
        aria-checked={isIndeterminate ? "mixed" : isOn}
        disabled={disabled}
        onChange={(e) => onCheckedChange(e.target.checked)}
        onClick={(e) => e.stopPropagation()}
      />
      <span
        aria-hidden
        className={cn(
          "grid h-4 w-4 place-items-center rounded border transition-colors",
          isOn || isIndeterminate
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-transparent peer-hover:border-primary/60",
          "peer-focus-visible:ring-2 peer-focus-visible:ring-primary/50"
        )}
      >
        {isIndeterminate ? (
          <Minus className="h-3 w-3" />
        ) : isOn ? (
          <Check className="h-3 w-3" />
        ) : null}
      </span>
    </label>
  );
}
