import { NextResponse } from "next/server";
import { getClient, CLAUDE_MODEL, textFrom } from "@/lib/anthropic";

// POST /api/ask  { question: string, tasks: TaskLite[] }
//   -> { answer: string }
//
// Answers a free-form question (e.g. "what are the top 3 things I should do
// right now?") using the user's live task rows, which the browser sends along
// so the server stays stateless and needs only ANTHROPIC_API_KEY.
type TaskLite = {
  content: string;
  category: string | null;
  priority: number;
  starred: boolean;
  status: string;
  view: string;
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    question?: unknown;
    tasks?: unknown;
  };
  const question =
    typeof body.question === "string" ? body.question.trim() : "";
  const tasks = Array.isArray(body.tasks) ? (body.tasks as TaskLite[]) : [];
  if (!question) {
    return NextResponse.json({ error: "Ask a question." }, { status: 400 });
  }

  const client = getClient();
  if (!client) {
    return NextResponse.json(
      { error: "AI is not configured — set ANTHROPIC_API_KEY in .env.local." },
      { status: 503 }
    );
  }

  // Compact the active tasks into a readable list for the model.
  const active = tasks
    .filter((t) => t && t.status === "active")
    .map((t) => {
      const bits = [
        `priority ${t.priority ?? 0}`,
        t.category ? `category ${t.category}` : "uncategorized",
        t.view ? `bucket ${t.view}` : null,
        t.starred ? "starred" : null,
      ].filter(Boolean);
      return `- ${t.content} (${bits.join(", ")})`;
    })
    .join("\n");

  const taskBlock = active || "(no active tasks)";

  try {
    const message = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      system:
        "You are the operations assistant inside a solo operator's life dashboard. " +
        "Answer using the user's current tasks below. Be direct and concrete. " +
        "When asked what to do, recommend a short, ranked shortlist (usually the top 3) " +
        "and give a one-line reason for each, factoring in priority and category. " +
        "If there are no tasks, say so briefly. Keep it tight — plain text, no markdown.\n\n" +
        `CURRENT TASKS:\n${taskBlock}`,
      messages: [{ role: "user", content: question }],
    });

    const answer = textFrom(message);
    if (!answer) {
      return NextResponse.json(
        { error: "No answer was produced." },
        { status: 502 }
      );
    }
    return NextResponse.json({ answer });
  } catch {
    return NextResponse.json(
      { error: "The request failed. Try again." },
      { status: 502 }
    );
  }
}
