"use client";

import { useEffect } from "react";

import { useChatbotOptional } from "./ChatbotProvider";

/**
 * Marks the screen as "nothing to cover", which is what makes the floating
 * assistant bubble appear.
 *
 * Rendered by `EmptyState`, so the rule is derived from what is actually on
 * screen instead of from a list of route prefixes. That list was the previous
 * approach and it only ever grew: every time the fixed disc landed on a card
 * another path was added, until the assistant was hidden on almost every page
 * in the product.
 *
 * `EmptyState` itself stays presentational; this is the only client piece.
 */
export function AssistantSpotlight() {
  const chatbot = useChatbotOptional();
  const registerSpotlight = chatbot?.registerSpotlight;
  useEffect(() => registerSpotlight?.(), [registerSpotlight]);
  return null;
}
