/**
 * PerkOS Local — shared types for the WhatsApp-native local-business lane.
 *
 * Dual-vertical pilot: barbershop/stylists + restaurant.
 * Laws: never invent prices or bookable slots; low confidence → human handoff.
 */

export type LocalVertical = "barbershop" | "restaurant";

export type LocalIntent =
  | "faq"
  | "booking"
  | "reschedule"
  | "cancel"
  | "menu"
  | "hours"
  | "pricing"
  | "handoff"
  | "out_of_scope"
  | "unknown";

export type LocalConfidence = "high" | "medium" | "low";

export type LocalContact = {
  waId: string;
  profileName?: string;
  phoneE164?: string;
};

export type LocalMessage = {
  id: string;
  direction: "inbound" | "outbound" | "system";
  body: string;
  createdAt: string;
  fromAi?: boolean;
};

export type LocalConversationStatus =
  | "bot"
  | "needs_human"
  | "human"
  | "closed";

export type LocalConversation = {
  id: string;
  vertical: LocalVertical;
  contact: LocalContact;
  status: LocalConversationStatus;
  stage: string;
  messages: LocalMessage[];
  updatedAt: string;
};

export type OfferedSlot = {
  /** ISO start time in the business timezone. */
  startIso: string;
  /** Minutes. */
  durationMin: number;
  stylistId?: string;
  label: string;
};

export type LocalBooking = {
  id: string;
  conversationId: string;
  slot: OfferedSlot;
  serviceId: string;
  status: "offered" | "confirmed" | "cancelled" | "completed" | "no_show";
};

export type LocalTurnDecision = {
  intent: LocalIntent;
  confidence: LocalConfidence;
  reply: string;
  handoff: boolean;
  /** Only slots previously offered may be confirmed. */
  offerSlots?: OfferedSlot[];
  confirmSlotStartIso?: string;
  notes?: string[];
};

export type LocalBusinessProfile = {
  id: string;
  name: string;
  vertical: LocalVertical;
  timezone: string;
  knowledge: { question: string; answer: string }[];
  services: { id: string; name: string; durationMin: number; priceLabel: string }[];
  hoursLabel: string;
  handoffPhone?: string;
};
