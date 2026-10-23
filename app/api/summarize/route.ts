import { NextResponse } from "next/server";
import { getClient, CLAUDE_MODEL, textFrom } from "@/lib/anthropic";

// POST /api/summarize  { transcript: string }
//   -> { summary: string }
//
// Summarizes a journal transcript into a short, reflective recap.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { transcript?: unknown };
  const transcript =
    typeof body.transcript === "string" ? body.transcript.trim() : "";
  if (!transcript) {
    return NextResponse.json(
      { error: "Missing journal transcript." },
      { status: 400 }
    );
  }

  const client = getClient();
  if (!client) {
    return NextResponse.json(
      { error: "AI is not configured — set ANTHROPIC_API_KEY in .env.local." },
      { status: 503 }
    );
  }

  try {
    const message = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      system:
        "You are the journaling companion in a personal life dashboard. " +
        "Summarize the user's journal entry in 2-4 concise sentences, written in the " +
        "second person ('You ...'). Capture what happened, the mood, and any notable " +
        "pattern or takeaway. Return plain text only — no headings, no markdown.",
      messages: [{ role: "user", content: transcript }],
    });

    const summary = textFrom(message);
    if (!summary) {
      return NextResponse.json(
        { error: "No summary was produced." },
        { status: 502 }
      );
    }
    return NextResponse.json({ summary });
  } catch {
    return NextResponse.json(
      { error: "The summary request failed. Try again." },
      { status: 502 }
    );
  }
}
