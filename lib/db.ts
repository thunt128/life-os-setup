/* ------------------------------------------------------------------ */
/*  DATA LAYER                                                         */
/*  Typed Supabase queries for every Life OS panel. The page keeps    */
/*  React state; this module owns reads/writes so the UI stays thin.  */
/*  Shapes mirror supabase/schema.sql exactly.                        */
/* ------------------------------------------------------------------ */

import { supabase } from "./supabaseClient";

/* ---- Row types (match schema.sql) -------------------------------- */

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

export type GoalRow = {
  id: string;
  content: string;
  period: "week" | "month" | null;
  created_at?: string;
};

export type MealRow = {
  id: string;
  meal: string;
  calories: number | null;
  protein: number | null;
  eaten_at: string;
};

export type JournalRow = {
  id: string;
  date: string;
  raw_transcript: string | null;
  ai_summary: string | null;
  created_at?: string;
};

export type FinanceRow = {
  id: string;
  label: string;
  amount: number | null;
  as_of: string;
};

/* ---- Date helpers ------------------------------------------------ */
/*  Use the browser's local day so "today" matches what the user sees. */

export function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfTodayISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/* ---- Tasks ------------------------------------------------------- */

export async function loadTasks(): Promise<TaskRow[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as TaskRow[];
}

export async function addTask(
  content: string,
  opts: { starred?: boolean; view?: TaskRow["view"]; category?: string | null } = {}
): Promise<void> {
  const { error } = await supabase.from("tasks").insert({
    content,
    starred: opts.starred ?? false,
    view: opts.view ?? "today",
    category: opts.category ?? null,
  });
  if (error) throw error;
}

export async function completeTask(id: string): Promise<void> {
  const { error } = await supabase.from("tasks").update({ status: "done" }).eq("id", id);
  if (error) throw error;
}

/* ---- Habits (grouped via parent_id, one set of rows per day) ----- */

/* Default template used only when the database has no habits at all. */
export const DEFAULT_HABITS: { name: string; items: string[] }[] = [
  { name: "Morning", items: ["Warm-up", "Lift", "Stretch"] },
  { name: "Supplements", items: ["Creatine", "Omega-3", "Vit D", "Magnesium"] },
  { name: "Deep work", items: ["Scroll X", "Market research", "Ideate"] },
  { name: "Comms", items: ["Reply DMs", "Engage comments"] },
  { name: "Build", items: ["Portfolio", "Risk scan", "Dashboard"] },
];

async function fetchHabits(date: string): Promise<HabitRow[]> {
  const { data, error } = await supabase
    .from("habits")
    .select("*")
    .eq("date", date);
  if (error) throw error;
  return (data ?? []) as HabitRow[];
}

/* Create a fresh set of group + item rows for `date` from a template. */
async function seedHabits(
  template: { name: string; items: string[] }[],
  date: string
): Promise<void> {
  for (const group of template) {
    const { data: parent, error } = await supabase
      .from("habits")
      .insert({ name: group.name, date, completed: false })
      .select("id")
      .single();
    if (error || !parent) continue;
    if (group.items.length) {
      await supabase.from("habits").insert(
        group.items.map((item) => ({
          name: item,
          parent_id: parent.id,
          date,
          completed: false,
        }))
      );
    }
  }
}

/*
 * Load today's habits. On the first load of a new day there are no rows,
 * so we carry the structure forward: seed today from the most recent prior
 * day, or from DEFAULT_HABITS if the database is empty.
 */
export async function loadHabitsForToday(): Promise<HabitRow[]> {
  const date = todayISO();
  let rows = await fetchHabits(date);
  if (rows.length > 0) return rows;

  const { data: recent, error } = await supabase
    .from("habits")
    .select("*")
    .order("date", { ascending: false })
    .limit(500);
  if (error) throw error;

  let template = DEFAULT_HABITS;
  if (recent && recent.length) {
    const latestDate = (recent[0] as HabitRow).date;
    const latest = (recent as HabitRow[]).filter((r) => r.date === latestDate);
    const parents = latest.filter((r) => !r.parent_id);
    if (parents.length) {
      template = parents.map((p) => ({
        name: p.name,
        items: latest.filter((c) => c.parent_id === p.id).map((c) => c.name),
      }));
    }
  }

  await seedHabits(template, date);
  rows = await fetchHabits(date);
  return rows;
}

export async function toggleHabit(id: string, completed: boolean): Promise<void> {
  const { error } = await supabase.from("habits").update({ completed }).eq("id", id);
  if (error) throw error;
}

export async function addHabitItem(groupId: string, name: string): Promise<void> {
  const { error } = await supabase.from("habits").insert({
    name,
    parent_id: groupId,
    date: todayISO(),
    completed: false,
  });
  if (error) throw error;
}

/* ---- Goals ------------------------------------------------------- */

export async function loadGoals(period: "week" | "month"): Promise<GoalRow[]> {
  const { data, error } = await supabase
    .from("goals")
    .select("*")
    .eq("period", period)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as GoalRow[];
}

export async function addGoal(content: string, period: "week" | "month"): Promise<void> {
  const { error } = await supabase.from("goals").insert({ content, period });
  if (error) throw error;
}

export async function deleteGoal(id: string): Promise<void> {
  const { error } = await supabase.from("goals").delete().eq("id", id);
  if (error) throw error;
}

/* ---- Nutrition --------------------------------------------------- */

export async function loadMealsToday(): Promise<MealRow[]> {
  const { data, error } = await supabase
    .from("nutrition")
    .select("*")
    .gte("eaten_at", startOfTodayISO())
    .order("eaten_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as MealRow[];
}

export async function addMeal(
  meal: string,
  calories: number | null,
  protein: number | null
): Promise<void> {
  const { error } = await supabase.from("nutrition").insert({ meal, calories, protein });
  if (error) throw error;
}

/* ---- Journal ----------------------------------------------------- */

export async function loadLatestJournal(): Promise<JournalRow | null> {
  const { data, error } = await supabase
    .from("journal")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  return (data && data.length ? (data[0] as JournalRow) : null);
}

export async function addJournalNote(text: string): Promise<void> {
  const { error } = await supabase.from("journal").insert({ raw_transcript: text });
  if (error) throw error;
}

/* ---- Finance ----------------------------------------------------- */

export async function loadFinance(): Promise<FinanceRow[]> {
  const { data, error } = await supabase
    .from("finance")
    .select("*")
    .order("as_of", { ascending: false });
  if (error) throw error;
  return (data ?? []) as FinanceRow[];
}
