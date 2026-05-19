/**
 * Tiny LLM provider abstraction. Server-side only.
 *
 * Picks a provider per call based on either:
 *  - the agent's BYOK key (stored in /agent_secrets), or
 *  - the PerkOS-managed env keys (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`).
 *
 * Two surfaces:
 *  - `complete(...)`  — returns the full reply string
 *  - `stream(...)`    — async-iterates token chunks
 *
 * If neither a BYOK key nor a managed key is configured, we fall back to a
 * stub reply so the UI flow stays testable in dev without API credentials.
 */

export type LlmMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type LlmProviderKind = "openai" | "anthropic" | "stub";

type ProviderConfig = {
  kind: LlmProviderKind;
  apiKey?: string;
  model: string;
};

function pickProvider(byokKey?: string | null): ProviderConfig {
  if (byokKey) {
    if (byokKey.startsWith("sk-ant-")) {
      return { kind: "anthropic", apiKey: byokKey, model: "claude-sonnet-4-5" };
    }
    if (byokKey.startsWith("sk-or-")) {
      // OpenRouter is OpenAI-compatible. Treat as OpenAI with a different
      // base URL — we just use the OpenAI path here.
      return { kind: "openai", apiKey: byokKey, model: "openai/gpt-4o-mini" };
    }
    return { kind: "openai", apiKey: byokKey, model: "gpt-4o-mini" };
  }

  if (process.env.OPENAI_API_KEY) {
    return {
      kind: "openai",
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    };
  }

  if (process.env.ANTHROPIC_API_KEY) {
    return {
      kind: "anthropic",
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5",
    };
  }

  return { kind: "stub", model: "stub" };
}

export async function complete(input: {
  byokKey?: string | null;
  systemPrompt?: string;
  messages: LlmMessage[];
}): Promise<string> {
  const provider = pickProvider(input.byokKey);
  const messages = input.systemPrompt
    ? [{ role: "system" as const, content: input.systemPrompt }, ...input.messages]
    : input.messages;

  if (provider.kind === "stub") {
    const last = input.messages[input.messages.length - 1];
    return `[stub reply — no LLM key configured]\n\nYou said: ${last?.content ?? "(nothing)"}`;
  }

  if (provider.kind === "openai") {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${provider.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: provider.model,
        messages,
      }),
    });
    if (!res.ok) {
      throw new Error(`OpenAI error ${res.status}: ${await res.text()}`);
    }
    const json = (await res.json()) as {
      choices: { message: { content: string } }[];
    };
    return json.choices[0]?.message?.content ?? "";
  }

  // anthropic
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": provider.apiKey!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: provider.model,
      max_tokens: 1024,
      system: input.systemPrompt,
      messages: messages
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role, content: m.content })),
    }),
  });
  if (!res.ok) {
    throw new Error(`Anthropic error ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as {
    content: { type: "text"; text: string }[];
  };
  return json.content.find((c) => c.type === "text")?.text ?? "";
}

/**
 * Stream chunks as Server-Sent Events frames. The caller writes them to the
 * HTTP response.
 *
 * Yields strings that are the JSON body of each `data:` frame, EXCLUDING the
 * trailing `\n\n` — let the caller add separators.
 */
export async function* stream(input: {
  byokKey?: string | null;
  systemPrompt?: string;
  messages: LlmMessage[];
}): AsyncIterable<{ chunk?: string; reply?: string; done?: boolean }> {
  const provider = pickProvider(input.byokKey);

  if (provider.kind === "stub") {
    // Stub: split a canned reply into a few chunks
    const last = input.messages[input.messages.length - 1];
    const full = `[stub reply] You said: ${last?.content ?? "(nothing)"}`;
    for (const piece of full.match(/.{1,12}/g) ?? []) {
      yield { chunk: piece };
      await new Promise((r) => setTimeout(r, 30));
    }
    yield { reply: full, done: true };
    return;
  }

  if (provider.kind === "openai") {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${provider.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: provider.model,
        stream: true,
        messages: input.systemPrompt
          ? [
              { role: "system", content: input.systemPrompt },
              ...input.messages,
            ]
          : input.messages,
      }),
    });
    if (!res.ok || !res.body) {
      throw new Error(`OpenAI error ${res.status}: ${await res.text()}`);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let assembled = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let sep = buffer.indexOf("\n\n");
      while (sep !== -1) {
        const raw = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        sep = buffer.indexOf("\n\n");

        const line = raw
          .split("\n")
          .map((l) => l.trim())
          .find((l) => l.startsWith("data:"));
        if (!line) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const parsed = JSON.parse(payload) as {
            choices?: { delta?: { content?: string } }[];
          };
          const piece = parsed.choices?.[0]?.delta?.content;
          if (piece) {
            assembled += piece;
            yield { chunk: piece };
          }
        } catch {
          // ignore
        }
      }
    }
    yield { reply: assembled, done: true };
    return;
  }

  // anthropic streaming
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": provider.apiKey!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: provider.model,
      max_tokens: 1024,
      stream: true,
      system: input.systemPrompt,
      messages: input.messages
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role, content: m.content })),
    }),
  });
  if (!res.ok || !res.body) {
    throw new Error(`Anthropic error ${res.status}: ${await res.text()}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let assembled = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sep = buffer.indexOf("\n\n");
    while (sep !== -1) {
      const raw = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      sep = buffer.indexOf("\n\n");

      const dataLine = raw
        .split("\n")
        .map((l) => l.trim())
        .find((l) => l.startsWith("data:"));
      if (!dataLine) continue;
      const payload = dataLine.slice(5).trim();
      if (!payload) continue;
      try {
        const parsed = JSON.parse(payload) as {
          type: string;
          delta?: { type?: string; text?: string };
        };
        if (parsed.type === "content_block_delta" && parsed.delta?.text) {
          assembled += parsed.delta.text;
          yield { chunk: parsed.delta.text };
        }
      } catch {
        // ignore
      }
    }
  }
  yield { reply: assembled, done: true };
}
