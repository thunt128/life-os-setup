import { NextResponse } from "next/server";
import {
  anthropic,
  MODEL,
  CATEGORIES,
  textOf,
  parseJson,
  hasKey,
} from "@/lib/anthropic";

export const runtime = "nodejs";

type ClassifyResult = { category: string | null; priority: number };

/**
 * Classify a task into one of the six life categories and a priority (0–5).
 * Body: { content: string }
 * Returns: { category, priority }
 *
 * On any failure (no key, bad model output) it returns a safe default so the
 * caller can still save the task — AI classification is an enhancement, not a
 * gate on adding work.
 */
export async function POST(req: Request) {
  const fallback: ClassifyResult = { category: null, priority: 0 };

  if (!hasKey()) {
    return NextResponse.json(fallback);
  }

  let content = "";
  try {
    const body = await req.json();
    content = String(body?.content ?? "").trim();
  } catch {
    /* fall through to validation below */
  }
  if (!content) {
    return NextResponse.json(
      { error: "Missing task content." },
      { status: 400 }
    );
  }

  try {
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 256,
      output_config: { effort: "low" },
      system:
        "You classify a single personal task for a life-management dashboard. " +
        `Choose exactly one category from: ${CATEGORIES.join(", ")}. ` +
        "Choose a priority from 0 (someday) to 5 (urgent, do now). " +
        'Reply with ONLY a JSON object: {"category": "<one of the list>", "priority": <0-5>}. ' +
        "No prose, no markdown.",
      messages: [{ role: "user", content }],
    });

    const parsed = parseJson<ClassifyResult>(textOf(message));
    const category =
      parsed && CATEGORIES.includes(parsed.category as never)
        ? parsed.category
        : null;
    const priority =
      parsed && Number.isFinite(parsed.priority)
        ? Math.max(0, Math.min(5, Math.round(Number(parsed.priority))))
        : 0;

    return NextResponse.json({ category, priority });
  } catch (err) {
    console.error("classify error", err);
    return NextResponse.json(fallback);
  }
}
