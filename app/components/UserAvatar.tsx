"use client";

/**
 * UserAvatar — a person's visual identity everywhere in the product.
 *
 * If the user has an effective avatar image (ENS / basename / custom upload)
 * we render it in a circle; otherwise we draw an address-hashed gradient disc
 * with the wallet's two-letter initials (the human counterpart of AgentOrb).
 *
 * Plain <img> on purpose: ENS/basename avatars come from arbitrary hosts
 * (ipfs gateways, data URIs, third-party CDNs) that we can't enumerate in
 * next.config `images.remotePatterns`, so next/image is the wrong tool here.
 * A broken/blocked image silently falls back to the gradient.
 */
import { useState } from "react";

import { userHue, userInitials } from "../lib/userVisuals";

export function UserAvatar({
  address,
  avatarUrl,
  size = 28,
  className = "",
  title,
}: {
  address?: string | null;
  /** Effective avatar URL (from effectiveAvatarUrl()); null → gradient. */
  avatarUrl?: string | null;
  size?: number;
  className?: string;
  title?: string;
}) {
  // Track the specific URL that failed so a NEW url (e.g. after upload) is
  // retried without an effect — when avatarUrl changes, failedUrl no longer
  // matches, so the image shows again.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  const hue = userHue(address);
  const showImage = !!avatarUrl && failedUrl !== avatarUrl;

  if (showImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- ENS/basename
      // avatars come from arbitrary hosts we can't allowlist for next/image.
      <img
        src={avatarUrl!}
        alt=""
        title={title}
        width={size}
        height={size}
        onError={() => setFailedUrl(avatarUrl!)}
        className={`shrink-0 rounded-full object-cover ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      aria-hidden
      title={title}
      className={`relative inline-grid shrink-0 place-items-center rounded-full ${className}`}
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 30% 30%, hsla(${hue}, 70%, 60%, 0.55), hsla(${hue}, 70%, 35%, 0.25))`,
        boxShadow: `0 0 0 1px hsla(${hue}, 60%, 55%, 0.35)`,
      }}
    >
      <span
        className="font-semibold tracking-tight"
        style={{
          fontSize: Math.max(9, Math.round(size * 0.36)),
          color: `hsla(${hue}, 85%, 88%, 0.95)`,
        }}
      >
        {userInitials(address)}
      </span>
    </span>
  );
}
