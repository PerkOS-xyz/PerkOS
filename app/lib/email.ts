/**
 * Server-side transactional email via Resend.
 *
 * Used by the public form handlers (/api/contact, /api/request-access)
 * to notify the team. Kept deliberately tolerant: if RESEND_API is
 * unset (local dev, preview) we log and no-op instead of throwing, so
 * a missing key never turns a successful Firestore write into a 500.
 *
 * Env:
 *   RESEND_API        — Resend API key (re_…). Required to actually send.
 *   EMAIL_FROM        — sender, defaults to "PerkOS <noreply@perkos.xyz>".
 *   CONTACT_EMAIL_TO  — contact form recipient, defaults to contact@perkos.xyz.
 *   ACCESS_EMAIL_TO   — access-request recipient, defaults to access@perkos.xyz.
 */

import { Resend } from "resend";

const DEFAULT_FROM = "PerkOS <noreply@perkos.xyz>";

let client: Resend | null = null;

function resend(): Resend | null {
  const key = process.env.RESEND_API;
  if (!key) return null;
  if (!client) client = new Resend(key);
  return client;
}

export const CONTACT_EMAIL_TO =
  process.env.CONTACT_EMAIL_TO ?? "contact@perkos.xyz";
export const ACCESS_EMAIL_TO =
  process.env.ACCESS_EMAIL_TO ?? "access@perkos.xyz";

type SendArgs = {
  to: string;
  subject: string;
  html: string;
  /** Reply-To, so a team member can answer the submitter directly. */
  replyTo?: string;
};

/**
 * Send a notification email. Returns true on success, false when
 * skipped (no key) or on a delivery error — callers should treat a
 * false as non-fatal (the data is already persisted in Firestore).
 */
export async function sendEmail({
  to,
  subject,
  html,
  replyTo,
}: SendArgs): Promise<boolean> {
  const r = resend();
  if (!r) {
    console.warn(
      `[email] RESEND_API unset — skipping email "${subject}" to ${to}`,
    );
    return false;
  }

  try {
    const { error } = await r.emails.send({
      from: process.env.EMAIL_FROM ?? DEFAULT_FROM,
      to,
      subject,
      html,
      ...(replyTo ? { replyTo } : {}),
    });
    if (error) {
      console.error(`[email] Resend rejected "${subject}":`, error);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[email] failed to send "${subject}":`, err);
    return false;
  }
}

/** Minimal HTML escaping for interpolating user input into the body. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
