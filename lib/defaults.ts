// Default seed data used when a table is empty for the current day.
// These match the shapes in supabase/schema.sql.

// The daily-habit template. Each group becomes a parent habit row
// (parent_id = null) and each item a child row (parent_id = parent).
export const DEFAULT_HABIT_GROUPS: { name: string; items: string[] }[] = [
  { name: "Morning", items: ["Warm-up", "Lift", "Stretch"] },
  { name: "Supplements", items: ["Creatine", "Omega-3", "Vit D", "Magnesium"] },
  { name: "Deep work", items: ["Scroll X", "Market research", "Ideate"] },
  { name: "Comms", items: ["Reply DMs", "Engage comments"] },
  { name: "Build", items: ["Portfolio", "Risk scan", "Dashboard"] },
];

// The six life categories (mirrors the `category` comment in schema.sql).
export const CATEGORY_KEYS = [
  "legal",
  "finance",
  "content",
  "products",
  "opsec",
  "business",
] as const;

// Finance Pulse reads three specific rows from the `finance` table by label.
// Create rows with these labels in Supabase to populate the panel.
export const FINANCE_LABELS = {
  netWorth: "net worth",
  month: "month",
  day: "day",
} as const;

// Daily protein/calorie target for the Nutrition panel.
export const CALORIE_TARGET = 2040;

// Today's date as a YYYY-MM-DD string in the user's local timezone.
// Matches Postgres `date` columns (habits.date, journal.date).
export function todayStr(): string {
  const d = new Date();
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 10);
}
