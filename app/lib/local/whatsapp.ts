/**
 * WhatsApp Cloud API helpers for PerkOS Local.
 * Uses server env only — never expose tokens to the browser.
 */

export type WhatsAppInboundText = {
  waId: string;
  messageId: string;
  text: string;
  profileName?: string;
  phoneNumberId: string;
};

export function getLocalWhatsAppConfig() {
  return {
    verifyToken: process.env.LOCAL_WHATSAPP_VERIFY_TOKEN ?? "",
    appSecret: process.env.LOCAL_WHATSAPP_APP_SECRET ?? "",
    accessToken: process.env.LOCAL_WHATSAPP_ACCESS_TOKEN ?? "",
    phoneNumberId: process.env.LOCAL_WHATSAPP_PHONE_NUMBER_ID ?? "",
    graphVersion: process.env.LOCAL_WHATSAPP_GRAPH_VERSION ?? "v21.0",
    /** Which pilot vertical this number maps to until multi-tenant routing exists. */
    defaultVertical:
      (process.env.LOCAL_WHATSAPP_DEFAULT_VERTICAL as
        | "barbershop"
        | "restaurant"
        | undefined) ?? "barbershop",
  };
}

export function parseInboundTextMessages(body: unknown): WhatsAppInboundText[] {
  const out: WhatsAppInboundText[] = [];
  if (!body || typeof body !== "object") return out;
  const entry = (body as { entry?: unknown }).entry;
  if (!Array.isArray(entry)) return out;

  for (const ent of entry) {
    const changes = (ent as { changes?: unknown }).changes;
    if (!Array.isArray(changes)) continue;
    for (const change of changes) {
      const value = (change as { value?: Record<string, unknown> }).value;
      if (!value) continue;
      const phoneNumberId = String(
        (value.metadata as { phone_number_id?: string } | undefined)?.phone_number_id ??
          "",
      );
      const contacts = value.contacts as
        | { wa_id?: string; profile?: { name?: string } }[]
        | undefined;
      const messages = value.messages as
        | {
            id?: string;
            from?: string;
            type?: string;
            text?: { body?: string };
          }[]
        | undefined;
      if (!messages?.length) continue;
      for (const msg of messages) {
        if (msg.type !== "text" || !msg.text?.body || !msg.from) continue;
        const contact = contacts?.find((c) => c.wa_id === msg.from);
        out.push({
          waId: msg.from,
          messageId: msg.id ?? `${msg.from}-${Date.now()}`,
          text: msg.text.body,
          profileName: contact?.profile?.name,
          phoneNumberId,
        });
      }
    }
  }
  return out;
}

export async function sendWhatsAppText(args: {
  phoneNumberId: string;
  toWaId: string;
  body: string;
  accessToken: string;
  graphVersion?: string;
}): Promise<{ ok: boolean; status: number; detail?: string }> {
  const version = args.graphVersion ?? "v21.0";
  const url = `https://graph.facebook.com/${version}/${args.phoneNumberId}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: args.toWaId,
      type: "text",
      text: { body: args.body },
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return { ok: false, status: res.status, detail: detail.slice(0, 500) };
  }
  return { ok: true, status: res.status };
}

/** Map a confirm reply like "1" / "2" onto offered slot starts. */
export function resolveConfirmChoice(
  text: string,
  offeredStarts: string[],
): string | undefined {
  const trimmed = text.trim();
  const asNum = Number(trimmed);
  if (Number.isInteger(asNum) && asNum >= 1 && asNum <= offeredStarts.length) {
    return offeredStarts[asNum - 1];
  }
  return offeredStarts.find((s) => trimmed.includes(s));
}
