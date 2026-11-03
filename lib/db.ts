import { supabase } from "@/lib/supabaseClient";

/* ------------------------------------------------------------------ */
/*  Row types — these mirror supabase/schema.sql exactly.             */
/* ------------------------------------------------------------------ */

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

export type GoalRow = {
  id: string;
  content: string;
  period: "week" | "month" | null;
  created_at?: string;
};

export type NutritionRow = {
  id: string;
  meal: string;
  calories: number | null;
  protein: number | null;
  eaten_at: string; // timestamptz
};

export type FinanceRow = {
  id: string;
  label: string;
  amount: number | null;
  as_of: string; // timestamptz
};

export type JournalRow = {
  id: string;
  date: string; // YYYY-MM-DD
  raw_transcript: string | null;
  ai_summary: string | null;
  created_at?: string;
};

/* ------------------------------------------------------------------ */
/*  Date helpers                                                       */
/* ------------------------------------------------------------------ */

/** Local calendar date as YYYY-MM-DD (matches a Postgres `date` column). */
export function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Start/end of the local day as ISO timestamps, for timestamptz filters. */
export function todayRange(): { start: string; end: string } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

/* ------------------------------------------------------------------ */
/*  Queries                                                            */
/* ------------------------------------------------------------------ */

export async function fetchTasks(): Promise<TaskRow[]> {
  const { data } = await supabase
    .from("tasks")
    .select("*")
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false });
  return (data as TaskRow[]) ?? [];
}

export async function fetchHabitsForToday(): Promise<HabitRow[]> {
  const { data } = await supabase
    .from("habits")
    .select("*")
    .eq("date", todayISO());
  return (data as HabitRow[]) ?? [];
}

export async function fetchGoals(period: "week" | "month"): Promise<GoalRow[]> {
  const { data } = await supabase
    .from("goals")
    .select("*")
    .eq("period", period)
    .order("created_at", { ascending: true });
  return (data as GoalRow[]) ?? [];
}

export async function fetchMealsToday(): Promise<NutritionRow[]> {
  const { start, end } = todayRange();
  const { data } = await supabase
    .from("nutrition")
    .select("*")
    .gte("eaten_at", start)
    .lt("eaten_at", end)
    .order("eaten_at", { ascending: true });
  return (data as NutritionRow[]) ?? [];
}

export async function fetchFinance(): Promise<FinanceRow[]> {
  const { data } = await supabase
    .from("finance")
    .select("*")
    .order("as_of", { ascending: false });
  return (data as FinanceRow[]) ?? [];
}

export async function fetchLatestJournal(): Promise<JournalRow | null> {
  const { data } = await supabase
    .from("journal")
    .select("*")
    .order("date", { ascending: false })
    .limit(1);
  return (data?.[0] as JournalRow) ?? null;
}

/* ------------------------------------------------------------------ */
/*  Mutations                                                          */
/* ------------------------------------------------------------------ */

export async function insertTask(content: string) {
  return supabase.from("tasks").insert({ content, starred: true, view: "today" });
}

export async function setTaskStatus(id: string, status: TaskRow["status"]) {
  return supabase.from("tasks").update({ status }).eq("id", id);
}

export async function setHabitCompleted(id: string, completed: boolean) {
  return supabase.from("habits").update({ completed }).eq("id", id);
}

export async function insertHabit(name: string, parentId: string | null = null) {
  return supabase
    .from("habits")
    .insert({ name, parent_id: parentId, date: todayISO(), completed: false });
}

export async function insertGoal(content: string, period: "week" | "month") {
  return supabase.from("goals").insert({ content, period });
}

export async function insertMeal(
  meal: string,
  calories: number | null,
  protein: number | null
) {
  return supabase.from("nutrition").insert({ meal, calories, protein });
}
