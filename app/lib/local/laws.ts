/**
 * Non-negotiable product laws for PerkOS Local.
 * Code and prompts must obey these; demos that break them are bugs.
 */

export const LOCAL_LAWS = [
  "Never invent prices, menu items, services, or hours that are not in the business profile.",
  "Never confirm a booking for a slot that was not previously offered in this conversation.",
  "Never confirm a booking that was not created in the booking store.",
  "Low confidence, out-of-knowledge, or explicit human request → handoff.",
  "External blasts, promos, and reviews leave as drafts for owner approval.",
  "WhatsApp Cloud API only — no QR / unofficial clients.",
  "Lab score gate before enabling live customer replies on a business.",
] as const;

export function canConfirmSlot(args: {
  offeredStarts: string[];
  confirmStartIso: string | undefined;
}): boolean {
  if (!args.confirmStartIso) return false;
  return args.offeredStarts.includes(args.confirmStartIso);
}

export function shouldHandoff(args: {
  confidence: "high" | "medium" | "low";
  intent: string;
  customerAskedHuman: boolean;
}): boolean {
  if (args.customerAskedHuman) return true;
  if (args.intent === "handoff" || args.intent === "out_of_scope") return true;
  if (args.confidence === "low") return true;
  return false;
}
