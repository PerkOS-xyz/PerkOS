/**
 * GET /auth.md — the root path readiness scanners actually probe.
 *
 * The document was published only at /.well-known/auth.md, which is the tidier
 * location and the one a person would guess. Scanners fetch the root, so the
 * document existed and still read as missing. Both paths now serve the same
 * source.
 */
import { authMarkdownResponse } from "../lib/authMarkdown";

export const dynamic = "force-static";

export function GET(): Response {
  return authMarkdownResponse();
}
