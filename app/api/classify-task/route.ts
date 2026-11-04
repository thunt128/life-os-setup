import { NextResponse } from "next/server";
import { askClaudeForJson } from "@/lib/anthropic";

export const runtime = "nodejs";

// The categories match the comment on `tasks.category` in supabase/schema.sql.
const CATEGORIES = [
  "legal",
  "finance",
  "content",
  "products",
  "opsec",
  "business",
] as const;

type ClassifyResult = { category: string; priority: number };

/**
 * POST /api/classify-task
 * Body: { content: string }
 * Returns: { category, priority } — category is one of CATEGORIES,
 * priority is 0 (low) .. 3 (urgent).
 */
export async function POST(req: Request) {
  try {
    const { content } = await req.json();
    if (!content || typeof content !== "string") {
      return NextResponse.json(
        { error: "Missing 'content' string." },
        { status: 400 }
      );
    }

    const result = await askClaudeForJson<ClassifyResult>({
      maxTokens: 128,
      system:
        "You classify a single personal task for a solo founder's life dashboard. " +
        `Reply with ONLY a JSON object: {"category": one of ${CATEGORIES.join(
          " | "
        )}, "priority": integer 0-3}. ` +
        "priority: 3 = urgent/time-sensitive, 2 = important, 1 = normal, 0 = someday. " +
        "No prose, no code fences.",
      user: `Task: ${content}`,
    });

    // Validate / clamp the model output so a bad response can't corrupt a row.
    const category = CATEGORIES.includes(result?.category as never)
      ? result.category
      : "business";
    let priority = Number(result?.priority);
    if (!Number.isFinite(priority)) priority = 1;
    priority = Math.max(0, Math.min(3, Math.round(priority)));

    return NextResponse.json({ category, priority });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Classification failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
