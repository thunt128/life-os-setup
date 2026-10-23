import Anthropic from "@anthropic-ai/sdk";

// ------------------------------------------------------------------
//  Server-only Claude helper (Phase 3).
//  Imported from API route handlers under app/api/* — never from the
//  browser, so ANTHROPIC_API_KEY stays on the server.
//
//  Change the model in ONE place here. For these lightweight calls you
//  could switch to "claude-haiku-5-5" to trade a little quality for much
//  lower cost/latency.
// ------------------------------------------------------------------

export const CLAUDE_MODEL = "claude-opus-5-5";

// The six task categories, kept in sync with supabase/schema.sql.
export const CATEGORIES = [
  "legal",
  "finance",
  "content",
  "products",
  "opsec",
  "business",
] as const;
export type Category = (typeof CATEGORIES)[number];

// Returns a client, or null when no key is configured. Routes use the
// null case to degrade gracefully instead of throwing.
export function getClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  return new Anthropic({ apiKey });
}

// Join all text blocks of a response into one trimmed string.
export function textFrom(message: Anthropic.Message): string {
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

// Parse a JSON object out of model output, tolerating ```json fences or
// surrounding prose. Returns null if nothing parseable is found.
export function parseJson<T>(raw: string): T | null {
  const cleaned = raw
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

// Clamp a value to an integer in [min, max], falling back to `fallback`
// for non-numbers.
export function clampInt(
  value: unknown,
  min: number,
  max: number,
  fallback: number
): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}
