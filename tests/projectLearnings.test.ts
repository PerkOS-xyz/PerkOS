import { describe, expect, it } from "vitest";

import { citedSources, keyPoints, projectLearnings } from "../app/lib/projectLearnings";
import type { Task } from "../app/lib/perkosApi";

const brief = `# Harbor Tea Shop: Autumn Collection Brief

**Headline:** A small tea shop can compete by leaning into wellness and seasonal botanical blends.

## Target audience
- Gen Z and Millennial wellness seekers who want cozy, local experiences
- Seasonal gift buyers looking for **autumn** blends
- Office workers on a lunch break

## Sources
- [Tea Association report](https://www.teausa.com/report-2026)
- https://example.org/local-cafes, checked in October
`;

describe("keyPoints", () => {
  it("puts the headline first, then the first bullets outside Sources", () => {
    expect(keyPoints(brief)).toEqual([
      "A small tea shop can compete by leaning into wellness and seasonal botanical blends.",
      "Gen Z and Millennial wellness seekers who want cozy, local experiences",
      "Seasonal gift buyers looking for autumn blends",
    ]);
  });

  it("falls back to the first sentences of prose", () => {
    expect(keyPoints("The plan keeps three blends. Prices stay under $8. More details follow.")).toEqual([
      "The plan keeps three blends.",
      "Prices stay under $8.",
    ]);
  });
});

describe("citedSources", () => {
  it("collects Markdown and bare links once each", () => {
    expect(citedSources(brief)).toEqual([
      { label: "Tea Association report", url: "https://www.teausa.com/report-2026" },
      { label: "example.org", url: "https://example.org/local-cafes" },
    ]);
  });
});

describe("projectLearnings", () => {
  it("keeps only delivered results", () => {
    const tasks: Task[] = [
      { id: "a", name: "Research the audience", status: "Done", priority: "High", agent: "Harbor-Researcher", result: brief },
      { id: "b", name: "Write the plan", status: "In progress", priority: "Medium", agent: "Harbor-Analyst" },
      { id: "c", name: "Empty", status: "Done", priority: "Low", agent: "Harbor-Analyst", result: "  " },
    ];
    const learnings = projectLearnings(tasks);
    expect(learnings).toHaveLength(1);
    expect(learnings[0]).toMatchObject({ taskId: "a", agent: "Harbor-Researcher" });
    expect(learnings[0]?.sources).toHaveLength(2);
  });
});
