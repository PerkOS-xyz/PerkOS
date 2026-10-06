/** Anything a person types text into, including ARIA widgets and editors. */
const TYPING_SELECTOR = [
  "input",
  "textarea",
  "select",
  "[contenteditable]:not([contenteditable='false'])",
  "[role='textbox']",
  "[role='searchbox']",
  "[role='combobox']",
].join(", ");

/**
 * Plain-letter shortcuts ("g p", "c o") only fire when nothing on the page
 * holds focus. Words typed while a field, button, link or embedded widget
 * still has focus (for example right after clicking Send) are text, so they
 * must never navigate away from what the person was doing.
 */
export function letterShortcutAllowed(
  e: Pick<KeyboardEvent, "target" | "isComposing" | "repeat">,
  doc: Document = document,
): boolean {
  if (e.isComposing || e.repeat) return false;
  if (e.target instanceof Element && e.target.closest(TYPING_SELECTOR)) return false;
  const active = doc.activeElement;
  return !active || active === doc.body || active === doc.documentElement;
}
