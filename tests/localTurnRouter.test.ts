import { describe, expect, it } from "vitest";

import { canConfirmSlot, shouldHandoff } from "../app/lib/local/laws";
import { routeLocalTurn } from "../app/lib/local/turnRouter";
import { getPilotProfile } from "../app/lib/local/verticals";
import { resolveConfirmChoice } from "../app/lib/local/whatsapp";

describe("PerkOS Local laws", () => {
  it("blocks confirming a slot that was never offered", () => {
    expect(
      canConfirmSlot({
        offeredStarts: ["2026-10-14T15:00:00-05:00"],
        confirmStartIso: "2026-10-14T16:00:00-05:00",
      }),
    ).toBe(false);
  });

  it("hands off on low confidence or human ask", () => {
    expect(
      shouldHandoff({ confidence: "low", intent: "faq", customerAskedHuman: false }),
    ).toBe(true);
    expect(
      shouldHandoff({
        confidence: "high",
        intent: "faq",
        customerAskedHuman: true,
      }),
    ).toBe(true);
  });
});

describe("PerkOS Local turn router", () => {
  it("offers real barbershop slots and confirms by number only", () => {
    const profile = getPilotProfile("barbershop");
    const first = routeLocalTurn({
      profile,
      text: "Quiero una cita para corte",
      previouslyOffered: [],
    });
    expect(first.intent).toBe("booking");
    expect(first.offerSlots?.length).toBeGreaterThan(0);
    expect(first.handoff).toBe(false);

    const starts = first.offerSlots!.map((s) => s.startIso);
    const choice = resolveConfirmChoice("1", starts);
    const second = routeLocalTurn({
      profile,
      text: "1",
      previouslyOffered: first.offerSlots!,
      confirmStartIso: choice,
    });
    expect(second.confirmSlotStartIso).toBe(starts[0]);
    expect(second.notes).toContain("booking_confirmed");
  });

  it("answers restaurant menu from knowledge and hands off inventable table asks carefully", () => {
    const profile = getPilotProfile("restaurant");
    const veg = routeLocalTurn({
      profile,
      text: "tienen vegetarianos?",
      previouslyOffered: [],
    });
    expect(veg.intent).toBe("menu");
    expect(veg.reply.toLowerCase()).toContain("vegetarian");

    const human = routeLocalTurn({
      profile,
      text: "quiero hablar con un humano",
      previouslyOffered: [],
    });
    expect(human.handoff).toBe(true);
  });

  it("does not invent FAQ answers outside knowledge", () => {
    const profile = getPilotProfile("barbershop");
    const decision = routeLocalTurn({
      profile,
      text: "aceptan criptomonedas dogecoin?",
      previouslyOffered: [],
    });
    expect(decision.handoff).toBe(true);
  });
});
