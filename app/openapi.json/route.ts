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
