import { NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { askClaudeForJson } from "@/lib/anthropic";

export const runtime = "nodejs";

type MealResult = { meal: string; calories: number; protein: number };

/**
 * POST /api/estimate-meal
 * Body: { description?: string, image?: string }
 *   - description: a meal in plain words ("chicken burrito bowl, no cheese")
 *   - image: a data URL (data:image/jpeg;base64,...) of a meal photo
 * At least one of description/image is required.
 * Returns: { meal, calories, protein } — matches the `nutrition` table shape.
 */
export async function POST(req: Request) {
  try {
    const { description, image } = await req.json();

    const hasText = typeof description === "string" && description.trim();
    const hasImage = typeof image === "string" && image.startsWith("data:");
    if (!hasText && !hasImage) {
      return NextResponse.json(
        { error: "Provide a meal 'description' and/or an 'image' data URL." },
        { status: 400 }
      );
    }

    const content: Anthropic.Messages.ContentBlockParam[] = [];
    if (hasImage) {
      const match = image.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
      if (!match) {
        return NextResponse.json(
          { error: "image must be a base64 data URL." },
          { status: 400 }
        );
      }
      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: match[1] as
            | "image/jpeg"
            | "image/png"
            | "image/gif"
            | "image/webp",
          data: match[2],
        },
      });
    }
    content.push({
      type: "text",
      text: hasText
        ? `Meal: ${description}`
        : "Estimate the nutrition for the meal in this photo.",
    });

    const result = await askClaudeForJson<MealResult>({
      maxTokens: 200,
      system:
        "You are a nutrition estimator. Given a meal description and/or photo, " +
        'reply with ONLY a JSON object: {"meal": short label, "calories": integer kcal, "protein": integer grams}. ' +
        "Estimate reasonable values for a normal single serving. No prose, no code fences.",
      user: content,
    });

    const meal =
      (typeof result?.meal === "string" && result.meal.trim()) ||
      (hasText ? description.trim() : "Meal");
    const calories = clampInt(result?.calories, 0, 5000, 0);
    const protein = clampInt(result?.protein, 0, 500, 0);

    return NextResponse.json({ meal, calories, protein });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Estimation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function clampInt(v: unknown, min: number, max: number, fallback: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}
