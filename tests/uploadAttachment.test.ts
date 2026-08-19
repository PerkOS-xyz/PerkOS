import { describe, expect, it } from "vitest";

import {
  assertImageAttachment,
  attachmentMarkdown,
  isImageFile,
} from "../app/lib/uploadAttachment";

describe("chat image attachments", () => {
  it("accepts images and rejects other media", () => {
    expect(isImageFile({ type: "image/png" })).toBe(true);
    expect(isImageFile({ type: "application/pdf" })).toBe(false);
    expect(() =>
      assertImageAttachment({ name: "notes.pdf", type: "application/pdf" }),
    ).toThrow(/not an image/);
  });

  it("renders image markdown the thread and agent can consume", () => {
    expect(
      attachmentMarkdown({
        name: "shot.png",
        url: "https://cdn.example/shot.png",
        contentType: "image/png",
        isImage: true,
        size: 12,
      }),
    ).toBe("![shot.png](https://cdn.example/shot.png)");
  });
});
