import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("mobile empty Kanban columns", () => {
  const board = readFileSync(resolve(import.meta.dirname, "../app/components/KanbanBoard.tsx"), "utf8");
  const tasks = readFileSync(resolve(import.meta.dirname, "../app/(app)/tasks/page.tsx"), "utf8");

  it("uses compact mobile height only for empty columns", () => {
    expect(board).toContain('count === 0 ? "min-h-14 md:min-h-[120px]" : "min-h-[120px]"');
  });

  it("renders localized explanatory copy for every empty phase", () => {
    expect(tasks).toContain('emptyMessage={t("components.kanban.emptyPhase")}');
    expect(board).toContain("md:py-6");
  });
});
