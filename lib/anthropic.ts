import Anthropic from "@anthropic-ai/sdk";

// Server-only Anthropic client. The key lives in ANTHROPIC_API_KEY and must
// never reach the browser — every call that uses this goes through an
// /app/api route handler (server side), never a client component.
//
// We create it lazily so that importing this module doesn't throw at build
// time when the key isn't set (e.g. during `next build` without secrets).

let _client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to .env.local (see .env.local.example)."
    );
  }
  if (!_client) {
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

// The model every Phase 3 feature uses. One place to change it.
export const MODEL = "claude-opus-5-5";

// Pull the first block of plain text out of a Messages API response.
export function firstText(message: Anthropic.Message): string {
  for (const block of message.content) {
    if (block.type === "text") return block.text;
  }
  return "";
}

// Many of our prompts ask Claude to return a single JSON object. Models
// occasionally wrap it in prose or a ```json fence, so pull the first
// balanced {...} out of the text before parsing.
export function extractJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("No JSON object found in model response.");
  }
  return JSON.parse(candidate.slice(start, end + 1)) as T;
}
