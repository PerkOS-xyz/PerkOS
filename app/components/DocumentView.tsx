"use client";

/**
 * Long-form reader for agent deliverables and project docs.
 *
 * Chat bubbles keep the compact `Markdown` renderer; anything a person reads
 * as a document (an agent's result, a doc block) renders here instead:
 * Streamdown parses AI-written Markdown safely (unfinished syntax, sanitized
 * HTML, GFM tables), the CJK plugin keeps Korean/Japanese/Chinese emphasis
 * intact, and the code plugin highlights code blocks. The toolbar copies the
 * source, downloads it as .md, and opens a full-screen reading view.
 */

import { memo, useState, type ReactNode } from "react";
import { Streamdown, type Components } from "streamdown";
import { code } from "@streamdown/code";
import { cjk } from "@streamdown/cjk";
import { Check, Copy, Download, Maximize2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const plugins = { code, cjk };

const components: Components = {
  h1: ({ children }) => (
    <h1 className="mt-8 mb-3 text-xl font-semibold tracking-tight text-foreground first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-7 mb-3 border-b border-border pb-2 text-lg font-semibold tracking-tight text-foreground first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-6 mb-2 text-base font-semibold text-foreground first:mt-0">
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className="mt-5 mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground first:mt-0">
      {children}
    </h4>
  ),
  p: ({ children }) => (
    <p className="my-3 text-[15px] leading-7 text-foreground/85 first:mt-0 last:mb-0">
      {children}
    </p>
  ),
  ul: ({ children }) => (
    <ul className="my-3 ml-5 list-disc space-y-1.5 text-[15px] leading-7 text-foreground/85 marker:text-primary/70">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="my-3 ml-5 list-decimal space-y-1.5 text-[15px] leading-7 text-foreground/85 marker:text-primary/70">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="pl-1">{children}</li>,
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-4 rounded-r-md border-l-2 border-primary/50 bg-primary/5 py-1 pl-4 pr-3 text-foreground/75">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-6 border-border" />,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
    >
      {children}
    </a>
  ),
};

type Props = {
  children: string;
  /** Shown in the full-screen view and used for the downloaded file name. */
  title: string;
  /** Hide the copy / download / expand toolbar (e.g. inside a list). */
  toolbar?: boolean;
  /** Shown on the toolbar row, left of the buttons (e.g. who wrote it). */
  header?: ReactNode;
  /** Center the reading column inside a wider sheet. */
  centered?: boolean;
  /**
   * Render this instead of the Markdown (e.g. a doc made of interactive
   * blocks); the toolbar still copies, downloads and expands `children`.
   */
  body?: ReactNode;
  className?: string;
};

function fileNameFor(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${slug || "document"}.md`;
}

function DocumentBody({ source, className }: { source: string; className?: string }) {
  return (
    <Streamdown
      mode="static"
      plugins={plugins}
      components={components}
      className={cn("max-w-[72ch] break-words", className)}
    >
      {source}
    </Streamdown>
  );
}

function DocumentViewImpl({ children, title, toolbar = true, header, centered = false, body, className }: Props) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked (permissions, insecure context); nothing to undo.
    }
  }

  function download() {
    const url = URL.createObjectURL(new Blob([children], { type: "text/markdown;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = fileNameFor(title);
    link.click();
    URL.revokeObjectURL(url);
  }

  const button =
    "inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-8";
  const copyLabel = copied ? t("documentView.copied") : t("documentView.copy");

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {toolbar ? (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">{header}</div>
          {/* Labels collapse to icons on phones; the accessible name stays. */}
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <button type="button" onClick={copy} className={button} aria-label={copyLabel} title={copyLabel}>
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{copyLabel}</span>
            </button>
            <button type="button" onClick={download} className={button} aria-label={t("documentView.download")} title={t("documentView.download")}>
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t("documentView.download")}</span>
            </button>
            <button type="button" onClick={() => setExpanded(true)} className={button} aria-label={t("documentView.expand")} title={t("documentView.expand")}>
              <Maximize2 className="h-3.5 w-3.5" />
              <span className="hidden md:inline">{t("documentView.expand")}</span>
            </button>
          </div>
        </div>
      ) : null}

      {body ?? <DocumentBody source={children} className={centered ? "mx-auto w-full" : undefined} />}

      {toolbar ? (
        <Dialog open={expanded} onOpenChange={setExpanded}>
          <DialogContent className="flex max-h-[90vh] w-[min(56rem,calc(100vw-2rem))] max-w-none flex-col gap-4 overflow-hidden sm:max-w-none">
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto pr-2">
              <DocumentBody source={children} className="mx-auto" />
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}

export const DocumentView = memo(DocumentViewImpl);
