import { supabase } from "@/lib/supabaseClient";

/* ------------------------------------------------------------------ */
/*  ROW TYPES                                                          */
/*  These match the tables defined in supabase/schema.sql exactly.     */
/* ------------------------------------------------------------------ */

export type TaskRow = {
  id: string;
  content: string;
  category: string | null;
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
  date: string;
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

/* Today as an ISO date string (YYYY-MM-DD), matching the DB `date` type. */
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------ */
/*  TASKS                                                              */
/* ------------------------------------------------------------------ */

export async function fetchTasks(): Promise<TaskRow[]> {
  const { data } = await supabase
    .from("tasks")
    .select("*")
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true });
  return (data ?? []) as TaskRow[];
}

export async function addTask(
  content: string,
  opts: Partial<Pick<TaskRow, "category" | "priority" | "starred" | "view">> = {}
): Promise<void> {
  await supabase.from("tasks").insert({
    content,
    starred: opts.starred ?? false,
    view: opts.view ?? "today",
    category: opts.category ?? null,
    priority: opts.priority ?? 0,
  });
}

export async function setTaskStatus(
  id: string,
  status: TaskRow["status"]
): Promise<void> {
  await supabase.from("tasks").update({ status }).eq("id", id);
}

/* ------------------------------------------------------------------ */
/*  HABITS                                                             */
/*  Groups are parent rows (parent_id = null); items are children.     */
/* ------------------------------------------------------------------ */

export async function fetchHabits(): Promise<HabitRow[]> {
  const { data } = await supabase.from("habits").select("*");
  return (data ?? []) as HabitRow[];
}

export async function addHabitGroup(name: string): Promise<void> {
  await supabase.from("habits").insert({ name, parent_id: null });
}

export async function addHabitItem(
  name: string,
  parentId: string
): Promise<void> {
  await supabase.from("habits").insert({ name, parent_id: parentId });
}

export async function setHabitCompleted(
  id: string,
  completed: boolean
): Promise<void> {
  await supabase.from("habits").update({ completed }).eq("id", id);
}

/* ------------------------------------------------------------------ */
/*  GOALS                                                              */
/* ------------------------------------------------------------------ */

export async function fetchGoals(): Promise<GoalRow[]> {
  const { data } = await supabase
    .from("goals")
    .select("*")
    .order("created_at", { ascending: true });
  return (data ?? []) as GoalRow[];
}

export async function addGoal(
  content: string,
  period: "week" | "month"
): Promise<void> {
  await supabase.from("goals").insert({ content, period });
}

/* ------------------------------------------------------------------ */
/*  NUTRITION                                                          */
/* ------------------------------------------------------------------ */

export async function fetchMealsToday(): Promise<NutritionRow[]> {
  const start = todayISO() + "T00:00:00";
  const { data } = await supabase
    .from("nutrition")
    .select("*")
    .gte("eaten_at", start)
    .order("eaten_at", { ascending: true });
  return (data ?? []) as NutritionRow[];
}

export async function addMeal(
  meal: string,
  calories: number | null,
  protein: number | null
): Promise<void> {
  await supabase.from("nutrition").insert({ meal, calories, protein });
}

/* ------------------------------------------------------------------ */
/*  FINANCE                                                            */
/* ------------------------------------------------------------------ */

export async function fetchFinance(): Promise<FinanceRow[]> {
  const { data } = await supabase
    .from("finance")
    .select("*")
    .order("as_of", { ascending: false });
  return (data ?? []) as FinanceRow[];
}

/* ------------------------------------------------------------------ */
/*  JOURNAL                                                            */
/* ------------------------------------------------------------------ */

export async function fetchLatestJournal(): Promise<JournalRow | null> {
  const { data } = await supabase
    .from("journal")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1);
  const rows = (data ?? []) as JournalRow[];
  return rows[0] ?? null;
}

export async function addJournalEntry(transcript: string): Promise<void> {
  await supabase.from("journal").insert({ raw_transcript: transcript });
}
