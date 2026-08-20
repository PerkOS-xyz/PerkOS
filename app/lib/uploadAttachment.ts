/**
 * Chat attachment uploads → Firebase Storage.
 *
 * Files are stored under a wallet-scoped path so the storage rules can
 * enforce per-wallet isolation (only the owner uploads; reads are public
 * via the download URL, which is what we embed in the message text).
 *
 *   attachments/{wallet}/{conversationId}/{ts}-{safeName}
 *
 * The attachment travels with the message as markdown appended to the
 * body (image → ![name](url), other → [name](url)), which keeps the
 * C-hybrid chat contract intact (no new message schema) and renders in
 * the existing Markdown view + reaches the agent as a plain URL.
 */
import {
  getDownloadURL,
  ref,
  uploadBytes,
} from "firebase/storage";

import { firebaseStorage } from "./firebase";

/** 25 MB — generous for docs/images, well under Storage defaults. */
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

export type Attachment = {
  name: string;
  url: string;
  contentType: string;
  isImage: boolean;
  size: number;
};

function sanitizeName(name: string): string {
  // Keep it filesystem/URL friendly; collapse anything odd to "_".
  const cleaned = name.replace(/[^\w.\-]+/g, "_").slice(-80);
  return cleaned || "file";
}

/**
 * Render an attachment as the markdown we append to a message or task prompt.
 *
 * Takes the minimum it needs rather than a full `Attachment`, so a task
 * attachment (whose metadata fields are optional, matching the API schema)
 * renders through the same function.
 */
export function attachmentMarkdown(a: {
  name: string;
  url: string;
  isImage?: boolean;
  // Callers pass the full attachment; only these three matter here.
  [extra: string]: unknown;
}): string {
  return a.isImage ? `![${a.name}](${a.url})` : `[📎 ${a.name}](${a.url})`;
}

export function isImageFile(file: Pick<File, "type">): boolean {
  return file.type.startsWith("image/");
}

export function assertImageAttachment(file: Pick<File, "name" | "type">): void {
  if (!isImageFile(file)) {
    throw new Error(`"${file.name}" is not an image`);
  }
}

export async function uploadAttachment(input: {
  file: File;
  walletAddress: string;
  conversationId: string;
  /** Monotonic-ish suffix so two files in the same ms don't collide. */
  index?: number;
}): Promise<Attachment> {
  const { file, walletAddress, conversationId, index = 0 } = input;

  // Chat attachments are images only — the agent consumes them as markdown
  // context. Extra media types stay out of the picker and the uploader.
  assertImageAttachment(file);

  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error(
      `"${file.name}" is too large (max ${Math.round(MAX_ATTACHMENT_BYTES / 1024 / 1024)} MB)`,
    );
  }

  const wallet = walletAddress.toLowerCase();
  const stamp = `${Date.now()}-${index}`;
  const path = `attachments/${wallet}/${conversationId}/${stamp}-${sanitizeName(file.name)}`;
  const storageRef = ref(firebaseStorage(), path);

  const contentType = file.type || "application/octet-stream";
  await uploadBytes(storageRef, file, { contentType });
  const url = await getDownloadURL(storageRef);

  return {
    name: file.name,
    url,
    contentType,
    isImage: contentType.startsWith("image/"),
    size: file.size,
  };
}
