import { afterEach, describe, expect, it } from "vitest";

import { letterShortcutAllowed } from "../app/lib/keyboardShortcuts";

function press(target: EventTarget, extra: Partial<KeyboardEvent> = {}) {
  return { target, isComposing: false, repeat: false, ...extra } as Pick<KeyboardEvent, "target" | "isComposing" | "repeat">;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("letterShortcutAllowed", () => {
  it("allows a shortcut when nothing on the page has focus", () => {
    expect(letterShortcutAllowed(press(document.body))).toBe(true);
  });

  it("treats letters typed right after clicking Send as text", () => {
    const send = document.createElement("button");
    send.textContent = "Send";
    document.body.append(send);
    send.focus();
    expect(letterShortcutAllowed(press(send))).toBe(false);
  });

  it("ignores letters typed in fields and rich editors", () => {
    const input = document.createElement("input");
    const editor = document.createElement("div");
    editor.setAttribute("role", "textbox");
    const inner = document.createElement("span");
    editor.append(inner);
    document.body.append(input, editor);
    expect(letterShortcutAllowed(press(input))).toBe(false);
    expect(letterShortcutAllowed(press(inner))).toBe(false);
  });

  it("ignores held keys and input method composition", () => {
    expect(letterShortcutAllowed(press(document.body, { repeat: true }))).toBe(false);
    expect(letterShortcutAllowed(press(document.body, { isComposing: true }))).toBe(false);
  });
});
