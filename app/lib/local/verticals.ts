import type { LocalBusinessProfile, LocalVertical } from "./types";

/** Pilot playbooks — replace with DB-backed profiles per tenant later. */

export const BARBERSHOP_PILOT: LocalBusinessProfile = {
  id: "pilot-barbershop",
  name: "Corner Cut Studio",
  vertical: "barbershop",
  timezone: "America/Bogota",
  hoursLabel: "Tue–Sat 10:00–19:00",
  services: [
    { id: "cut", name: "Haircut", durationMin: 45, priceLabel: "45.000 COP" },
    { id: "cut-beard", name: "Haircut + beard", durationMin: 60, priceLabel: "65.000 COP" },
    { id: "beard", name: "Beard trim", durationMin: 25, priceLabel: "25.000 COP" },
  ],
  knowledge: [
    {
      question: "Do you take walk-ins?",
      answer: "We prefer appointments. Walk-ins are welcome if a stylist is free.",
    },
    {
      question: "Where are you?",
      answer: "We will share the pin and arrival notes after you book.",
    },
    {
      question: "Can I choose a stylist?",
      answer: "Yes — tell us who you want and we check their open slots.",
    },
  ],
};

export const RESTAURANT_PILOT: LocalBusinessProfile = {
  id: "pilot-restaurant",
  name: "Mesa Norte",
  vertical: "restaurant",
  timezone: "America/Bogota",
  hoursLabel: "Mon–Sun 12:00–22:00",
  services: [
    { id: "lunch", name: "Lunch table", durationMin: 90, priceLabel: "reservation" },
    { id: "dinner", name: "Dinner table", durationMin: 120, priceLabel: "reservation" },
  ],
  knowledge: [
    {
      question: "Do you have vegetarian options?",
      answer: "Yes — two mains and three starters are vegetarian. Ask for the green marks on the menu.",
    },
    {
      question: "Do you take reservations?",
      answer:
        "Yes for dinner. For same-day lunch we confirm only if a table is actually free — we never invent availability.",
    },
    {
      question: "Allergies?",
      answer: "Tell us the allergy and party size; kitchen confirms before you arrive.",
    },
  ],
};

export const LOCAL_VERTICALS: Record<LocalVertical, LocalBusinessProfile> = {
  barbershop: BARBERSHOP_PILOT,
  restaurant: RESTAURANT_PILOT,
};

export function getPilotProfile(vertical: LocalVertical): LocalBusinessProfile {
  return LOCAL_VERTICALS[vertical];
}
