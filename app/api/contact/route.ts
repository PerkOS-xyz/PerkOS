import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import { adminDb } from "../../lib/firebaseAdmin";
import {
  CONTACT_EMAIL_TO,
  escapeHtml,
  sendEmail,
} from "../../lib/email";

type Payload = {
  name: string;
  email: string;
  subject: string;
  message: string;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  let body: Partial<Payload>;
  try {
    body = (await request.json()) as Partial<Payload>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = body.name?.trim();
  const email = body.email?.trim();
  const subject = body.subject?.trim();
  const message = body.message?.trim();

  if (!name || !email || !subject || !message) {
    return NextResponse.json(
      { error: "All fields are required" },
      { status: 400 }
    );
  }
  if (!EMAIL_REGEX.test(email)) {
    return NextResponse.json(
      { error: "Invalid email format" },
      { status: 400 }
    );
  }

  const trimmedMessage = message.slice(0, 5000);

  await adminDb()
    .collection("contact_messages")
    .add({
      name,
      email,
      subject,
      message: trimmedMessage,
      status: "new",
      createdAt: FieldValue.serverTimestamp(),
    });

  // Notify the team. Non-fatal: the message is already persisted, so a
  // delivery failure shouldn't fail the request.
  await sendEmail({
    to: CONTACT_EMAIL_TO,
    subject: `[Contact] ${subject}`,
    replyTo: email,
    html: `
      <p><strong>From:</strong> ${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;</p>
      <p><strong>Subject:</strong> ${escapeHtml(subject)}</p>
      <hr />
      <p style="white-space:pre-wrap">${escapeHtml(trimmedMessage)}</p>
    `,
  });

  return NextResponse.json({ ok: true });
}
