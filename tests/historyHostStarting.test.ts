import { describe, expect, it } from "vitest";

import { historyHostStarting } from "../app/lib/useChatClient";

describe("historyHostStarting", () => {
  it("treats a new project's unhosted conversation as a host still starting", () => {
    expect(historyHostStarting("NO_HOST: conversation has no historyHost")).toBe(true);
    expect(historyHostStarting("HOST_OFFLINE")).toBe(true);
  });

  it("keeps real errors", () => {
    expect(historyHostStarting("FORBIDDEN: not a participant")).toBe(false);
  });
});
