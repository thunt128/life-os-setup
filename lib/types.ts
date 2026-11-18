// Row types mirroring supabase/schema.sql. Keep these in sync with the
// database schema — they describe exactly what each table returns.

export type TaskRow = {
  id: string;
  content: string;
  category: string | null; // legal | finance | content | products | opsec | business
  priority: number;
  starred: boolean;
  status: "active" | "done" | "archived";
  view: "today" | "week" | "month";
  created_at?: string;
};

export type HabitRow = {
  id: string;
  name: string;
  parent_id: string | null; // null = group header; otherwise a child habit
  date: string; // YYYY-MM-DD
  completed: boolean;
};

export type GoalRow = {
  id: string;
  content: string;
  period: "week" | "month";
  created_at?: string;
};

export type NutritionRow = {
  id: string;
  meal: string;
  calories: number | null;
  protein: number | null;
  eaten_at?: string;
};

export type FinanceRow = {
  id: string;
  label: string;
  amount: number | null;
  as_of?: string;
};

export type JournalRow = {
  id: string;
  date: string;
  raw_transcript: string | null;
  ai_summary: string | null;
  created_at?: string;
};
