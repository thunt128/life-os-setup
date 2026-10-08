import { NextRequest, NextResponse } from "next/server";
import { complete } from "@/lib/anthropic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { transcript } = (await req.json()) as { transcript?: string };
    if (!transcript || !transcript.trim()) {
      return NextResponse.json({ error: "Missing transcript." }, { status: 400 });
    }

    const summary = await complete({
      system:
        "You summarize a personal daily journal entry for the author's own review. " +
        "Write 2-4 tight sentences in the second person ('you'). Capture what happened, " +
        "the mood/energy, and any notable patterns or follow-ups. Plain text only — no headings, no bullets.",
      content: transcript.trim(),
      maxTokens: 1024,
      effort: "low",
    });

    return NextResponse.json({ summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Summary failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
