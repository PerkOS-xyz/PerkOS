/**
 * The JSON Schema the UCP profile points at for our x402 payment handler.
 *
 * The profile references it, so it has to answer: a schema URL that 404s
 * leaves a caller unable to tell a handler it cannot parse from one it
 * fetched wrong.
 */
export const dynamic = "force-static";

const SITE = process.env.NEXT_PUBLIC_CANONICAL_URL ?? "https://perkos.xyz";

export function GET(): Response {
  const schema = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: `${SITE}/.well-known/ucp/x402-handler.schema.json`,
    title: "PerkOS x402 payment handler",
    description:
      "Configuration for paying PerkOS with an EIP-3009 stablecoin transfer " +
      "over x402. Call payment_requirements_url without an X-PAYMENT header " +
      "to receive the requirements, then repeat the call with the signed " +
      "authorization. Credit is applied to the address that signed the " +
      "payment.",
    type: "object",
    required: ["type", "payment_requirements_url", "x402_version"],
    additionalProperties: false,
    properties: {
      type: { const: "X402" },
      payment_requirements_url: {
        type: "string",
        format: "uri",
        description:
          "Answers 402 with the payment requirements. This response is the " +
          "authoritative price; the profile quotes none so it cannot go stale.",
      },
      x402_version: { type: "integer", enum: [1] },
    },
  };

  return new Response(JSON.stringify(schema, null, 2), {
    headers: {
      "content-type": "application/schema+json",
      "access-control-allow-origin": "*",
      "cache-control": "public, max-age=3600",
    },
  });
}
