/**
 * GET /.well-known/agent-card.json — A2A Agent Card.
 *
 * Describes PerkOS, the product assistant, as an agent another agent can talk
 * to. Discovery per the A2A spec: fetch this card, then call the `url` it
 * advertises.
 *
 * The skills listed are what the assistant genuinely answers today — product
 * help for PerkOS App and Desktop. Its scope guard (askPerkosPolicy on the
 * API) refuses anything outside that BEFORE reaching the model, so claiming
 * broader skills here would advertise refusals.
 *
 * Display name is "PerkOS"; the technical id stays `ask-perkos-agent`
 * everywhere it is keyed.
 */
export const dynamic = "force-static";

const SITE = process.env.NEXT_PUBLIC_CANONICAL_URL ?? "https://perkos.xyz";

export function GET(): Response {
  const card = {
    protocolVersion: "0.3.0",
    name: "PerkOS",
    description:
      "The PerkOS product assistant. Answers questions about using PerkOS " +
      "App and Desktop: getting in, organizations and projects, task boards, " +
      "the agents on your team, chat, and settings.",
    url: `${SITE}/api/a2a`,
    preferredTransport: "JSONRPC",
    version: "1.0.0",
    provider: { organization: "PerkOS", url: SITE },
    documentationUrl: `${SITE}/AGENTS.md`,
    capabilities: {
      streaming: false,
      pushNotifications: false,
      stateTransitionHistory: false,
    },
    // Bearer from the wallet-signature flow. There is no OAuth issuer on this
    // origin, so the card points at the document that describes what exists
    // rather than naming a scheme a caller cannot complete.
    securitySchemes: {
      bearer: {
        type: "http",
        scheme: "bearer",
        description: `Token from the wallet-signature flow. See ${SITE}/auth.md`,
      },
    },
    security: [{ bearer: [] }],
    defaultInputModes: ["text/plain"],
    defaultOutputModes: ["text/plain"],
    skills: [
      {
        id: "perkos-app-help",
        name: "PerkOS App guidance",
        description:
          "Explains how PerkOS App works and how to do a thing in it: " +
          "organizations, projects, task boards, adding and inviting agents, " +
          "chat, members and settings.",
        tags: ["support", "product", "how-to"],
        examples: [
          "How do I create a project in PerkOS?",
          "What is the difference between an invited agent and one PerkOS runs?",
          "How do I add someone from my team to an organization?",
          "Where do I see the tasks assigned to an agent?",
        ],
      },
      {
        id: "perkos-troubleshooting",
        name: "PerkOS troubleshooting",
        description:
          "Helps work out why something in PerkOS App is not behaving: " +
          "signing in, wallet connection, an agent that looks offline, a task " +
          "that is not moving.",
        tags: ["support", "troubleshooting"],
        examples: [
          "My agent shows Runtime unverified, what does that mean?",
          "I signed in but I cannot see my organization's projects.",
          "Why is a task still in Backlog after I assigned it?",
        ],
      },
    ],
  };

  return new Response(JSON.stringify(card, null, 2), {
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "cache-control": "public, max-age=3600",
    },
  });
}
