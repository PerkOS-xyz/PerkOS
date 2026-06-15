import type { ReactNode } from "react";

import type { SoulFields } from "@/app/lib/agentPresets";

// ---------------------------------------------------------------------------
// SoulDetailCard — expanded view of a preset's SoulFields, shown when the
// user clicks "Advanced" in the template step. Read-only; the underlying
// SOUL.md is edited via the system-prompt textarea above.
// ---------------------------------------------------------------------------

export function SoulDetailCard({ soul }: { soul: SoulFields }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/20 p-4">
      {soul.identity ? (
        <SoulSection title="Identity">
          <p className="text-sm italic text-foreground">{soul.identity}</p>
        </SoulSection>
      ) : null}

      {soul.coreTruths.length > 0 ? (
        <SoulSection title="Core Truths">
          <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
            {soul.coreTruths.map((t) => (
              <li key={t.principle}>
                <span className="font-medium text-foreground">{t.principle}.</span>{" "}
                {t.explanation}
              </li>
            ))}
          </ul>
        </SoulSection>
      ) : null}

      {soul.worldview.length > 0 ? (
        <SoulSection title="Worldview">
          <div className="flex flex-col gap-2">
            {soul.worldview.map((w) => (
              <div key={w.domain}>
                <p className="text-xs font-medium uppercase tracking-wide text-foreground">
                  {w.domain}
                </p>
                <ul className="ml-4 list-disc text-sm text-muted-foreground">
                  {w.opinions.map((o, i) => (
                    <li key={i}>{o}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </SoulSection>
      ) : null}

      {soul.voice.length > 0 ? (
        <SoulSection title="Communication Style">
          <ul className="ml-4 list-disc text-sm text-muted-foreground">
            {soul.voice.map((v, i) => (
              <li key={i}>{v}</li>
            ))}
          </ul>
        </SoulSection>
      ) : null}

      {soul.expertise.primary ||
      soul.expertise.fluentIn.length > 0 ||
      soul.expertise.defersOn.length > 0 ? (
        <SoulSection title="Expertise">
          <div className="flex flex-col gap-1 text-sm text-muted-foreground">
            {soul.expertise.primary ? (
              <p>
                <span className="font-medium text-foreground">Primary:</span>{" "}
                {soul.expertise.primary}
              </p>
            ) : null}
            {soul.expertise.fluentIn.length > 0 ? (
              <p>
                <span className="font-medium text-foreground">Fluent in:</span>{" "}
                {soul.expertise.fluentIn.join(", ")}
              </p>
            ) : null}
            {soul.expertise.defersOn.length > 0 ? (
              <p>
                <span className="font-medium text-foreground">Defers on:</span>{" "}
                {soul.expertise.defersOn.join(", ")}
              </p>
            ) : null}
          </div>
        </SoulSection>
      ) : null}

      {soul.boundaries.length > 0 ? (
        <SoulSection title="Boundaries">
          <ul className="ml-4 list-disc text-sm text-muted-foreground">
            {soul.boundaries.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </SoulSection>
      ) : null}

      {soul.memoryPolicy.remember.length > 0 ||
      soul.memoryPolicy.dontRemember.length > 0 ? (
        <SoulSection title="Memory Policy">
          <div className="flex flex-col gap-1 text-sm text-muted-foreground">
            {soul.memoryPolicy.remember.length > 0 ? (
              <p>
                <span className="font-medium text-foreground">Remember:</span>{" "}
                {soul.memoryPolicy.remember.join("; ")}.
              </p>
            ) : null}
            {soul.memoryPolicy.dontRemember.length > 0 ? (
              <p>
                <span className="font-medium text-foreground">
                  Don&apos;t remember:
                </span>{" "}
                {soul.memoryPolicy.dontRemember.join("; ")}.
              </p>
            ) : null}
          </div>
        </SoulSection>
      ) : null}

      {soul.petPeeves.length > 0 ? (
        <SoulSection title="Pet Peeves">
          <ul className="ml-4 list-disc text-sm text-muted-foreground">
            {soul.petPeeves.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </SoulSection>
      ) : null}
    </div>
  );
}

function SoulSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-primary">
        {title}
      </h4>
      {children}
    </div>
  );
}
