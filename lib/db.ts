// ------------------------------------------------------------------
//  lib/db.ts — typed Supabase data access for the Operator dashboard
//
//  Every function here maps 1:1 to a table in supabase/schema.sql.
//  The dashboard (app/page.tsx) calls these instead of using mock
//  data. Row Level Security on the Supabase side is what actually
//  gates access — these helpers assume the user is already signed in.
// ------------------------------------------------------------------

import { supabase } from "@/lib/supabaseClient";

/* ---------------------------------- types ---------------------------------- */

export type TaskRow = {
  id: string;
  content: string;
  category: string | null;
  priority: number;
  starred: boolean;
  status: "active" | "done" | "archived";
  view: "today" | "week" | "month";
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
};

export type FinanceRow = {
  id: string;
  label: string;
  amount: number | null;
};

export type NutritionRow = {
  id: string;
  meal: string;
  calories: number | null;
  protein: number | null;
  eaten_at: string;
};

export type HealthRow = {
  id: string;
  date: string;
  total_calories: number | null;
  total_protein: number | null;
};

export type JournalRow = {
  id: string;
  date: string;
  raw_transcript: string | null;
  ai_summary: string | null;
  created_at: string;
};

/* --------------------------------- helpers --------------------------------- */

/** Local calendar date as YYYY-MM-DD (matches Postgres `current_date`). */
export function today(): string {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

/* ---------------------------------- tasks ---------------------------------- */

export async function getTasks(): Promise<TaskRow[]> {
  const { data } = await supabase
    .from("tasks")
    .select("*")
    .neq("status", "archived")
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false });
  return (data ?? []) as TaskRow[];
}

export async function addTask(content: string, opts: Partial<TaskRow> = {}) {
  await supabase.from("tasks").insert({ content, ...opts });
}

export async function completeTask(id: string) {
  await supabase.from("tasks").update({ status: "done" }).eq("id", id);
}

/* --------------------------------- habits ---------------------------------- */

/** A template used only to seed a brand-new install (no prior habit rows). */
const DEFAULT_HABITS: { group: string; items: string[] }[] = [
  { group: "Morning", items: ["Warm-up", "Lift", "Stretch"] },
  { group: "Supplements", items: ["Creatine", "Omega-3", "Vit D", "Magnesium"] },
  { group: "Deep work", items: ["Scroll X", "Market research", "Ideate"] },
  { group: "Comms", items: ["Reply DMs", "Engage comments"] },
  { group: "Build", items: ["Portfolio", "Risk scan", "Dashboard"] },
];

export async function getHabits(date = today()): Promise<HabitRow[]> {
  const { data } = await supabase
    .from("habits")
    .select("*")
    .eq("date", date);
  return (data ?? []) as HabitRow[];
}

export async function toggleHabit(id: string, completed: boolean) {
  await supabase.from("habits").update({ completed }).eq("id", id);
}

export async function addHabitGroup(name: string, date = today()) {
  await supabase.from("habits").insert({ name, parent_id: null, date, completed: false });
}

export async function addHabitItem(parentId: string, name: string, date = today()) {
  await supabase.from("habits").insert({ name, parent_id: parentId, date, completed: false });
}

export async function deleteHabit(id: string) {
  // children cascade via the FK, so deleting a group clears its items too.
  await supabase.from("habits").delete().eq("id", id);
}

/**
 * Make sure today has a set of habit rows to check off. Idempotent:
 *  - if today already has rows, does nothing;
 *  - else copies the structure from the most recent earlier day (reset
 *    to incomplete);
 *  - else, on a fresh install with no history, seeds DEFAULT_HABITS.
 * Returns today's rows either way.
 */
export async function ensureHabitsForToday(date = today()): Promise<HabitRow[]> {
  const existing = await getHabits(date);
  if (existing.length > 0) return existing;

  // Find the most recent earlier day that has habits.
  const { data: prior } = await supabase
    .from("habits")
    .select("*")
    .lt("date", date)
    .order("date", { ascending: false });

  const priorRows = (prior ?? []) as HabitRow[];
  if (priorRows.length > 0) {
    const lastDate = priorRows[0].date;
    const template = priorRows.filter((r) => r.date === lastDate);
    await cloneHabitStructure(
      template.filter((r) => r.parent_id === null),
      template.filter((r) => r.parent_id !== null),
      date
    );
  } else {
    // Fresh install — seed from the built-in template.
    for (const g of DEFAULT_HABITS) {
      const { data: parent } = await supabase
        .from("habits")
        .insert({ name: g.group, parent_id: null, date, completed: false })
        .select("id")
        .single();
      if (parent) {
        await supabase.from("habits").insert(
          g.items.map((name) => ({
            name,
            parent_id: (parent as { id: string }).id,
            date,
            completed: false,
          }))
        );
      }
    }
  }
  return getHabits(date);
}

async function cloneHabitStructure(
  groups: HabitRow[],
  items: HabitRow[],
  date: string
) {
  for (const g of groups) {
    const { data: parent } = await supabase
      .from("habits")
      .insert({ name: g.name, parent_id: null, date, completed: false })
      .select("id")
      .single();
    if (!parent) continue;
    const children = items.filter((i) => i.parent_id === g.id);
    if (children.length > 0) {
      await supabase.from("habits").insert(
        children.map((c) => ({
          name: c.name,
          parent_id: (parent as { id: string }).id,
          date,
          completed: false,
        }))
      );
    }
  }
}

/* ---------------------------------- goals ---------------------------------- */

export async function getGoals(period: "week" | "month" = "month"): Promise<GoalRow[]> {
  const { data } = await supabase
    .from("goals")
    .select("*")
    .eq("period", period)
    .order("created_at", { ascending: true });
  return (data ?? []) as GoalRow[];
}

export async function addGoal(content: string, period: "week" | "month" = "month") {
  await supabase.from("goals").insert({ content, period });
}

export async function deleteGoal(id: string) {
  await supabase.from("goals").delete().eq("id", id);
}

/* --------------------------------- finance --------------------------------- */

export async function getFinance(): Promise<FinanceRow[]> {
  const { data } = await supabase
    .from("finance")
    .select("*")
    .order("as_of", { ascending: false });
  return (data ?? []) as FinanceRow[];
}

/* -------------------------------- nutrition -------------------------------- */

export async function getMealsToday(date = today()): Promise<NutritionRow[]> {
  const { data } = await supabase
    .from("nutrition")
    .select("*")
    .gte("eaten_at", `${date}T00:00:00`)
    .lte("eaten_at", `${date}T23:59:59`)
    .order("eaten_at", { ascending: true });
  return (data ?? []) as NutritionRow[];
}

export async function addMeal(meal: string, calories: number, protein: number) {
  await supabase.from("nutrition").insert({ meal, calories, protein });
}

export async function getHealthToday(date = today()): Promise<HealthRow | null> {
  const { data } = await supabase
    .from("health")
    .select("*")
    .eq("date", date)
    .limit(1);
  const rows = (data ?? []) as HealthRow[];
  return rows[0] ?? null;
}

/* --------------------------------- journal --------------------------------- */

export async function getLatestJournal(): Promise<JournalRow | null> {
  const { data } = await supabase
    .from("journal")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1);
  const rows = (data ?? []) as JournalRow[];
  return rows[0] ?? null;
}
