import { NextResponse } from "next/server";
import {
  getClient,
  CLAUDE_MODEL,
  CATEGORIES,
  textFrom,
  parseJson,
  clampInt,
  type Category,
} from "@/lib/anthropic";

// POST /api/classify  { content: string }
//   -> { category: Category | null, priority: number }
//
// Classifies a new task into one of the schema categories and a priority.
// Degrades gracefully: if no key is set or anything fails, returns a safe
// default (null category, priority 0) with HTTP 200 so the task still saves.
export async function POST(req: Request) {
  const fallback = { category: null, priority: 0 };

  const body = (await req.json().catch(() => ({}))) as { content?: unknown };
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) {
    return NextResponse.json({ error: "Missing task content." }, { status: 400 });
  }

  const client = getClient();
  if (!client) return NextResponse.json(fallback);

  try {
    const message = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 256,
      system:
        "You classify a single personal task for a solo operator's life dashboard. " +
        `Pick the ONE best category from: ${CATEGORIES.join(", ")}. ` +
        "Also assign an integer priority 0-3 (3 = urgent & important, 2 = important, 1 = normal, 0 = someday). " +
        'Respond with ONLY a JSON object of the form {"category": string, "priority": number}. ' +
        "No prose, no markdown fences.",
      messages: [{ role: "user", content }],
    });

    const parsed = parseJson<{ category?: string; priority?: number }>(
      textFrom(message)
    );
    const category =
      parsed && CATEGORIES.includes(parsed.category as Category)
        ? (parsed.category as Category)
        : null;
    const priority = clampInt(parsed?.priority, 0, 3, 0);
    return NextResponse.json({ category, priority });
  } catch {
    // Any model/transport error → safe default, task still saves.
    return NextResponse.json(fallback);
  }
}
