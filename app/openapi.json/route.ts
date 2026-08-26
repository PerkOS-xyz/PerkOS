/**
 * GET /openapi.json — description of the endpoints an agent can actually call.
 *
 * Only paths verified to answer on this origin. An OpenAPI document that lists
 * an endpoint which 404s is worse than no document: the caller trusts it and
 * burns retries.
 */
export const dynamic = "force-static";

const SITE = process.env.NEXT_PUBLIC_CANONICAL_URL ?? "https://perkos.xyz";

const ERROR_RESPONSE = {
  description: "Error. Always JSON, never an HTML page.",
  content: {
    "application/json": {
      schema: {
        type: "object",
        properties: {
          error: {
            type: "object",
            properties: {
              message: { type: "string" },
              code: { type: "string" },
            },
          },
        },
      },
    },
  },
};

export function GET(): Response {
  const doc = {
    openapi: "3.1.0",
    // Optional in the payment discovery draft, and the cheapest way for a
    // registry to know what the paid endpoint is for.
    "x-service-info": {
      categories: ["ai", "productivity"],
      docs: {
        documentation: `${SITE}/AGENTS.md`,
        authentication: `${SITE}/auth.md`,
      },
    },
    info: {
      title: "PerkOS",
      version: "1.0.0",
      description:
        "Organizations, projects, tasks and chat. Anything a person does in " +
        "the browser, an agent can do here against the same system and the " +
        "same permissions. See /AGENTS.md for the sign-in walkthrough.",
    },
    servers: [{ url: SITE }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          description:
            "Token from POST /api/auth/wallet-signin. An address alone proves " +
            "nothing, so you sign a one-time nonce to obtain it.",
        },
      },
      parameters: {
        idempotencyKey: {
          name: "x-idempotency-key",
          in: "header",
          required: false,
          schema: { type: "string" },
          description:
            "Retrying a create with the same key does not duplicate it.",
        },
      },
    },
    paths: {
      "/api/auth/nonce": {
        get: {
          summary: "Request a one-time challenge to sign",
          parameters: [
            {
              name: "address",
              in: "query",
              required: true,
              schema: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" },
            },
          ],
          responses: {
            "200": {
              description: "The exact message to sign, and when it expires.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      nonce: { type: "string" },
                      message: { type: "string" },
                      expiresAt: { type: "string", format: "date-time" },
                    },
                  },
                },
              },
            },
            "400": ERROR_RESPONSE,
          },
        },
      },
      "/api/auth/wallet-signin": {
        post: {
          summary: "Exchange a signature for a token",
          description:
            "Verifies ECDSA and ERC-1271. The nonce is consumed, so replaying " +
            "the same signature fails.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["address", "nonce", "signature"],
                  properties: {
                    address: { type: "string" },
                    nonce: { type: "string" },
                    signature: { type: "string" },
                  },
                },
              },
            },
          },
          responses: { "200": { description: "Token." }, "401": ERROR_RESPONSE },
        },
      },
      "/api/platform/health": {
        get: {
          summary: "Liveness",
          description: "Anonymous. No token required.",
          responses: { "200": { description: "Service is up." } },
        },
      },
      "/api/platform/projects": {
        get: {
          summary: "Projects the caller can see",
          security: [{ bearerAuth: [] }],
          responses: { "200": { description: "Projects." }, "401": ERROR_RESPONSE },
        },
      },
      "/api/platform/projects/{projectId}/tasks": {
        get: {
          summary: "Tasks on a board",
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "projectId", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: { "200": { description: "Tasks." }, "401": ERROR_RESPONSE },
        },
        post: {
          summary: "Create tasks",
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "projectId", in: "path", required: true, schema: { type: "string" } },
            { $ref: "#/components/parameters/idempotencyKey" },
          ],
          responses: { "201": { description: "Created." }, "401": ERROR_RESPONSE },
        },
      },
      /**
       * The paid API. Both offers are real: an agent holding stablecoins pays
       * with x402, one holding cards pays with MPP, and each buys the same
       * answer.
       *
       * The amounts are in the smallest unit of their currency, as the payment
       * discovery draft requires — six decimals for USDC, cents for USD — so
       * the same price appears as different integers.
       */
      "/api/v1": {
        get: {
          summary: "Ask PerkOS a question, paid per call",
          description:
            "Returns one answer from the PerkOS assistant. No account: the " +
            "payment is the whole relationship. Call it without payment to " +
            "receive the challenges, pay by either rail, and repeat the call. " +
            "Questions outside PerkOS are refused before any payment is taken.",
          parameters: [
            {
              name: "q",
              in: "query",
              required: true,
              schema: { type: "string", maxLength: 2000 },
              description: "The question. Required, and checked before anything is charged.",
            },
          ],
          /**
           * Both forms of the extension, deliberately.
           *
           * The draft defines a single-offer shorthand and a multi-offer
           * array, says servers SHOULD publish the array, and says clients
           * MUST accept either. Readers exist that implement only the
           * shorthand and report a document using the array as declaring no
           * payment at all, so publishing both makes this readable by more of
           * them than the array alone.
           *
           * Nothing is duplicated dishonestly: the shorthand describes the
           * card offer, which is the one an MPP client can actually use — it
           * cannot settle an x402 offer. A reader that understands both may
           * see the card terms twice, which costs it nothing because they are
           * the same terms.
           */
          "x-payment-info": {
            intent: "charge",
            method: "stripe",
            amount: "1",
            currency: "usd",
            description: "One answer, paid by card over MPP.",
            offers: [
              {
                intent: "charge",
                method: "stripe",
                amount: "1",
                currency: "usd",
                description: "One answer, paid by card over MPP.",
              },
              {
                intent: "charge",
                method: "x402",
                amount: "10000",
                currency: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
                description: "One answer, paid in USDC on Base over x402.",
              },
              {
                intent: "charge",
                method: "x402",
                amount: "10000",
                currency: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C",
                description: "One answer, paid in USDC on Celo over x402.",
              },
            ],
          },
          responses: {
            "200": {
              description: "The answer.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      data: {
                        type: "object",
                        properties: {
                          reply: { type: "string" },
                          agent: { type: "string" },
                          paidWith: { type: "string" },
                        },
                      },
                    },
                  },
                },
              },
            },
            "402": { description: "Payment Required" },
            "422": {
              description:
                "Outside what the assistant answers. Nothing was charged: the " +
                "body says so explicitly.",
            },
            "400": ERROR_RESPONSE,
          },
        },
      },
      /**
       * The one endpoint here that takes money, and the only one an
       * unfunded caller can usefully reach.
       *
       * It is documented with x402's own 402-then-retry shape rather than an
       * MPP `x-payment-info` block. That extension enumerates its methods as
       * tempo, stripe, lightning and card; PerkOS settles EIP-3009 stablecoin
       * transfers through its own facilitator, so declaring one of those would
       * send an agent to pay over rails that do not exist here.
       */
      "/api/platform/billing/deposit/x402": {
        post: {
          summary: "Fund a wallet with USDC, no session required",
          description:
            "Two steps. Call it without an X-PAYMENT header to receive the " +
            "payment requirements, then sign an EIP-3009 authorization, " +
            "base64 it, and repeat the call with the header. Credit goes to " +
            "the address that signed the payment, so no bearer token is " +
            "needed and a wallet in the body is ignored. Funding a wallet is " +
            "what lets an otherwise unknown address sign in.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["network", "amount"],
                  properties: {
                    network: { type: "string", enum: ["base", "celo"] },
                    amount: {
                      type: "number",
                      description: "Stablecoin amount. The minimum to sign in is returned by the sign-in 402.",
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Settled and credited.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ok: { type: "boolean" },
                      wallet: { type: "string", description: "The address that signed the payment." },
                      creditsUsd: { type: "number" },
                      transaction: { type: "string" },
                    },
                  },
                },
              },
            },
            "402": {
              description:
                "The x402 payment requirements. Not an error: this is the " +
                "expected first response, and it carries what to pay.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      x402Version: { type: "integer", enum: [1] },
                      accepts: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            scheme: { type: "string", enum: ["exact"] },
                            network: { type: "string" },
                            maxAmountRequired: { type: "string", description: "Base units." },
                            payTo: { type: "string" },
                            asset: { type: "string", description: "Token contract." },
                            resource: { type: "string" },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            "400": ERROR_RESPONSE,
          },
        },
      },
      "/api/platform/agents": {
        get: {
          summary: "Agents the caller can see",
          security: [{ bearerAuth: [] }],
          responses: { "200": { description: "Agents." }, "401": ERROR_RESPONSE },
        },
      },
    },
  };

  return new Response(JSON.stringify(doc, null, 2), {
    headers: {
      "content-type": "application/json",
      "cache-control": "public, max-age=3600",
    },
  });
}
