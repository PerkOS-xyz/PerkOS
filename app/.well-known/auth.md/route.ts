/**
 * GET /.well-known/auth.md — the conventional location.
 *
 * Same document as /auth.md, from one source. See app/lib/authMarkdown.ts.
 */
import { authMarkdownResponse } from "../../lib/authMarkdown";

export const dynamic = "force-static";

export function GET(): Response {
  return authMarkdownResponse();
}
