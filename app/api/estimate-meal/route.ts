import { NextRequest, NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { complete, parseJson } from "@/lib/anthropic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MealEstimate = { meal: string; calories: number; protein: number };

const ALLOWED_MEDIA = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
type MediaType = (typeof ALLOWED_MEDIA)[number];

export async function POST(req: NextRequest) {
  try {
    const { description, image, mediaType } = (await req.json()) as {
      description?: string;
      image?: string; // base64, no data: prefix
      mediaType?: string;
    };

    if ((!description || !description.trim()) && !image) {
      return NextResponse.json(
        { error: "Provide a meal description or a photo." },
        { status: 400 }
      );
    }

    // Build a multimodal user message: optional photo + the text prompt.
    const blocks: Anthropic.ContentBlockParam[] = [];
    if (image) {
      const media: MediaType = ALLOWED_MEDIA.includes(mediaType as MediaType)
        ? (mediaType as MediaType)
        : "image/jpeg";
      blocks.push({
        type: "image",
        source: { type: "base64", media_type: media, data: image },
      });
    }
    blocks.push({
      type: "text",
      text: description?.trim()
        ? `Meal: ${description.trim()}`
        : "Identify this meal from the photo.",
    });

    const text = await complete({
      system:
        "You estimate the nutrition of a single meal for a personal health tracker. " +
        "Give a short meal label, and your best estimate of total calories (kcal) and " +
        "protein (grams) as integers. If a photo is given, estimate a typical serving. " +
        'Respond with ONLY compact JSON: {"meal": "<short label>", "calories": <int>, "protein": <int>}. ' +
        "No prose, no code fence.",
      content: blocks,
      maxTokens: 512,
      effort: "low",
    });

    const parsed = parseJson<MealEstimate>(text);
    const result: MealEstimate = {
      meal: String(parsed.meal || description || "Meal").slice(0, 120),
      calories: Math.max(0, Math.round(Number(parsed.calories) || 0)),
      protein: Math.max(0, Math.round(Number(parsed.protein) || 0)),
    };

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Estimate failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
