import Anthropic from "@anthropic-ai/sdk";

/**
 * Server-only Anthropic client + helpers for the Phase 3 AI features.
 *
 * The ANTHROPIC_API_KEY lives in .env.local and is only ever read on the
 * server (inside the /app/api route handlers) — it is never shipped to the
 * browser. Call these helpers from route handlers, not from client code.
 */

// Default model. Opus is the most capable; for this lightweight personal tool
// you can drop to a cheaper/faster model (e.g. claude-haiku-5-5 or
// claude-sonnet-5-5) by setting ANTHROPIC_MODEL in .env.local.
export const CLAUDE_MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";

let client: Anthropic | null = null;

/** Lazily construct the client so a missing key fails per-request, not at import. */
export function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to .env.local (see .env.local.example)."
    );
  }
  if (!client) client = new Anthropic({ apiKey });
  return client;
}

type Effort = "low" | "medium" | "high" | "xhigh" | "max";

/**
 * One-shot text completion. Adaptive thinking is on (default on Opus); we keep
 * effort low by default because these are small, latency-sensitive tasks.
 * Returns the concatenated text of the response.
 */
export async function complete(opts: {
  system: string;
  content: Anthropic.MessageParam["content"];
  maxTokens?: number;
  effort?: Effort;
}): Promise<string> {
  const anthropic = getClient();
  const message = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: opts.maxTokens ?? 1024,
    thinking: { type: "adaptive" },
    output_config: { effort: opts.effort ?? "low" },
    system: opts.system,
    messages: [{ role: "user", content: opts.content }],
  });
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

/**
 * Pull the first JSON object/array out of a model reply and parse it.
 * Models sometimes wrap JSON in prose or ```json fences; this is tolerant of both.
 * Throws if nothing parseable is found.
 */
export function parseJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : text).trim();
  try {
    return JSON.parse(candidate) as T;
  } catch {
    const start = candidate.search(/[{[]/);
    const end = Math.max(candidate.lastIndexOf("}"), candidate.lastIndexOf("]"));
    if (start !== -1 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1)) as T;
    }
    throw new Error("Could not parse JSON from model response.");
  }
}
