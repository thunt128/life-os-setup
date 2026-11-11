import { NextResponse } from "next/server";
import { getAnthropic, MODEL, firstText } from "@/lib/anthropic";

export const runtime = "nodejs";

// POST /api/summarize
// Body: { transcript: string }
// Returns: { summary } — a tight reflective summary of a journal entry.
export async function POST(req: Request) {
  try {
    const { transcript } = (await req.json()) as { transcript?: string };
    const text = (transcript ?? "").trim();
    if (!text) {
      return NextResponse.json(
        { error: "Missing transcript." },
        { status: 400 }
      );
    }

    const client = getAnthropic();
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 512,
      system:
        "You summarize a personal daily journal entry. Write 2–4 short sentences " +
        "in the second person ('You...'). Capture what went well, the mood/energy, " +
        "and any pattern or lesson worth remembering. Be warm but concise. " +
        "Return only the summary text — no preamble, no headings.",
      messages: [{ role: "user", content: text }],
    });

    return NextResponse.json({ summary: firstText(message).trim() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
