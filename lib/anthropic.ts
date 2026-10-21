import Anthropic from "@anthropic-ai/sdk";

// One shared Anthropic client for the server.
//
// This is imported ONLY from route handlers under app/api/* — never from a
// "use client" component — so the ANTHROPIC_API_KEY stays on the server and is
// never shipped to the browser.
export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// The model every Life OS AI feature uses. One place to change it.
export const MODEL = "claude-opus-5-5";

// The six life categories, kept in sync with the `category` column note in
// supabase/schema.sql. The classifier is constrained to this set.
export const CATEGORIES = [
  "legal",
  "finance",
  "content",
  "products",
  "opsec",
  "business",
] as const;

export type Category = (typeof CATEGORIES)[number];

/**
 * Pull the plain text out of a Messages API response.
 * Claude Opus 5.5 streams thinking blocks too, so we keep only the text.
 */
export function textOf(message: Anthropic.Message): string {
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

/**
 * Parse the first JSON object out of a model response, tolerating stray prose
 * or markdown fences around it. Returns null if nothing parseable is found.
 */
export function parseJson<T>(text: string): T | null {
  const fenced = text.replace(/```(?:json)?/gi, "").trim();
  const start = fenced.indexOf("{");
  const end = fenced.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(fenced.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

/** True when the server has an Anthropic key configured. */
export function hasKey(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}
