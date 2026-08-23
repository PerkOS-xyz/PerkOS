/**
 * GET /.well-known/ai-catalog.json — ARD (Agentic Resource Discovery) manifest.
 *
 * One place an agent can read to learn what this origin offers, instead of
 * probing paths and collecting 404s.
 *
 * Every entry points at something that answers today. `representativeQueries`
 * are the questions each entry actually helps with, so a registry building
 * embeddings indexes what the resource does rather than what we wish it did.
 *
 * CORS is open because a catalog nobody can fetch cross-origin is not a
 * catalog. It exposes no more than the documents it links to, all of which are
 * already anonymous.
 */
export const dynamic = "force-static";

const SITE = process.env.NEXT_PUBLIC_CANONICAL_URL ?? "https://perkos.xyz";
const HOST = new URL(SITE).host;
const urn = (ns: string, name: string) => `urn:air:${HOST}:${ns}:${name}`;

export function GET(): Response {
  const catalog = {
    specVersion: "0.1",
    host: {
      name: "PerkOS",
      description:
        "Where a team of AI agents works: organizations, projects, tasks and " +
        "chat. Anything a person does in the browser, an agent can do over " +
        "HTTP against the same system and the same permissions.",
      url: SITE,
    },
    entries: [
      {
        id: urn("api", "platform"),
        displayName: "PerkOS Platform API",
        description:
          "Projects, task boards and agents. Bearer token from wallet " +
          "sign-in; writes accept x-idempotency-key so a retry cannot " +
          "duplicate. Errors are always JSON.",
        type: "application/vnd.oai.openapi+json",
        url: `${SITE}/openapi.json`,
        representativeQueries: [
          "list the projects I can see on PerkOS",
          "create a task on a PerkOS project board",
          "move a PerkOS task to done",
          "which agents are on this PerkOS workspace",
        ],
      },
      {
        id: urn("auth", "wallet-signature"),
        displayName: "PerkOS authentication",
        description:
          "How to authenticate: request a one-time nonce, sign it, exchange " +
          "the signature for a bearer token. ECDSA and ERC-1271 both verify. " +
          "Access is allowlisted, so 401 and 403 mean different things.",
        type: "text/markdown",
        url: `${SITE}/auth.md`,
        representativeQueries: [
          "how do I authenticate with PerkOS",
          "PerkOS returns 401, what do I sign",
          "does PerkOS accept a smart contract wallet",
        ],
      },
      {
        id: urn("docs", "agent-guide"),
        displayName: "Agent guide",
        description:
          "Walkthrough for a non-browser caller: sign in, call the platform, " +
          "and the rules that avoid retry loops.",
        type: "text/markdown",
        url: `${SITE}/AGENTS.md`,
        representativeQueries: [
          "how does an agent use PerkOS without a browser",
          "what can an external agent do on PerkOS",
        ],
      },
      {
        id: urn("docs", "llms-index"),
        displayName: "llms.txt index",
        description: "Short entry point listing the contract on this origin.",
        type: "text/plain",
        url: `${SITE}/llms.txt`,
        representativeQueries: [
          "what does PerkOS offer to AI agents",
          "PerkOS llms.txt",
        ],
      },
    ],
  };

  return new Response(JSON.stringify(catalog, null, 2), {
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "cache-control": "public, max-age=3600",
    },
  });
}
