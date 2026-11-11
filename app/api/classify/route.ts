import { NextResponse } from "next/server";
import { getAnthropic, MODEL, firstText, extractJson } from "@/lib/anthropic";

export const runtime = "nodejs";

// The category set mirrors the comment on the `tasks` table in
// supabase/schema.sql.
const CATEGORIES = [
  "legal",
  "finance",
  "content",
  "products",
  "opsec",
  "business",
] as const;
type Category = (typeof CATEGORIES)[number];

type Classification = { category: Category; priority: number };

// POST /api/classify
// Body: { content: string }
// Returns: { category, priority } — priority is 0..3 (3 = most urgent).
export async function POST(req: Request) {
  try {
    const { content } = (await req.json()) as { content?: string };
    const text = (content ?? "").trim();
    if (!text) {
      return NextResponse.json({ error: "Missing content." }, { status: 400 });
    }

    const client = getAnthropic();
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 256,
      system:
        "You classify a single to-do item for a personal life-OS dashboard. " +
        `Choose exactly one category from: ${CATEGORIES.join(", ")}. ` +
        "Assign a priority integer from 0 to 3 (3 = urgent/time-sensitive, " +
        "2 = important, 1 = normal, 0 = someday). " +
        'Respond with ONLY a JSON object: {"category": "...", "priority": N}.',
      messages: [{ role: "user", content: `Task: ${text}` }],
    });

    const parsed = extractJson<Partial<Classification>>(firstText(message));

    const category: Category = CATEGORIES.includes(parsed.category as Category)
      ? (parsed.category as Category)
      : "business";
    let priority = Number(parsed.priority);
    if (!Number.isFinite(priority)) priority = 1;
    priority = Math.max(0, Math.min(3, Math.round(priority)));

    return NextResponse.json({ category, priority });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
