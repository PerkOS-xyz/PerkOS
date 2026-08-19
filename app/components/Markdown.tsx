"use client";

import { memo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

type Props = {
  children: string;
  className?: string;
};

const components: Components = {
  p: ({ children }) => (
    <p className="my-1 leading-relaxed [&:first-child]:mt-0 [&:last-child]:mb-0">
      {children}
    </p>
  ),
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
  img: ({ src, alt }) =>
    src ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt ?? ""}
        className="my-2 max-h-64 max-w-full rounded-md border border-border object-contain"
      />
    ) : null,
  ul: ({ children }) => (
    <ul className="my-2 ml-4 list-disc space-y-1 [&:first-child]:mt-0 [&:last-child]:mb-0">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="my-2 ml-5 list-decimal space-y-1 [&:first-child]:mt-0 [&:last-child]:mb-0">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  h1: ({ children }) => (
    <h1 className="mt-3 mb-1 text-base font-semibold text-foreground [&:first-child]:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-3 mb-1 text-sm font-semibold text-foreground [&:first-child]:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-2 mb-1 text-sm font-medium text-foreground [&:first-child]:mt-0">
      {children}
    </h3>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-primary/40 pl-3 text-muted-foreground [&:first-child]:mt-0 [&:last-child]:mb-0">
      {children}
    </blockquote>
  ),
  code: ({ className, children, ...rest }) => {
    const isBlock = /language-/.test(className ?? "");
    if (isBlock) {
      return (
        <code className={cn("font-mono text-[12px]", className)} {...rest}>
          {children}
        </code>
      );
    }
    return (
      <code
        className="rounded bg-muted/60 px-1 py-0.5 font-mono text-[12px] text-foreground"
        {...rest}
      >
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="my-2 overflow-x-auto rounded-md border border-border bg-muted/40 p-3 text-[12px] leading-relaxed [&:first-child]:mt-0 [&:last-child]:mb-0">
      {children}
    </pre>
  ),
  hr: () => <hr className="my-3 border-border" />,
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-left text-xs">
        {children}
      </table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-b border-border px-2 py-1 font-semibold text-foreground">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-b border-border/60 px-2 py-1">{children}</td>
  ),
};

function MarkdownInner({ children, className }: Props) {
  return (
    <div className={cn("text-sm text-foreground", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}

export const Markdown = memo(MarkdownInner);
