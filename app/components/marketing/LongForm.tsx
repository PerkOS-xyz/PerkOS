import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";

// ============================================================================
// Building blocks for long public guides (/ai-agents-for-business,
// /agentic-business, the AI teams and industry pages). Server components with
// no client JavaScript: these pages are read by people on phones and by
// crawlers, so they render as plain HTML inside PublicPageShell.
// ============================================================================

const SITE = process.env.NEXT_PUBLIC_CANONICAL_URL ?? "https://perkos.xyz";

/** Numbered steps with the brand gradient on the numeral. */
export function Steps({ items }: { items: Array<{ title: string; body: string }> }) {
  return (
    <ol className="space-y-4">
      {items.map((item, index) => (
        <li key={item.title} className="flex gap-5 rounded-2xl border border-border bg-card p-6">
          <span
            aria-hidden
            className="bg-gradient-to-br from-[#ec1b69] to-[#f56a57] bg-clip-text font-mono text-3xl font-semibold leading-none text-transparent"
          >
            {String(index + 1).padStart(2, "0")}
          </span>
          <div>
            <h3 className="font-semibold text-foreground">{item.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/**
 * A comparison table. It scrolls inside its own box on narrow screens so the
 * page itself never scrolls sideways.
 */
export function ComparisonTable({
  caption,
  columns,
  rows,
}: {
  caption: string;
  columns: string[];
  rows: string[][];
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border">
      <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-card">
          <tr>
            {columns.map((column) => (
              <th key={column} scope="col" className="px-5 py-4 font-semibold text-foreground">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row[0]} className="border-t border-border align-top">
              {row.map((cell, index) =>
                index === 0 ? (
                  <th key={index} scope="row" className="px-5 py-4 font-medium text-foreground">
                    {cell}
                  </th>
                ) : (
                  <td key={index} className="px-5 py-4 text-muted-foreground">
                    {cell}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Questions and answers, plus the FAQPage structured data for them. */
export function FaqList({ items, path }: { items: Array<{ q: string; a: string }>; path: string }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    url: `${SITE}${path}`,
    mainEntity: items.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      {items.map(({ q, a }) => (
        <article key={q} className="border-b border-border pb-5">
          <h3 className="font-semibold text-foreground">{q}</h3>
          <p className="mt-2">{a}</p>
        </article>
      ))}
    </>
  );
}

/** Cards that link to the related guides, so each page passes readers on. */
export function RelatedPages({ links }: { links: Array<{ href: string; title: string; body: string }> }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="group rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary/60"
        >
          <span className="inline-flex items-center gap-2 font-semibold text-foreground">
            {link.title}
            <ArrowRight className="h-4 w-4 text-primary transition-transform group-hover:translate-x-1" />
          </span>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{link.body}</p>
        </Link>
      ))}
    </div>
  );
}

/** A short highlighted takeaway inside a section. */
export function KeyPoint({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-2xl border border-primary/30 bg-primary/5 p-5 text-foreground">{children}</p>
  );
}
