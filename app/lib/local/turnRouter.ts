import { canConfirmSlot, shouldHandoff } from "./laws";
import type {
  LocalBusinessProfile,
  LocalConfidence,
  LocalIntent,
  LocalTurnDecision,
  OfferedSlot,
} from "./types";

const HUMAN_RE =
  /\b(humano|asesor|persona|alguien|hablar con|agent|human|receptionist)\b/i;

function detectIntent(text: string, vertical: LocalBusinessProfile["vertical"]): LocalIntent {
  if (HUMAN_RE.test(text)) return "handoff";
  if (/\b(cancel|cancelar|anular)\b/i.test(text)) return "cancel";
  if (/\b(reprogram|reagendar|cambiar (la )?cita|reschedule)\b/i.test(text))
    return "reschedule";
  if (/\b(precio|price|cu[aá]nto|cost)\b/i.test(text)) return "pricing";
  if (/\b(horario|hora|abren|cierran|hours|open)\b/i.test(text)) return "hours";
  if (vertical === "restaurant" && /\b(men[uú]|carta|plato|vegan|vegetari|alerg)/i.test(text))
    return "menu";
  if (
    /\b(cita|reserv|agendar|book|turno|mesa|table|appointment)\b/i.test(text)
  )
    return "booking";
  if (/\b(donde|ubicaci[oó]n|address|direcci[oó]n|walk-?in)\b/i.test(text)) return "faq";
  return "unknown";
}

function confidenceFor(intent: LocalIntent): LocalConfidence {
  if (intent === "unknown" || intent === "out_of_scope") return "low";
  if (intent === "faq" || intent === "hours" || intent === "pricing" || intent === "menu")
    return "high";
  if (intent === "booking" || intent === "reschedule" || intent === "cancel") return "medium";
  return "high";
}

function matchKnowledge(profile: LocalBusinessProfile, text: string): string | null {
  const lowered = text.toLowerCase();
  for (const item of profile.knowledge) {
    const q = item.question.toLowerCase();
    const overlap = q
      .split(/\W+/)
      .filter((w) => w.length > 3)
      .some((w) => lowered.includes(w));
    if (overlap) return item.answer;
  }
  return null;
}

function formatServices(profile: LocalBusinessProfile): string {
  return profile.services
    .map((s) => `• ${s.name} — ${s.durationMin} min — ${s.priceLabel}`)
    .join("\n");
}

/**
 * Deterministic first-pass router for the dual-vertical pilot.
 * Replace intent/confidence with TypeSafe/Jev later; keep booking guards in code.
 */
export function routeLocalTurn(args: {
  profile: LocalBusinessProfile;
  text: string;
  previouslyOffered: OfferedSlot[];
  /** If the customer is confirming an offered slot start ISO. */
  confirmStartIso?: string;
}): LocalTurnDecision {
  const intent = detectIntent(args.text, args.profile.vertical);
  const confidence = confidenceFor(intent);
  const customerAskedHuman = HUMAN_RE.test(args.text);
  const handoff = shouldHandoff({ confidence, intent, customerAskedHuman });

  if (handoff) {
    return {
      intent: customerAskedHuman ? "handoff" : intent,
      confidence,
      handoff: true,
      reply:
        "Te paso con una persona del equipo ahora. Un momento — alguien te escribe por aquí.",
      notes: ["handoff"],
    };
  }

  if (intent === "hours") {
    return {
      intent,
      confidence,
      handoff: false,
      reply: `Nuestro horario: ${args.profile.hoursLabel}. ¿Quieres que busque un turno?`,
    };
  }

  if (intent === "pricing" || (intent === "menu" && args.profile.vertical === "barbershop")) {
    return {
      intent: "pricing",
      confidence,
      handoff: false,
      reply: `Servicios y precios:\n${formatServices(args.profile)}`,
    };
  }

  if (intent === "menu" && args.profile.vertical === "restaurant") {
    const kb = matchKnowledge(args.profile, args.text);
    return {
      intent,
      confidence,
      handoff: false,
      reply:
        kb ??
        "Puedo ayudar con vegetarianos, alergias y reservas. ¿Qué necesitas del menú?",
    };
  }

  if (intent === "faq") {
    const kb = matchKnowledge(args.profile, args.text);
    if (!kb) {
      return {
        intent: "out_of_scope",
        confidence: "low",
        handoff: true,
        reply:
          "No quiero inventar esa respuesta. Te paso con el equipo para que te den el dato exacto.",
      };
    }
    return { intent, confidence, handoff: false, reply: kb };
  }

  if (intent === "booking") {
    if (
      args.confirmStartIso &&
      canConfirmSlot({
        offeredStarts: args.previouslyOffered.map((s) => s.startIso),
        confirmStartIso: args.confirmStartIso,
      })
    ) {
      return {
        intent,
        confidence: "high",
        handoff: false,
        confirmSlotStartIso: args.confirmStartIso,
        reply: `Listo — quedó reservado para ${args.confirmStartIso}. Si necesitas cambiarla, escríbenos.`,
        notes: ["booking_confirmed"],
      };
    }

    // Offer only explicit demo slots (never invent open-ended availability).
    const offerSlots: OfferedSlot[] =
      args.previouslyOffered.length > 0
        ? args.previouslyOffered
        : args.profile.vertical === "barbershop"
          ? [
              {
                startIso: "2026-10-14T15:00:00-05:00",
                durationMin: 45,
                stylistId: "alex",
                label: "Martes 3:00 pm con Alex",
              },
              {
                startIso: "2026-10-14T17:30:00-05:00",
                durationMin: 45,
                stylistId: "sam",
                label: "Martes 5:30 pm con Sam",
              },
            ]
          : [
              {
                startIso: "2026-10-14T19:00:00-05:00",
                durationMin: 120,
                label: "Martes 7:00 pm — mesa cena",
              },
              {
                startIso: "2026-10-15T13:00:00-05:00",
                durationMin: 90,
                label: "Miércoles 1:00 pm — almuerzo",
              },
            ];

    return {
      intent,
      confidence,
      handoff: false,
      offerSlots,
      reply:
        `Puedo ofrecerte estos horarios reales:\n` +
        offerSlots.map((s, i) => `${i + 1}. ${s.label}`).join("\n") +
        `\nResponde con el número para confirmar. No reservo nada que no esté en esta lista.`,
      notes: ["slots_offered"],
    };
  }

  if (intent === "cancel" || intent === "reschedule") {
    return {
      intent,
      confidence,
      handoff: true,
      reply:
        "Para cancelar o mover una reserva prefiero pasarte con el equipo y evitar errores.",
    };
  }

  const kb = matchKnowledge(args.profile, args.text);
  if (kb) {
    return { intent: "faq", confidence: "medium", handoff: false, reply: kb };
  }

  return {
    intent: "unknown",
    confidence: "low",
    handoff: true,
    reply:
      "No estoy seguro de esa consulta con la información del negocio. Te conecto con una persona.",
  };
}
