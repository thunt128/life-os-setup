import { NextResponse } from "next/server";
import { anthropic, MODEL, textOf, hasKey } from "@/lib/anthropic";

export const runtime = "nodejs";

/**
 * Summarize a journal transcript into a few tight sentences.
 * Body: { transcript: string }
 * Returns: { summary }
 */
export async function POST(req: Request) {
  if (!hasKey()) {
    return NextResponse.json(
      { error: "No ANTHROPIC_API_KEY configured on the server." },
      { status: 503 }
    );
  }

  let transcript = "";
  try {
    const body = await req.json();
    transcript = String(body?.transcript ?? "").trim();
  } catch {
    /* fall through */
  }
  if (!transcript) {
    return NextResponse.json(
      { error: "Missing transcript." },
      { status: 400 }
    );
  }

  try {
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 512,
      output_config: { effort: "low" },
      system:
        "You summarize a personal daily journal entry for the author's own " +
        "review. Write 2–4 plain sentences capturing what happened, the mood, " +
        "and any patterns or follow-ups worth noting. Second person, warm but " +
        "concise. Return only the summary text — no preamble, no markdown.",
      messages: [{ role: "user", content: transcript }],
    });

    return NextResponse.json({ summary: textOf(message) });
  } catch (err) {
    console.error("summarize error", err);
    return NextResponse.json(
      { error: "Could not summarize right now." },
      { status: 502 }
    );
  }
}
