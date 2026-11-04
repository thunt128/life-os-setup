import { NextResponse } from "next/server";
import { askClaudeForText } from "@/lib/anthropic";

export const runtime = "nodejs";

/**
 * POST /api/summarize-journal
 * Body: { transcript: string }
 * Returns: { summary } — a tight 2-3 sentence reflection of the day.
 */
export async function POST(req: Request) {
  try {
    const { transcript } = await req.json();
    if (!transcript || typeof transcript !== "string") {
      return NextResponse.json(
        { error: "Missing 'transcript' string." },
        { status: 400 }
      );
    }

    const summary = await askClaudeForText({
      maxTokens: 300,
      system:
        "You are a concise journaling assistant. Given a raw brain-dump of someone's day, " +
        "write a calm, second-person summary in 2-3 short sentences. " +
        "Capture what happened, the mood, and any pattern or lesson worth noticing. " +
        "No preamble, no bullet points, no headings — just the summary.",
      user: transcript,
    });

    return NextResponse.json({ summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Summarization failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
