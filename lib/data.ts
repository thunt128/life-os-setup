import { supabase } from "@/lib/supabaseClient";

/* ------------------------------------------------------------------ */
/*  Row types — these mirror supabase/schema.sql exactly.             */
/*  Do NOT add columns here that don't exist in the schema.           */
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

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Local calendar date as YYYY-MM-DD (matches schema `date` columns). */
export function todayISO(): string {
  const d = new Date();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Start of today as an ISO timestamp, for filtering timestamptz columns. */
function startOfTodayISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/* ---------------------------- TASKS ------------------------------- */

export async function getTasks(): Promise<TaskRow[]> {
  const { data } = await supabase
    .from("tasks")
    .select("*")
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true });
  return (data as TaskRow[]) ?? [];
}

export async function addTask(opts: {
  content: string;
  view?: TaskRow["view"];
  starred?: boolean;
  category?: string | null;
}): Promise<void> {
  await supabase.from("tasks").insert({
    content: opts.content,
    view: opts.view ?? "today",
    starred: opts.starred ?? false,
    category: opts.category ?? null,
  });
}

export async function completeTask(id: string): Promise<void> {
  await supabase.from("tasks").update({ status: "done" }).eq("id", id);
}

/* ---------------------------- HABITS ------------------------------ */

/** The default daily checklist, seeded once per day when none exist. */
export const HABIT_TEMPLATE: { name: string; items: string[] }[] = [
  { name: "Morning", items: ["Warm-up", "Lift", "Stretch"] },
  { name: "Supplements", items: ["Creatine", "Omega-3", "Vit D", "Magnesium"] },
  { name: "Deep work", items: ["Scroll X", "Market research", "Ideate"] },
  { name: "Comms", items: ["Reply DMs", "Engage comments"] },
  { name: "Build", items: ["Portfolio", "Risk scan", "Dashboard"] },
];

export type HabitGroup = {
  parent: HabitRow;
  items: HabitRow[];
};

/** Fetch today's habit rows. */
async function getHabitRowsForToday(): Promise<HabitRow[]> {
  const { data } = await supabase
    .from("habits")
    .select("*")
    .eq("date", todayISO());
  return (data as HabitRow[]) ?? [];
}

/**
 * Seed today's habit list from HABIT_TEMPLATE. Each group becomes a parent
 * row; each item becomes a child row (parent_id set). Only call when today
 * has no rows yet.
 */
async function seedHabitsForToday(): Promise<void> {
  const date = todayISO();
  for (const group of HABIT_TEMPLATE) {
    const { data: parent } = await supabase
      .from("habits")
      .insert({ name: group.name, date, completed: false })
      .select()
      .single();
    if (!parent) continue;
    const children = group.items.map((name) => ({
      name,
      parent_id: (parent as HabitRow).id,
      date,
      completed: false,
    }));
    await supabase.from("habits").insert(children);
  }
}

/**
 * Load today's habits grouped by parent. If today has no rows yet, the
 * default template is seeded first so the checklist is never empty.
 */
export async function getHabitGroupsForToday(): Promise<HabitGroup[]> {
  let rows = await getHabitRowsForToday();
  if (rows.length === 0) {
    await seedHabitsForToday();
    rows = await getHabitRowsForToday();
  }
  const parents = rows.filter((r) => r.parent_id === null);
  return parents.map((parent) => ({
    parent,
    items: rows.filter((r) => r.parent_id === parent.id),
  }));
}

export async function setHabitCompleted(
  id: string,
  completed: boolean
): Promise<void> {
  await supabase.from("habits").update({ completed }).eq("id", id);
}

/* ---------------------------- GOALS ------------------------------- */

export async function getGoals(
  period: "week" | "month" = "month"
): Promise<GoalRow[]> {
  const { data } = await supabase
    .from("goals")
    .select("*")
    .eq("period", period)
    .order("created_at", { ascending: true });
  return (data as GoalRow[]) ?? [];
}

export async function addGoal(
  content: string,
  period: "week" | "month" = "month"
): Promise<void> {
  await supabase.from("goals").insert({ content, period });
}

/* --------------------------- NUTRITION ---------------------------- */

export async function getMealsToday(): Promise<NutritionRow[]> {
  const { data } = await supabase
    .from("nutrition")
    .select("*")
    .gte("eaten_at", startOfTodayISO())
    .order("eaten_at", { ascending: true });
  return (data as NutritionRow[]) ?? [];
}

export async function logMeal(opts: {
  meal: string;
  calories?: number | null;
  protein?: number | null;
}): Promise<void> {
  await supabase.from("nutrition").insert({
    meal: opts.meal,
    calories: opts.calories ?? null,
    protein: opts.protein ?? null,
  });
}

/* ---------------------------- FINANCE ----------------------------- */

export async function getFinance(): Promise<FinanceRow[]> {
  const { data } = await supabase
    .from("finance")
    .select("*")
    .order("as_of", { ascending: false });
  return (data as FinanceRow[]) ?? [];
}

/* ---------------------------- JOURNAL ----------------------------- */

export async function getLatestJournal(): Promise<JournalRow | null> {
  const { data } = await supabase
    .from("journal")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1);
  const rows = (data as JournalRow[]) ?? [];
  return rows[0] ?? null;
}
