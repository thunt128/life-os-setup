import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { anthropic, MODEL, textOf, parseJson, hasKey } from "@/lib/anthropic";

export const runtime = "nodejs";

type NutritionResult = { calories: number; protein: number };

const MEDIA_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const;
type MediaType = (typeof MEDIA_TYPES)[number];

/**
 * Estimate calories + protein from a meal description and/or a photo.
 * Body: { meal?: string, image?: { data: string (base64), mediaType: string } }
 * Returns: { calories, protein }
 */
export async function POST(req: Request) {
  if (!hasKey()) {
    return NextResponse.json(
      { error: "No ANTHROPIC_API_KEY configured on the server." },
      { status: 503 }
    );
  }

  let meal = "";
  let image: { data?: string; mediaType?: string } | undefined;
  try {
    const body = await req.json();
    meal = String(body?.meal ?? "").trim();
    image = body?.image;
  } catch {
    /* fall through */
  }

  const hasImage = !!image?.data;
  if (!meal && !hasImage) {
    return NextResponse.json(
      { error: "Describe a meal or attach a photo." },
      { status: 400 }
    );
  }

  // Build the user content: optional image block first, then the text prompt.
  const userContent: Anthropic.ContentBlockParam[] = [];
  if (hasImage) {
    const mediaType: MediaType = MEDIA_TYPES.includes(
      image!.mediaType as MediaType
    )
      ? (image!.mediaType as MediaType)
      : "image/jpeg";
    userContent.push({
      type: "image",
      source: { type: "base64", media_type: mediaType, data: image!.data! },
    });
  }
  userContent.push({
    type: "text",
    text: meal
      ? `Meal: ${meal}`
      : "Estimate the nutrition for the meal in this photo.",
  });

  try {
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 256,
      output_config: { effort: "low" },
      system:
        "You estimate the nutrition of a single meal for a personal food log. " +
        "Give your best whole-number estimate of total calories (kcal) and " +
        "total protein (grams). When unsure, estimate a typical portion. " +
        'Reply with ONLY a JSON object: {"calories": <int>, "protein": <int>}. ' +
        "No prose, no markdown.",
      messages: [{ role: "user", content: userContent }],
    });

    const parsed = parseJson<NutritionResult>(textOf(message));
    const calories =
      parsed && Number.isFinite(parsed.calories)
        ? Math.max(0, Math.round(Number(parsed.calories)))
        : 0;
    const protein =
      parsed && Number.isFinite(parsed.protein)
        ? Math.max(0, Math.round(Number(parsed.protein)))
        : 0;

    return NextResponse.json({ calories, protein });
  } catch (err) {
    console.error("nutrition error", err);
    return NextResponse.json(
      { error: "Could not estimate nutrition right now." },
      { status: 502 }
    );
  }
}
