import { NextResponse } from "next/server";
import { getClaude, CLAUDE_MODEL, textFromMessage } from "@/lib/anthropic";

// Turns a raw journal transcript (typed or, later, voice-dictated) into a
// short reflective summary. Writes nothing to the database — the caller
// decides whether to save the returned summary into journal.ai_summary.
export async function POST(req: Request) {
  const claude = getClaude();
  if (!claude) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set — add it to .env.local (see Phase 3)." },
      { status: 503 }
    );
  }

  let transcript = "";
  try {
    ({ transcript } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!transcript || typeof transcript !== "string") {
    return NextResponse.json({ error: "Missing 'transcript'." }, { status: 400 });
  }

  try {
    const msg = await claude.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      output_config: { effort: "low" },
      system:
        "You are the journaling assistant inside a personal life OS. " +
        "Summarize the day's transcript in 2-4 short sentences, written in the " +
        "second person ('You ...'). Capture the key events, the mood/energy, and " +
        "any pattern worth noticing. Be concise and non-judgmental. Return plain " +
        "text only — no markdown headings, no preamble.",
      messages: [{ role: "user", content: transcript }],
    });

    const summary = textFromMessage(msg.content);
    return NextResponse.json({ summary });
  } catch (err) {
    console.error("summarize error:", err);
    return NextResponse.json({ error: "Summarize failed." }, { status: 500 });
  }
}
