import Anthropic from "@anthropic-ai/sdk";

/**
 * Shared Anthropic (Claude) client for server-side route handlers.
 *
 * The API key is read from ANTHROPIC_API_KEY and NEVER exposed to the
 * browser — these helpers only run in app/api/* route handlers, which
 * execute on the server. If the key is missing we throw a clear error
 * so the API routes can return a friendly 500 instead of crashing.
 */

export const CLAUDE_MODEL =
  process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-5-5";

let client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to .env.local (see .env.local.example)."
    );
  }
  if (!client) {
    client = new Anthropic({ apiKey });
  }
  return client;
}

/**
 * Ask Claude for a single JSON object and parse it.
 *
 * We force a low temperature and ask the model to reply with raw JSON.
 * The model occasionally wraps JSON in ```json fences, so we strip those
 * before parsing. Throws if the response can't be parsed as JSON.
 */
export async function askClaudeForJson<T>(opts: {
  system: string;
  user: string | Anthropic.Messages.ContentBlockParam[];
  maxTokens?: number;
}): Promise<T> {
  const anthropic = getAnthropic();
  const message = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: opts.maxTokens ?? 512,
    temperature: 0,
    system: opts.system,
    messages: [
      {
        role: "user",
        content: opts.user,
      },
    ],
  });

  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  return parseJson<T>(text);
}

/** Ask Claude for a plain-text answer. */
export async function askClaudeForText(opts: {
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<string> {
  const anthropic = getAnthropic();
  const message = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: opts.maxTokens ?? 512,
    temperature: 0.2,
    system: opts.system,
    messages: [{ role: "user", content: opts.user }],
  });

  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

function parseJson<T>(text: string): T {
  let cleaned = text.trim();
  // Strip ```json ... ``` or ``` ... ``` fences if present.
  const fence = cleaned.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fence) cleaned = fence[1].trim();
  // Fall back to the first {...} block if there's leading/trailing prose.
  if (!cleaned.startsWith("{") && !cleaned.startsWith("[")) {
    const brace = cleaned.indexOf("{");
    const bracket = cleaned.indexOf("[");
    const start =
      brace === -1 ? bracket : bracket === -1 ? brace : Math.min(brace, bracket);
    if (start >= 0) cleaned = cleaned.slice(start);
  }
  return JSON.parse(cleaned) as T;
}
