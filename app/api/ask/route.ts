import { NextResponse } from "next/server";
import { getClaude, CLAUDE_MODEL, textFromMessage } from "@/lib/anthropic";

type AskTask = {
  content: string;
  category?: string | null;
  priority?: number | null;
  starred?: boolean | null;
  view?: string | null;
};

// The bottom "Ask your OS" bar. The client sends the live task rows it already
// loaded (so the API key stays server-side and we don't re-query Supabase),
// plus the free-text question. Defaults to a "top 3 right now" prompt.
export async function POST(req: Request) {
  const claude = getClaude();
  if (!claude) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set — add it to .env.local (see Phase 3)." },
      { status: 503 }
    );
  }

  let question = "";
  let tasks: AskTask[] = [];
  try {
    const body = await req.json();
    question = body.question ?? "";
    tasks = Array.isArray(body.tasks) ? body.tasks : [];
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const q =
    (typeof question === "string" && question.trim()) ||
    "What are the top 3 things I should do right now?";

  // Compact, bounded view of the task list for the prompt.
  const taskLines = tasks
    .slice(0, 100)
    .map((t) => {
      const bits = [
        t.starred ? "★" : "·",
        t.content,
        t.category ? `[${t.category}]` : "",
        typeof t.priority === "number" ? `(p${t.priority})` : "",
        t.view ? `{${t.view}}` : "",
      ].filter(Boolean);
      return "- " + bits.join(" ");
    })
    .join("\n");

  const context = taskLines
    ? `Here are my active tasks (★ = starred, pN = priority 0-3, {today/week/month} = horizon):\n${taskLines}`
    : "I currently have no active tasks logged.";

  try {
    const msg = await claude.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      output_config: { effort: "medium" },
      system:
        "You are the decision co-pilot inside a personal life OS. The user asks a " +
        "question about what to focus on; answer using ONLY their task list below. " +
        "Be direct and specific. When asked for a 'top N', return a short numbered " +
        "list, each item naming the actual task plus one clause of reasoning " +
        "(priority, starred, or horizon). Keep the whole answer under ~120 words. " +
        "Plain text only.",
      messages: [{ role: "user", content: `${context}\n\nQuestion: ${q}` }],
    });

    const answer = textFromMessage(msg.content);
    return NextResponse.json({ answer });
  } catch (err) {
    console.error("ask error:", err);
    return NextResponse.json({ error: "Ask failed." }, { status: 500 });
  }
}
