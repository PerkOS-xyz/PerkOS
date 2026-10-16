# PerkOS Local

Own WhatsApp lane inside PerkOS App for **barbershops/stylists** and **restaurants**.

Inspired by Vocero’s product lessons (Cloud API only, offer-then-confirm slots, lab-before-live, human on low confidence) — **implemented natively in PerkOS**, not as a Vocero dependency.

## Surfaces

| Path | Role |
|---|---|
| `GET/POST /api/local/whatsapp/webhook` | Meta verify + inbound text → turn router → reply |
| `GET /api/local/conversations` | Pilot inbox JSON (in-memory) |
| `/local` | Signed-in inbox UI |
| `/solutions/barbershops` | Marketing page |
| `/solutions/restaurants` | Marketing page (updated copy) |

## Laws

See `app/lib/local/laws.ts`. Booking confirmations require a previously offered slot.

## Configure WhatsApp

1. Create a Meta WhatsApp Cloud API app / phone number.
2. Set env from `.env.example` (`LOCAL_WHATSAPP_*`).
3. Webhook callback URL: `https://<your-host>/api/local/whatsapp/webhook`
4. Verify token must match `LOCAL_WHATSAPP_VERIFY_TOKEN`.
5. `LOCAL_WHATSAPP_DEFAULT_VERTICAL=barbershop` or `restaurant` for the pilot number.

Without `LOCAL_WHATSAPP_ACCESS_TOKEN`, inbound turns are still stored and routed; outbound Graph sends are skipped (useful for unit/dev).

## Status

- Dual-vertical rule-based router (TypeSafe/Jev later)
- In-memory store (Postgres / platform later)
- Lab score gate and multi-number routing: not in this first slice
