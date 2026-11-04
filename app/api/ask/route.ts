import { NextResponse } from "next/server";
import { askClaudeForText } from "@/lib/anthropic";

export const runtime = "nodejs";

type TaskInput = {
  content: string;
  category?: string | null;
  priority?: number | null;
  starred?: boolean | null;
  view?: string | null;
};

/**
 * POST /api/ask
 * Body: { question?: string, tasks: TaskInput[] }
 * The client passes the user's active tasks (we don't fetch server-side so we
 * don't need the service-role key here). Returns: { answer } — a short,
 * prioritized reply. Default question is "top 3 things to do right now".
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const question: string =
      typeof body?.question === "string" && body.question.trim()
        ? body.question.trim()
        : "What are the top 3 things I should do right now?";
    const tasks: TaskInput[] = Array.isArray(body?.tasks) ? body.tasks : [];

    if (tasks.length === 0) {
      return NextResponse.json({
        answer:
          "You have no active tasks right now. Add a few to your dashboard and ask again.",
      });
    }

    const taskList = tasks
      .map((t, i) => {
        const bits = [
          t.category ? `[${t.category}]` : null,
          t.priority != null ? `p${t.priority}` : null,
          t.starred ? "★" : null,
          t.view ? `(${t.view})` : null,
        ]
          .filter(Boolean)
          .join(" ");
        return `${i + 1}. ${t.content}${bits ? ` — ${bits}` : ""}`;
      })
      .join("\n");

    const answer = await askClaudeForText({
      maxTokens: 400,
      system:
        "You are the user's personal operations assistant. You are given their " +
        "current active tasks (with category, priority p0-p3, ★ = starred/key, " +
        "and the time horizon). Answer their question directly and briefly. " +
        "When asked what to do, pick the highest-leverage items, put them in order, " +
        "and give one short reason each. Be decisive. Use a numbered list, no preamble.",
      user: `My active tasks:\n${taskList}\n\nQuestion: ${question}`,
    });

    return NextResponse.json({ answer });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ask failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
