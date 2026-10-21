import { NextResponse } from "next/server";
import { anthropic, MODEL, textOf, hasKey } from "@/lib/anthropic";

export const runtime = "nodejs";

type AskTask = {
  content: string;
  category?: string | null;
  priority?: number;
  starred?: boolean;
  view?: string;
};

/**
 * Answer a free-form question about the user's day using their live task rows.
 * This powers the bottom "Ask" bar — e.g. "what are the top 3 things I should
 * do right now?".
 * Body: { question: string, tasks: AskTask[] }
 * Returns: { answer }
 */
export async function POST(req: Request) {
  if (!hasKey()) {
    return NextResponse.json(
      { error: "No ANTHROPIC_API_KEY configured on the server." },
      { status: 503 }
    );
  }

  let question = "";
  let tasks: AskTask[] = [];
  try {
    const body = await req.json();
    question = String(body?.question ?? "").trim();
    if (Array.isArray(body?.tasks)) tasks = body.tasks as AskTask[];
  } catch {
    /* fall through */
  }
  if (!question) {
    return NextResponse.json({ error: "Ask a question." }, { status: 400 });
  }

  // Render the task list as a compact, readable block for the model.
  const taskLines = tasks.length
    ? tasks
        .map((t) => {
          const bits = [
            t.starred ? "★" : "·",
            `[${t.category ?? "uncategorized"}]`,
            `p${t.priority ?? 0}`,
            t.view ? `(${t.view})` : "",
            t.content,
          ];
          return bits.filter(Boolean).join(" ");
        })
        .join("\n")
    : "(no active tasks)";

  try {
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      output_config: { effort: "medium" },
      system:
        "You are the user's personal operations assistant inside their life " +
        "dashboard. Answer using their task list below. Be direct and " +
        "actionable. When they ask what to do, recommend specific tasks from " +
        "the list and say briefly why, favoring starred and higher-priority " +
        "items. Keep it short — a tight numbered or bulleted list, no preamble.",
      messages: [
        {
          role: "user",
          content: `My current tasks:\n${taskLines}\n\nQuestion: ${question}`,
        },
      ],
    });

    return NextResponse.json({ answer: textOf(message) });
  } catch (err) {
    console.error("ask error", err);
    return NextResponse.json(
      { error: "Could not reach your OS brain right now." },
      { status: 502 }
    );
  }
}
