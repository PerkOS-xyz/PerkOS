import { describe, expect, it } from "vitest";

import {
  agentIdentity,
  dmCounterparty,
  isAgentIdentity,
  isUserIdentity,
  userIdentity,
  type Conversation,
} from "../app/lib/conversationsApi";

describe("identity helpers", () => {
  it("userIdentity lowercases the wallet address", () => {
    expect(userIdentity("0xABABABABABABABABABABABABABABABABABABABAB")).toBe("user:0xabababababababababababababababababababab");
  });

  it("keeps Solana case variants as independent chat identities", () => {
    const wallet = "So11111111111111111111111111111111111111112";
    expect(userIdentity(wallet)).toBe(`user:${wallet}`);
    expect(userIdentity(wallet)).not.toBe(userIdentity(wallet.toLowerCase()));
  });

  it("agentIdentity keeps the name verbatim", () => {
    expect(agentIdentity("apollo")).toBe("agent:apollo");
    expect(agentIdentity("Apollo-Lead")).toBe("agent:Apollo-Lead");
  });

  it("isUserIdentity / isAgentIdentity classify correctly", () => {
    expect(isUserIdentity(userIdentity("0xabababababababababababababababababababab"))).toBe(true);
    expect(isUserIdentity(agentIdentity("x"))).toBe(false);
    expect(isAgentIdentity(agentIdentity("x"))).toBe(true);
    expect(isAgentIdentity(userIdentity("0xabababababababababababababababababababab"))).toBe(false);
  });
});

describe("dmCounterparty", () => {
  function makeConv(participants: string[], kind: "dm" | "channel"): Conversation {
    return {
      id: "c1",
      title: "test",
      kind,
      participants: participants as Conversation["participants"],
      historyHost: "agent:apollo",
      pinned: false,
      archived: false,
    };
  }

  it("returns the other identity for a 2-person DM", () => {
    const conv = makeConv(["user:0xabababababababababababababababababababab", "agent:apollo"], "dm");
    expect(dmCounterparty(conv, "0xabababababababababababababababababababab")).toBe("agent:apollo");
  });

  it("normalizes wallet casing via userIdentity()", () => {
    const conv = makeConv(["user:0xabababababababababababababababababababab", "agent:apollo"], "dm");
    expect(dmCounterparty(conv, "0xABABABABABABABABABABABABABABABABABABABAB")).toBe("agent:apollo");
    expect(dmCounterparty(conv, "0xabababababababababababababababababababab")).toBe("agent:apollo");
  });

  it("returns null for non-DM conversations", () => {
    const conv = makeConv(["user:0xabababababababababababababababababababab", "agent:apollo", "agent:hermes"], "channel");
    expect(dmCounterparty(conv, "0xabababababababababababababababababababab")).toBeNull();
  });

  it("returns the first non-self participant — caller doesn't need to be in the list", () => {
    // Documents current behavior: the function picks any participant that
    // isn't the caller, even when the caller isn't in `participants`. This
    // is fine in practice because we only load convs where the caller is
    // a participant via Firestore rules.
    const conv = makeConv(["user:0xdef", "agent:apollo"], "dm");
    expect(dmCounterparty(conv, "0xabababababababababababababababababababab")).toBe("user:0xdef");
  });
});
