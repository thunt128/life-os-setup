import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { getClaude, CLAUDE_MODEL, parseJsonFromMessage } from "@/lib/anthropic";

type NutritionResult = {
  meal: string; // short label, e.g. "Chicken & rice"
  calories: number;
  protein: number; // grams
};

const SUPPORTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

// Estimates calories + protein from a meal description and/or a photo.
// Photos arrive as a data URL ("data:image/jpeg;base64,...") so we can forward
// them to Claude's vision input.
export async function POST(req: Request) {
  const claude = getClaude();
  if (!claude) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set — add it to .env.local (see Phase 3)." },
      { status: 503 }
    );
  }

  let meal = "";
  let image: string | undefined;
  try {
    ({ meal, image } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if ((!meal || typeof meal !== "string") && !image) {
    return NextResponse.json(
      { error: "Provide a meal description and/or an image." },
      { status: 400 }
    );
  }

  const blocks: Anthropic.ContentBlockParam[] = [];

  if (image && typeof image === "string") {
    const match = /^data:(image\/[a-zA-Z]+);base64,(.+)$/.exec(image);
    if (!match || !SUPPORTED_IMAGE_TYPES.includes(match[1])) {
      return NextResponse.json(
        { error: "Image must be a base64 data URL (jpeg, png, gif, or webp)." },
        { status: 400 }
      );
    }
    blocks.push({
      type: "image",
      source: {
        type: "base64",
        media_type: match[1] as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
        data: match[2],
      },
    });
  }

  blocks.push({
    type: "text",
    text: meal ? `Meal: ${meal}` : "Estimate the nutrition of the meal in this photo.",
  });

  try {
    const msg = await claude.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 256,
      output_config: { effort: "low" },
      system:
        "You estimate nutrition for a logged meal. Give your best single estimate " +
        "of total calories and total protein in grams. Also produce a short label " +
        "(<= 5 words) naming the meal. Reply with ONLY a JSON object: " +
        '{"meal": "short label", "calories": 0, "protein": 0}. No prose, no ranges.',
      messages: [{ role: "user", content: blocks }],
    });

    const result = parseJsonFromMessage<NutritionResult>(msg.content);

    const label = (result.meal || meal || "Meal").toString().slice(0, 60);
    const calories = Math.max(0, Math.round(Number(result.calories) || 0));
    const protein = Math.max(0, Math.round(Number(result.protein) || 0));

    return NextResponse.json({ meal: label, calories, protein });
  } catch (err) {
    console.error("nutrition estimate error:", err);
    return NextResponse.json({ error: "Nutrition estimate failed." }, { status: 500 });
  }
}
