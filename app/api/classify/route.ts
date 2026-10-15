import { NextResponse } from "next/server";
import { getClaude, CLAUDE_MODEL, parseJsonFromMessage } from "@/lib/anthropic";

// The category set mirrors supabase/schema.sql (tasks.category) and the
// "Brain · Life Categories" panel on the dashboard.
const CATEGORIES = [
  "legal",
  "finance",
  "content",
  "products",
  "opsec",
  "business",
] as const;

type ClassifyResult = {
  category: (typeof CATEGORIES)[number];
  priority: number; // 0 (low) .. 3 (urgent)
};

export async function POST(req: Request) {
  const claude = getClaude();
  if (!claude) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set — add it to .env.local (see Phase 3)." },
      { status: 503 }
    );
  }

  let content = "";
  try {
    ({ content } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!content || typeof content !== "string") {
    return NextResponse.json({ error: "Missing 'content'." }, { status: 400 });
  }

  try {
    const msg = await claude.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 256,
      output_config: { effort: "low" },
      system:
        "You classify a single personal task into one life category and a priority. " +
        `Categories (pick exactly one): ${CATEGORIES.join(", ")}. ` +
        "Priority is an integer 0-3: 0 = someday, 1 = normal, 2 = important, 3 = urgent. " +
        'Reply with ONLY a JSON object: {"category": "...", "priority": 0}. No prose.',
      messages: [{ role: "user", content: `Task: ${content}` }],
    });

    const result = parseJsonFromMessage<ClassifyResult>(msg.content);

    // Guard the model output against the schema's constraints.
    const category = CATEGORIES.includes(result.category) ? result.category : "business";
    const priority = Math.max(0, Math.min(3, Math.round(Number(result.priority) || 0)));

    return NextResponse.json({ category, priority });
  } catch (err) {
    console.error("classify error:", err);
    return NextResponse.json({ error: "Classification failed." }, { status: 500 });
  }
}
