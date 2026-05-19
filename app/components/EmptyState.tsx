import Link from "next/link";
import type { ComponentType, ReactNode } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Variant = "default" | "outline" | "ghost" | "secondary";

type Action = {
  label: string;
  href?: string;
  onClick?: () => void;
  variant?: Variant;
  icon?: ComponentType<{ className?: string }>;
};

type Props = {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  description?: ReactNode;
  actions?: Action[];
  className?: string;
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  actions,
  className,
}: Props) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-border bg-card/40 px-6 py-12 text-center",
        className
      )}
    >
      {Icon ? (
        <div className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
      ) : null}

      <div className="flex max-w-sm flex-col gap-1.5">
        <h3 className="text-base font-medium text-foreground">{title}</h3>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>

      {actions && actions.length > 0 ? (
        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
          {actions.map(({ label, href, onClick, variant, icon: ActIcon }) => {
            const content = (
              <>
                {ActIcon ? <ActIcon className="h-4 w-4" /> : null}
                {label}
              </>
            );
            if (href) {
              return (
                <Link
                  key={label}
                  href={href}
                  className={cn(
                    buttonVariants({ variant: variant ?? "default" }),
                    "gap-2"
                  )}
                >
                  {content}
                </Link>
              );
            }
            return (
              <Button
                key={label}
                onClick={onClick}
                variant={variant ?? "default"}
                className="gap-2"
              >
                {content}
              </Button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
