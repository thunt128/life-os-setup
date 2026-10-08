import { NextRequest, NextResponse } from "next/server";
import { complete } from "@/lib/anthropic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TaskInput = {
  content: string;
  category?: string | null;
  priority?: number;
  starred?: boolean;
  status?: string;
  view?: string;
};

export async function POST(req: NextRequest) {
  try {
    const { question, tasks } = (await req.json()) as {
      question?: string;
      tasks?: TaskInput[];
    };

    const active = (tasks ?? []).filter((t) => (t.status ?? "active") === "active");

    if (active.length === 0) {
      return NextResponse.json({
        answer: "You have no active tasks right now. Add a few and ask again.",
      });
    }

    // Compact, line-per-task context so the model reasons over real rows.
    const taskLines = active
      .map((t) => {
        const tags = [
          t.category ? `#${t.category}` : null,
          t.starred ? "starred" : null,
          `p${t.priority ?? 0}`,
          t.view ? t.view : null,
        ]
          .filter(Boolean)
          .join(" ");
        return `- ${t.content} (${tags})`;
      })
      .join("\n");

    const q = question?.trim() || "What are the top 3 things I should do right now?";

    const answer = await complete({
      system:
        "You are the decision engine for a personal life-operations dashboard. " +
        "Given the user's active tasks (with #category, priority p0-p3, star flag, and " +
        "today/week/month view), answer their question concisely and decisively. " +
        "When they ask for the top things to do, return a short numbered list (max 3), " +
        "each line one task plus a few words on why. Favor starred and higher-priority " +
        "tasks and anything in the 'today' view. Keep it under 120 words. Plain text.",
      content: `Active tasks:\n${taskLines}\n\nQuestion: ${q}`,
      maxTokens: 1024,
      effort: "medium",
    });

    return NextResponse.json({ answer });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ask failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
