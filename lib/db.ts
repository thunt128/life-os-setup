// ------------------------------------------------------------------
//  Shared row types — these mirror the tables in supabase/schema.sql.
//  Keep them in sync with that file; the dashboard reads/writes these
//  shapes directly via the Supabase client.
// ------------------------------------------------------------------

export type TaskRow = {
  id: string;
  content: string;
  category: string | null;
  priority: number;
  starred: boolean;
  status: "active" | "done" | "archived";
  view: "today" | "week" | "month";
  created_at?: string;
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
  created_at?: string;
};

export type NutritionRow = {
  id: string;
  meal: string;
  calories: number | null;
  protein: number | null;
  eaten_at?: string;
};

export type GoalRow = {
  id: string;
  content: string;
  period: "week" | "month" | null;
  created_at?: string;
};

export type FinanceRow = {
  id: string;
  label: string;
  amount: number | null;
  as_of?: string;
};

// Today's date as a Postgres `date` string (YYYY-MM-DD), local time.
export function todayStr(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}
