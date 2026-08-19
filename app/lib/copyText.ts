"use client";

/**
 * Copy text to the clipboard, with a fallback for the contexts PerkOS actually
 * runs in.
 *
 * `navigator.clipboard` is unavailable or rejects inside embedded webviews
 * (Farcaster and Base App host the mini app in one), on insecure origins, and
 * whenever the permission is denied. The previous call sites swallowed that
 * rejection with an empty `.catch()`, so a failed copy looked identical to
 * nothing happening at all — no feedback, no error, no copied text.
 *
 * Returns whether the text actually made it to the clipboard so the caller can
 * tell the user the truth either way.
 */
export async function copyText(text: string): Promise<boolean> {
  if (!text) return false;

  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the legacy path rather than giving up.
  }

  try {
    if (typeof document === "undefined") return false;
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    // Keep it off-screen but still selectable; `display:none` cannot be copied.
    area.style.position = "fixed";
    area.style.top = "0";
    area.style.left = "0";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    area.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}
