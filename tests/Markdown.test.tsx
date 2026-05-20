import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { Markdown } from "../app/components/Markdown";

describe("Markdown", () => {
  it("renders plain text inside a paragraph", () => {
    render(<Markdown>Hello world</Markdown>);
    expect(screen.getByText("Hello world").tagName).toBe("P");
  });

  it("renders strong + em formatting", () => {
    render(<Markdown>This is **bold** and *italic*.</Markdown>);
    expect(screen.getByText("bold").tagName).toBe("STRONG");
    expect(screen.getByText("italic").tagName).toBe("EM");
  });

  it("renders unordered lists with each item as <li>", () => {
    render(<Markdown>{"- one\n- two\n- three"}</Markdown>);
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("one");
  });

  it("renders links with target=_blank and rel=noreferrer noopener", () => {
    render(<Markdown>{"See [perkos](https://perkos.xyz)."}</Markdown>);
    const link = screen.getByRole("link", { name: "perkos" });
    expect(link).toHaveAttribute("href", "https://perkos.xyz");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel")).toMatch(/noreferrer/);
    expect(link.getAttribute("rel")).toMatch(/noopener/);
  });

  it("renders fenced code blocks", () => {
    render(<Markdown>{"```\nnpm run build\n```"}</Markdown>);
    // react-markdown renders fenced code as <pre><code>…</code></pre>;
    // assert the literal text reaches the DOM.
    expect(screen.getByText(/npm run build/)).toBeInTheDocument();
  });
});
