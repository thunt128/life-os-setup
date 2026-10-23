import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  getClient,
  CLAUDE_MODEL,
  textFrom,
  parseJson,
  clampInt,
} from "@/lib/anthropic";

// POST /api/nutrition
//   { description?: string, image?: { data: string (base64), mediaType: string } }
//   -> { meal: string, calories: number, protein: number }
//
// Estimates calories + protein from a meal description, a photo, or both.
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    description?: unknown;
    image?: { data?: unknown; mediaType?: unknown };
  };
  const description =
    typeof body.description === "string" ? body.description.trim() : "";
  const imageData =
    typeof body.image?.data === "string" ? body.image.data : "";
  const mediaType =
    typeof body.image?.mediaType === "string" ? body.image.mediaType : "";

  if (!description && !imageData) {
    return NextResponse.json(
      { error: "Describe the meal or attach a photo." },
      { status: 400 }
    );
  }
  if (imageData && !IMAGE_TYPES.includes(mediaType)) {
    return NextResponse.json(
      { error: "Unsupported image type." },
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

  const content: Anthropic.ContentBlockParam[] = [];
  if (imageData) {
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: mediaType as
          | "image/png"
          | "image/jpeg"
          | "image/gif"
          | "image/webp",
        data: imageData,
      },
    });
  }
  content.push({
    type: "text",
    text: description
      ? `Meal: ${description}`
      : "Estimate the meal shown in the photo.",
  });

  try {
    const message = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 256,
      system:
        "You estimate nutrition for a single meal in a personal health tracker. " +
        "From the description and/or photo, give a short meal label and your best " +
        "estimate of total calories (kcal) and protein (grams) for the whole portion. " +
        'Respond with ONLY a JSON object: {"meal": string, "calories": number, "protein": number}. ' +
        "Use whole numbers. No prose, no markdown fences.",
      messages: [{ role: "user", content }],
    });

    const parsed = parseJson<{
      meal?: string;
      calories?: number;
      protein?: number;
    }>(textFrom(message));

    const meal =
      (typeof parsed?.meal === "string" && parsed.meal.trim()) ||
      description ||
      "Meal";
    const calories = clampInt(parsed?.calories, 0, 10000, 0);
    const protein = clampInt(parsed?.protein, 0, 1000, 0);
    return NextResponse.json({ meal, calories, protein });
  } catch {
    return NextResponse.json(
      { error: "The estimate request failed. Try again." },
      { status: 502 }
    );
  }
}
