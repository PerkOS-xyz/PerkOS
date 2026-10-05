import { describe, expect, it } from "vitest";

import { mentionFollowUp } from "../app/lib/mentionFollowUp";

describe("mentionFollowUp", () => {
  it("only wakes agents whose message the chat server is holding", () => {
    expect(mentionFollowUp({ delivered: 0, queued: 1 }, ["agent:Writer"])).toEqual({ wake: ["Writer"], resend: [] });
  });

  it("resends through A2A when nobody received it and nothing was held", () => {
    expect(mentionFollowUp({ delivered: 0, queued: 0 }, ["agent:Writer", "user:0xabc"])).toEqual({ wake: [], resend: ["Writer"] });
  });

  it("does nothing when the message was delivered", () => {
    expect(mentionFollowUp({ delivered: 1, queued: 0 }, ["agent:Writer"])).toEqual({ wake: [], resend: [] });
  });
});
