// ------------------------------------------------------------------
//  Row types — these mirror the tables in supabase/schema.sql exactly.
//  Keep them in sync with the schema; the dashboard reads/writes these.
// ------------------------------------------------------------------

export type TaskView = "today" | "week" | "month";
export type TaskStatus = "active" | "done" | "archived";

export type TaskRow = {
  id: string;
  content: string;
  category: string | null;
  priority: number;
  starred: boolean;
  status: TaskStatus;
  view: TaskView;
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
  date: string; // YYYY-MM-DD
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

export type GoalPeriod = "week" | "month";

export type GoalRow = {
  id: string;
  content: string;
  period: GoalPeriod | null;
  created_at?: string;
};

export type FinanceRow = {
  id: string;
  label: string;
  amount: number | null;
  as_of?: string;
};
