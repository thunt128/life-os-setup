import { NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropic, MODEL, firstText, extractJson } from "@/lib/anthropic";

export const runtime = "nodejs";

type MediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";
const MEDIA_TYPES: MediaType[] = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

type Estimate = { meal: string; calories: number; protein: number };

// POST /api/nutrition
// Body: { meal?: string, imageBase64?: string, mediaType?: string }
// Estimates calories + protein for a meal from a text description and/or a
// photo. Returns: { meal, calories, protein }.
export async function POST(req: Request) {
  try {
    const { meal, imageBase64, mediaType } = (await req.json()) as {
      meal?: string;
      imageBase64?: string;
      mediaType?: string;
    };

    const description = (meal ?? "").trim();
    const hasImage = typeof imageBase64 === "string" && imageBase64.length > 0;
    if (!description && !hasImage) {
      return NextResponse.json(
        { error: "Provide a meal description or a photo." },
        { status: 400 }
      );
    }

    const content: Anthropic.ContentBlockParam[] = [];
    if (hasImage) {
      const mt: MediaType = MEDIA_TYPES.includes(mediaType as MediaType)
        ? (mediaType as MediaType)
        : "image/jpeg";
      content.push({
        type: "image",
        source: { type: "base64", media_type: mt, data: imageBase64 as string },
      });
    }
    content.push({
      type: "text",
      text: description
        ? `Meal: ${description}`
        : "Estimate the nutrition for the meal in this photo.",
    });

    const client = getAnthropic();
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 256,
      system:
        "You estimate the nutrition of a single meal for a food log. " +
        "Give a realistic single best estimate of total calories (kcal) and " +
        "protein (grams) for the whole meal described or pictured. " +
        "Also return a short clean name for the meal (<= 40 chars). " +
        'Respond with ONLY a JSON object: {"meal": "...", "calories": N, "protein": N}.',
      messages: [{ role: "user", content }],
    });

    const parsed = extractJson<Partial<Estimate>>(firstText(message));

    const resultMeal =
      (typeof parsed.meal === "string" && parsed.meal.trim()) ||
      description ||
      "Meal";
    const calories = clampInt(parsed.calories, 0, 10000);
    const protein = clampInt(parsed.protein, 0, 1000);

    return NextResponse.json({ meal: resultMeal, calories, protein });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function clampInt(v: unknown, lo: number, hi: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(lo, Math.min(hi, Math.round(n)));
}
