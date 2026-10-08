import { NextRequest, NextResponse } from "next/server";
import { complete, parseJson } from "@/lib/anthropic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Categories must match supabase/schema.sql (tasks.category) and the Brain
// panel in app/page.tsx.
const CATEGORIES = ["legal", "finance", "content", "products", "opsec", "business"] as const;
type Category = (typeof CATEGORIES)[number];

type Classification = { category: Category; priority: number };

export async function POST(req: NextRequest) {
  try {
    const { content } = (await req.json()) as { content?: string };
    if (!content || !content.trim()) {
      return NextResponse.json({ error: "Missing task content." }, { status: 400 });
    }

    const text = await complete({
      system:
        "You classify a single personal task for a life-operations dashboard. " +
        `Pick the single best category from exactly this list: ${CATEGORIES.join(", ")}. ` +
        "Assign a priority as an integer 0-3 (3 = urgent/high-impact, 0 = someday). " +
        'Respond with ONLY compact JSON: {"category": "<one of the list>", "priority": <0-3>}. ' +
        "No prose, no code fence.",
      content: `Task: ${content.trim()}`,
      maxTokens: 512,
      effort: "low",
    });

    const parsed = parseJson<Classification>(text);
    const category = CATEGORIES.includes(parsed.category) ? parsed.category : "business";
    const priority = Math.min(3, Math.max(0, Math.round(Number(parsed.priority) || 0)));

    return NextResponse.json({ category, priority });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Classification failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
