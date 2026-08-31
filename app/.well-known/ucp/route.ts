/**
 * GET /.well-known/ucp — the UCP business profile.
 *
 * ## What this profile says, and what it deliberately does not
 *
 * PerkOS takes payments and sells no catalogue. The profile says exactly that:
 * a payment handler, and no shopping service.
 *
 * That shape is available because only `ucp.version` is required — `services`
 * and `capabilities` are optional, and `payment_handlers` is a first-class
 * member of the profile rather than something hanging off a checkout.
 *
 * Declaring a service is not free. Per the specification a business that
 * declares one commits to operating that endpoint over that transport with
 * that schema, so listing `dev.ucp.shopping` here would promise a cart and an
 * order lifecycle that do not exist. UCP also puts metered API access outside
 * its own scope, which is precisely what PerkOS sells, so there is no honest
 * shopping service to name.
 *
 * What is left is true and useful: an agent learns that this origin takes
 * stablecoin payment over x402, on which networks, and where.
 */
export const dynamic = "force-static";

const SITE = process.env.NEXT_PUBLIC_CANONICAL_URL ?? "https://perkos.xyz";

/** The spec release this profile describes itself against. */
const UCP_VERSION = "2026-04-08";

export function GET(): Response {
  const profile = {
    ucp: {
      version: UCP_VERSION,

      /**
       * Reverse-DNS on our own domain because this handler is ours, not one
       * of UCP's standard ones. Naming it under `dev.ucp.` would imply it
       * behaves like a handler the specification defines.
       */
      payment_handlers: {
        "xyz.perkos.x402": [
          {
            id: "x402",
            version: UCP_VERSION,
            spec: `${SITE}/auth.md`,
            schema: `${SITE}/.well-known/ucp/x402-handler.schema.json`,
            available_instruments: [
              {
                type: "stablecoin",
                constraints: {
                  scheme: "x402",
                  asset: "USDC",
                  networks: ["base", "celo"],
                },
              },
            ],
            config: {
              type: "X402",
              /**
               * Ask this endpoint without a payment header and it answers 402
               * with the requirements to satisfy. That response is the
               * authoritative price, so none is quoted here: a number in this
               * document would go stale the moment the rate changed.
               */
              payment_requirements_url: `${SITE}/api/platform/billing/deposit/x402`,
              x402_version: 1,
            },
          },
        ],
      },
    },
  };

  return new Response(JSON.stringify(profile, null, 2), {
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "cache-control": "public, max-age=3600",
    },
  });
}
