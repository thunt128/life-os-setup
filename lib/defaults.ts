// Default seed data used the first time a day has no rows yet.
// These shapes match supabase/schema.sql.

// Daily habit template. Each group becomes a parent `habits` row
// (parent_id = null) and each item a child row pointing at it.
export const HABIT_TEMPLATE: { group: string; items: string[] }[] = [
  { group: "Morning", items: ["Warm-up", "Lift", "Stretch"] },
  { group: "Supplements", items: ["Creatine", "Omega-3", "Vit D", "Magnesium"] },
  { group: "Deep work", items: ["Scroll X", "Market research", "Ideate"] },
  { group: "Comms", items: ["Reply DMs", "Engage comments"] },
  { group: "Build", items: ["Portfolio", "Risk scan", "Dashboard"] },
];

// The six fixed life categories shown in the Brain panel. Live task
// counts are layered on top of these at render time.
export const CATEGORY_KEYS = [
  "legal",
  "finance",
  "content",
  "products",
  "opsec",
  "business",
] as const;

// Daily calorie target for the Nutrition panel's "kcal left" stat.
export const CALORIE_TARGET = 2040;
