import { NextRequest, NextResponse } from "next/server";

import {
  appendMessage,
  getOfferedSlots,
  getOrCreateConversation,
  setConversationStatus,
  setOfferedSlots,
} from "@/app/lib/local/store";
import { routeLocalTurn } from "@/app/lib/local/turnRouter";
import { getPilotProfile } from "@/app/lib/local/verticals";
import {
  getLocalWhatsAppConfig,
  parseInboundTextMessages,
  resolveConfirmChoice,
  sendWhatsAppText,
} from "@/app/lib/local/whatsapp";

export const runtime = "nodejs";

/** Meta webhook verification. */
export async function GET(req: NextRequest) {
  const cfg = getLocalWhatsAppConfig();
  const mode = req.nextUrl.searchParams.get("hub.mode");
  const token = req.nextUrl.searchParams.get("hub.verify_token");
  const challenge = req.nextUrl.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token && cfg.verifyToken && token === cfg.verifyToken) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }
  return NextResponse.json({ error: "forbidden" }, { status: 403 });
}

/** Inbound WhatsApp messages → Local turn router → reply / handoff. */
export async function POST(req: NextRequest) {
  const cfg = getLocalWhatsAppConfig();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const inbound = parseInboundTextMessages(body);
  if (inbound.length === 0) {
    // Status callbacks etc. — ack quickly.
    return NextResponse.json({ ok: true, handled: 0 });
  }

  const vertical = cfg.defaultVertical;
  const profile = getPilotProfile(vertical);
  const results: { waId: string; handoff: boolean; sent: boolean }[] = [];

  for (const msg of inbound) {
    getOrCreateConversation({
      vertical,
      waId: msg.waId,
      profileName: msg.profileName,
    });
    appendMessage(vertical, msg.waId, {
      direction: "inbound",
      body: msg.text,
    });

    const offered = getOfferedSlots(vertical, msg.waId);
    const confirmStartIso = resolveConfirmChoice(
      msg.text,
      offered.map((s) => s.startIso),
    );
    const decision = routeLocalTurn({
      profile,
      text: msg.text,
      previouslyOffered: offered,
      confirmStartIso,
    });

    if (decision.offerSlots?.length) {
      setOfferedSlots(vertical, msg.waId, decision.offerSlots);
    }
    if (decision.handoff) {
      setConversationStatus(vertical, msg.waId, "needs_human");
    }

    appendMessage(vertical, msg.waId, {
      direction: "outbound",
      body: decision.reply,
      fromAi: true,
    });

    let sent = false;
    if (cfg.accessToken && (msg.phoneNumberId || cfg.phoneNumberId)) {
      const sendResult = await sendWhatsAppText({
        phoneNumberId: msg.phoneNumberId || cfg.phoneNumberId,
        toWaId: msg.waId,
        body: decision.reply,
        accessToken: cfg.accessToken,
        graphVersion: cfg.graphVersion,
      });
      sent = sendResult.ok;
      if (!sendResult.ok) {
        console.error("[local/whatsapp] send failed", sendResult.status, sendResult.detail);
      }
    } else {
      console.warn(
        "[local/whatsapp] missing LOCAL_WHATSAPP_ACCESS_TOKEN or phone id — reply stored only",
      );
    }

    results.push({ waId: msg.waId, handoff: decision.handoff, sent });
  }

  return NextResponse.json({ ok: true, handled: results.length, results });
}
