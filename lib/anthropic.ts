import Anthropic from "@anthropic-ai/sdk";

/**
 * Server-only Anthropic client.
 *
 * The ANTHROPIC_API_KEY lives in .env.local and is NEVER exposed to the
 * browser — every call to Claude goes through a route handler in app/api/*.
 *
 * To swap models later, change CLAUDE_MODEL. We default to Opus (Anthropic's
 * most capable widely-available model); if you'd rather trade some quality for
 * much lower cost on these lightweight classify/summarize calls, switch to
 * "claude-sonnet-5-5" or "claude-haiku-5-5".
 */
export const CLAUDE_MODEL = "claude-opus-5-5";

let cached: Anthropic | null = null;

/** Returns a shared client, or null if no API key is configured. */
export function getClaude(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!cached) cached = new Anthropic();
  return cached;
}

/**
 * Pulls the first text block out of a Messages API response and parses it as
 * JSON. Claude occasionally wraps JSON in ```json fences or adds a stray line,
 * so we extract the outermost {...} before parsing.
 */
export function parseJsonFromMessage<T>(content: Anthropic.ContentBlock[]): T {
  const text = content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`No JSON object found in model response: ${text.slice(0, 200)}`);
  }
  return JSON.parse(text.slice(start, end + 1)) as T;
}

/** Collapses the text blocks of a response into a single trimmed string. */
export function textFromMessage(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}
