// Row shapes mirror supabase/schema.sql exactly.
// Keep these in sync with the tables when the schema changes.

export type TaskRow = {
  id: string;
  content: string;
  category: string | null; // legal | finance | content | products | opsec | business
  priority: number;
  starred: boolean;
  status: "active" | "done" | "archived";
  view: "today" | "week" | "month";
  created_at: string;
};

export type HabitRow = {
  id: string;
  name: string;
  parent_id: string | null;
  date: string; // YYYY-MM-DD
  completed: boolean;
};

export type JournalRow = {
  id: string;
  date: string;
  raw_transcript: string | null;
  ai_summary: string | null;
  created_at: string;
};

export type NutritionRow = {
  id: string;
  meal: string;
  calories: number | null;
  protein: number | null;
  eaten_at: string;
};

export type GoalRow = {
  id: string;
  content: string;
  period: "week" | "month" | null;
  created_at: string;
};

export type FinanceRow = {
  id: string;
  label: string;
  amount: number | null;
  as_of: string;
};

// Daily nutrition target (kcal). No table backs this yet, so it lives here.
export const CALORIE_TARGET = 2040;

// Life categories shown in the "Brain" panel. Counts are derived live from
// tasks; the key list itself is fixed and mirrors schema.sql's category comment.
export const CATEGORY_KEYS = [
  "legal",
  "finance",
  "content",
  "products",
  "opsec",
  "business",
] as const;
