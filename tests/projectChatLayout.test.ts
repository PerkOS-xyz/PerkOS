import { describe, expect, it } from "vitest";

import { projectChatAvailableHeight } from "../app/lib/projectChatLayout";

describe("project chat mobile layout", () => {
  it("fits the chat between its rendered top and the mobile navigation", () => {
    expect(
      projectChatAvailableHeight({ sectionTop: 455, viewportBottom: 991 }),
    ).toBe(524);
  });

  it("keeps a usable minimum height in a constrained viewport", () => {
    expect(
      projectChatAvailableHeight({ sectionTop: 500, viewportBottom: 700 }),
    ).toBe(288);
  });

  it("does not subtract an offscreen negative top twice", () => {
    expect(
      projectChatAvailableHeight({ sectionTop: -40, viewportBottom: 700 }),
    ).toBe(688);
  });
});
