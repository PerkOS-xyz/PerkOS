/**
 * Profile-avatar uploads → Firebase Storage (client-direct, like
 * uploadAttachment). The image is downscaled to a small square-ish webp in the
 * browser first so avatars stay tiny (fast loads, cheap storage), then written
 * to a wallet-scoped path the storage rules gate to the owner:
 *
 *   avatars/{wallet}/avatar-{ts}.webp
 *
 * Only the returned download URL is persisted on the profile doc.
 */
import imageCompression from "browser-image-compression";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

import { firebaseStorage } from "./firebase";

/** Hard cap AFTER downscale — mirrors the storage.rules limit. */
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

export async function uploadAvatar(input: {
  file: File;
  walletAddress: string;
}): Promise<string> {
  const { file } = input;
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose an image file.");
  }

  // Downscale + re-encode to webp: 256px longest edge is plenty for a circle.
  const compressed = await imageCompression(file, {
    maxWidthOrHeight: 256,
    maxSizeMB: 0.3,
    useWebWorker: true,
    fileType: "image/webp",
  });
  if (compressed.size > MAX_AVATAR_BYTES) {
    throw new Error("Image is too large after processing.");
  }

  const wallet = input.walletAddress.toLowerCase();
  const path = `avatars/${wallet}/avatar-${Date.now()}.webp`;
  const storageRef = ref(firebaseStorage(), path);
  await uploadBytes(storageRef, compressed, { contentType: "image/webp" });
  return getDownloadURL(storageRef);
}
