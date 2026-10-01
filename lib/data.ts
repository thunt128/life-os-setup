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

export type MealRow = {
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

/** Today's local date as YYYY-MM-DD (not UTC — matches the user's day). */
export function todayISO(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/* ------------------------------------------------------------------ */
/*  TASKS                                                             */
/* ------------------------------------------------------------------ */

export async function fetchTasks(): Promise<TaskRow[]> {
  const { data } = await supabase
    .from("tasks")
    .select("*")
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true });
  return (data ?? []) as TaskRow[];
}

export async function addTask(fields: Partial<TaskRow> & { content: string }) {
  await supabase.from("tasks").insert(fields);
}

export async function completeTask(id: string) {
  await supabase.from("tasks").update({ status: "done" }).eq("id", id);
}

/* ------------------------------------------------------------------ */
/*  HABITS                                                            */
/* ------------------------------------------------------------------ */

// Default template used to seed a fresh day the first time it is viewed.
// Each entry is a group (parent) with its checklist items (children).
export const HABIT_TEMPLATE: { name: string; items: string[] }[] = [
  { name: "Morning", items: ["Warm-up", "Lift", "Stretch"] },
  { name: "Supplements", items: ["Creatine", "Omega-3", "Vit D", "Magnesium"] },
  { name: "Deep work", items: ["Scroll X", "Market research", "Ideate"] },
  { name: "Comms", items: ["Reply DMs", "Engage comments"] },
  { name: "Build", items: ["Portfolio", "Risk scan", "Dashboard"] },
];

export async function fetchHabits(date: string): Promise<HabitRow[]> {
  const { data } = await supabase
    .from("habits")
    .select("*")
    .eq("date", date);
  return (data ?? []) as HabitRow[];
}

/**
 * Ensure today's habit rows exist. If none are present for `date`, insert the
 * default template (parents first, then their children) so the checklist is
 * persistent and per-day. Returns the rows for `date`.
 */
export async function ensureHabits(date: string): Promise<HabitRow[]> {
  const existing = await fetchHabits(date);
  if (existing.length > 0) return existing;

  // Insert parent groups and read back their generated ids.
  const { data: parents } = await supabase
    .from("habits")
    .insert(
      HABIT_TEMPLATE.map((g) => ({ name: g.name, date, completed: false }))
    )
    .select();

  if (parents) {
    const children = HABIT_TEMPLATE.flatMap((g) => {
      const parent = (parents as HabitRow[]).find((p) => p.name === g.name);
      if (!parent) return [];
      return g.items.map((item) => ({
        name: item,
        parent_id: parent.id,
        date,
        completed: false,
      }));
    });
    if (children.length) await supabase.from("habits").insert(children);
  }

  return fetchHabits(date);
}

export async function setHabitCompleted(id: string, completed: boolean) {
  await supabase.from("habits").update({ completed }).eq("id", id);
}

/* ------------------------------------------------------------------ */
/*  GOALS                                                             */
/* ------------------------------------------------------------------ */

export async function fetchGoals(): Promise<GoalRow[]> {
  const { data } = await supabase
    .from("goals")
    .select("*")
    .order("created_at", { ascending: true });
  return (data ?? []) as GoalRow[];
}

export async function addGoal(content: string, period: "week" | "month" = "month") {
  await supabase.from("goals").insert({ content, period });
}

export async function deleteGoal(id: string) {
  await supabase.from("goals").delete().eq("id", id);
}

/* ------------------------------------------------------------------ */
/*  NUTRITION                                                         */
/* ------------------------------------------------------------------ */

/** Meals logged since local midnight today. */
export async function fetchMealsToday(): Promise<MealRow[]> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const { data } = await supabase
    .from("nutrition")
    .select("*")
    .gte("eaten_at", start.toISOString())
    .order("eaten_at", { ascending: true });
  return (data ?? []) as MealRow[];
}

export async function addMeal(meal: string, calories: number, protein: number) {
  await supabase.from("nutrition").insert({ meal, calories, protein });
}

/* ------------------------------------------------------------------ */
/*  FINANCE                                                           */
/* ------------------------------------------------------------------ */

export async function fetchFinance(): Promise<FinanceRow[]> {
  const { data } = await supabase
    .from("finance")
    .select("*")
    .order("as_of", { ascending: false });
  return (data ?? []) as FinanceRow[];
}

/* ------------------------------------------------------------------ */
/*  JOURNAL                                                           */
/* ------------------------------------------------------------------ */

/** Most recent journal entry, if any. */
export async function fetchLatestJournal(): Promise<JournalRow | null> {
  const { data } = await supabase
    .from("journal")
    .select("*")
    .order("date", { ascending: false })
    .limit(1);
  return data && data.length ? (data[0] as JournalRow) : null;
}
