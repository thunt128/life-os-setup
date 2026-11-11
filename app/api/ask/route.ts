import { NextResponse } from "next/server";
import { getAnthropic, MODEL, firstText } from "@/lib/anthropic";

export const runtime = "nodejs";

type AskTask = {
  content: string;
  category?: string | null;
  priority?: number;
  starred?: boolean;
  view?: string;
};

// POST /api/ask
// Body: { question: string, tasks: AskTask[] }
// Answers free-form questions about the user's day using their live task
// rows — e.g. "what are the top 3 things I should do right now?".
export async function POST(req: Request) {
  try {
    const { question, tasks } = (await req.json()) as {
      question?: string;
      tasks?: AskTask[];
    };

    const q = (question ?? "").trim();
    if (!q) {
      return NextResponse.json({ error: "Missing question." }, { status: 400 });
    }

    const rows = Array.isArray(tasks) ? tasks : [];
    const taskList =
      rows.length === 0
        ? "(no active tasks on record)"
        : rows
            .map((t, i) => {
              const bits = [
                t.category ? `category: ${t.category}` : null,
                typeof t.priority === "number" ? `priority: ${t.priority}` : null,
                t.starred ? "starred" : null,
                t.view ? `horizon: ${t.view}` : null,
              ]
                .filter(Boolean)
                .join(", ");
              return `${i + 1}. ${t.content}${bits ? ` [${bits}]` : ""}`;
            })
            .join("\n");

    const client = getAnthropic();
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system:
        "You are the user's personal operations assistant inside a life-OS dashboard. " +
        "Answer using ONLY the task data provided. Be direct, concrete, and brief — " +
        "this renders in a small panel. When asked what to do, prioritise by stated " +
        "priority, whether a task is starred, and its time horizon (today > week > month). " +
        "Prefer a short numbered list. Never invent tasks that aren't in the data.",
      messages: [
        {
          role: "user",
          content: `My current tasks:\n${taskList}\n\nQuestion: ${q}`,
        },
      ],
    });

    return NextResponse.json({ answer: firstText(message).trim() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
