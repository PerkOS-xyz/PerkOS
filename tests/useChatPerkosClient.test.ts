import { describe, expect, it } from "vitest";

import { frameBelongsToConversation } from "../app/lib/useChatPerkosClient";

describe("chat conversation isolation", () => {
  it("accepts only frames for the panel's active conversation", () => {
    expect(
      frameBelongsToConversation({ convId: "conv-agent-a" }, "conv-agent-a"),
    ).toBe(true);
    expect(
      frameBelongsToConversation({ convId: "conv-project" }, "conv-agent-a"),
    ).toBe(false);
  });

  it("rejects legacy or malformed frames without a conversation id", () => {
    expect(frameBelongsToConversation({}, "conv-agent-a")).toBe(false);
    expect(
      frameBelongsToConversation({ convId: 42 }, "conv-agent-a"),
    ).toBe(false);
  });
});
