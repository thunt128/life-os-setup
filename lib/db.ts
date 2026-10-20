import { supabase } from "@/lib/supabaseClient";

/* ------------------------------------------------------------------ */
/*  Typed data layer for the Operator dashboard.                       */
/*  Row shapes mirror supabase/schema.sql exactly. Every loader is     */
/*  resilient: on any error (DB not set up yet, empty tables, RLS)     */
/*  it returns an empty result so the dashboard renders clean empty    */
/*  states instead of crashing.                                        */
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
  date: string;
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

/** Today's date as YYYY-MM-DD in UTC, matching Postgres `current_date`. */
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/* ---- Loaders ----------------------------------------------------- */

export async function loadTasks(): Promise<TaskRow[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data as TaskRow[]) ?? [];
}

export async function loadHabits(date: string): Promise<HabitRow[]> {
  const { data, error } = await supabase
    .from("habits")
    .select("*")
    .eq("date", date);
  if (error) return [];
  return (data as HabitRow[]) ?? [];
}

export async function loadGoals(): Promise<GoalRow[]> {
  const { data, error } = await supabase
    .from("goals")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) return [];
  return (data as GoalRow[]) ?? [];
}

export async function loadTodaysMeals(): Promise<NutritionRow[]> {
  const start = `${todayISO()}T00:00:00Z`;
  const { data, error } = await supabase
    .from("nutrition")
    .select("*")
    .gte("eaten_at", start)
    .order("eaten_at", { ascending: true });
  if (error) return [];
  return (data as NutritionRow[]) ?? [];
}

export async function loadFinance(): Promise<FinanceRow[]> {
  const { data, error } = await supabase.from("finance").select("*");
  if (error) return [];
  return (data as FinanceRow[]) ?? [];
}

export async function loadLatestJournal(): Promise<JournalRow | null> {
  const { data, error } = await supabase
    .from("journal")
    .select("*")
    .order("date", { ascending: false })
    .limit(1);
  if (error || !data || data.length === 0) return null;
  return data[0] as JournalRow;
}

/* ---- Mutators ---------------------------------------------------- */

export async function addTask(content: string) {
  return supabase.from("tasks").insert({ content, starred: true, view: "today" });
}

export async function completeTask(id: string) {
  return supabase.from("tasks").update({ status: "done" }).eq("id", id);
}

export async function setHabitCompleted(id: string, completed: boolean) {
  return supabase.from("habits").update({ completed }).eq("id", id);
}

export async function addGoal(content: string, period: "week" | "month" = "month") {
  return supabase.from("goals").insert({ content, period });
}

export async function addMeal(meal: string, calories: number | null, protein: number | null) {
  return supabase.from("nutrition").insert({ meal, calories, protein });
}
