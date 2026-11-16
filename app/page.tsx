"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import type {
  TaskRow,
  TaskView,
  HabitRow,
  GoalRow,
  FinanceRow,
  JournalRow,
  NutritionRow,
} from "@/lib/types";
import {
  DEFAULT_HABIT_GROUPS,
  DEFAULT_GOALS,
  DEFAULT_FINANCE,
  CALORIE_TARGET,
} from "@/lib/defaults";

/* ------------------------------------------------------------------ */
/*  STATIC LAYOUT CONSTANTS                                            */
/*  Everything that *can* be backed by a schema.sql table is now live  */
/*  (see the loaders below). These few remain static because they have */
/*  no table yet:                                                      */
/*    - FINANCE_BARS: a decorative sparkline (finance has no series).  */
/*    - CATEGORIES:   the fixed category set; counts are computed live. */
/*    - CALENDAR:     no events table in the schema yet.               */
/* ------------------------------------------------------------------ */

const FINANCE_BARS = [
  8, 10, 7, 12, 9, 14, 11, 16, 13, 18, 15, 20, 17, 22, 19, 24, 21, 26, 23, 28,
];

// Matches the category values documented in supabase/schema.sql (tasks.category).
const CATEGORIES = ["legal", "finance", "content", "products", "opsec", "business"];

const CALENDAR = [
  { time: "09:30", label: "Standup w/ team" },
  { time: "11:30", label: "Investor call — fund II" },
  { time: "14:00", label: "Record finance video" },
  { time: "16:30", label: "1:1 with editor" },
];

/* ------------------------------------------------------------------ */
/*  HELPERS                                                            */
/* ------------------------------------------------------------------ */

function todayStr() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function money(n: number) {
  return "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

/* ------------------------------------------------------------------ */
/*  SMALL UI HELPERS                                                   */
/* ------------------------------------------------------------------ */

function PanelTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <span className="panel-title">{children}</span>
      {right}
    </div>
  );
}

function Check({
  checked,
  onChange,
  label,
  meta,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  meta?: string;
}) {
  return (
    <button
      onClick={onChange}
      className="flex w-full items-center gap-2 py-1 text-left text-[13px] text-ghost hover:text-acid"
    >
      <span
        className={`flex h-3.5 w-3.5 items-center justify-center rounded-sm border ${
          checked ? "border-acid bg-acid/20 text-acid" : "border-line"
        }`}
      >
        {checked ? "✓" : ""}
      </span>
      <span className={checked ? "text-muted line-through" : ""}>{label}</span>
      {meta && <span className="ml-auto text-[11px] text-muted">{meta}</span>}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  PAGE                                                               */
/* ------------------------------------------------------------------ */

export default function Dashboard() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);

  // --- Live data ---
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [habits, setHabits] = useState<HabitRow[]>([]);
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [finance, setFinance] = useState<FinanceRow[]>([]);
  const [journal, setJournal] = useState<JournalRow | null>(null);
  const [meals, setMeals] = useState<NutritionRow[]>([]);

  // --- UI state ---
  const [newTask, setNewTask] = useState("");
  const [kanbanDraft, setKanbanDraft] = useState<Record<TaskView, string>>({
    today: "",
    week: "",
    month: "",
  });
  const [newGoal, setNewGoal] = useState("");
  const [journalDraft, setJournalDraft] = useState("");
  const [mealDraft, setMealDraft] = useState({ meal: "", calories: "", protein: "" });
  const [showMealForm, setShowMealForm] = useState(false);
  const [revealMoney, setRevealMoney] = useState(false);
  const [ask, setAsk] = useState("");

  const loadedRef = useRef(false);

  // --- Auth gate: redirect to /login if not signed in ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace("/login");
      } else {
        setAuthed(true);
        if (!loadedRef.current) {
          loadedRef.current = true;
          loadAll();
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function loadAll() {
    await Promise.all([
      loadTasks(),
      loadHabits(),
      loadGoals(),
      loadFinance(),
      loadJournal(),
      loadMeals(),
    ]);
  }

  /* ---------------- Tasks ---------------- */
  async function loadTasks() {
    const { data } = await supabase
      .from("tasks")
      .select("*")
      .eq("status", "active")
      .order("priority", { ascending: false })
      .order("created_at", { ascending: true });
    if (data) setTasks(data as TaskRow[]);
  }

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    const content = newTask.trim();
    if (!content) return;
    setNewTask("");
    await supabase.from("tasks").insert({ content, starred: true, view: "today" });
    loadTasks();
  }

  async function addKanban(view: TaskView) {
    const content = kanbanDraft[view].trim();
    if (!content) return;
    setKanbanDraft((d) => ({ ...d, [view]: "" }));
    await supabase.from("tasks").insert({ content, starred: false, view });
    loadTasks();
  }

  async function completeTask(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id)); // optimistic
    await supabase.from("tasks").update({ status: "done" }).eq("id", id);
    loadTasks();
  }

  /* ---------------- Habits ---------------- */
  async function loadHabits() {
    const today = todayStr();
    let { data } = await supabase.from("habits").select("*").eq("date", today);

    // Seed today's habits from the template the first time we see this date.
    if (!data || data.length === 0) {
      for (const g of DEFAULT_HABIT_GROUPS) {
        const { data: parent } = await supabase
          .from("habits")
          .insert({ name: g.name, date: today, completed: false })
          .select()
          .single();
        if (parent) {
          await supabase.from("habits").insert(
            g.items.map((item) => ({
              name: item,
              parent_id: (parent as HabitRow).id,
              date: today,
              completed: false,
            }))
          );
        }
      }
      ({ data } = await supabase.from("habits").select("*").eq("date", today));
    }
    if (data) setHabits(data as HabitRow[]);
  }

  async function toggleHabit(h: HabitRow) {
    const completed = !h.completed;
    setHabits((prev) => prev.map((x) => (x.id === h.id ? { ...x, completed } : x)));
    await supabase.from("habits").update({ completed }).eq("id", h.id);
  }

  /* ---------------- Goals ---------------- */
  async function loadGoals() {
    let { data } = await supabase
      .from("goals")
      .select("*")
      .eq("period", "month")
      .order("created_at", { ascending: true });

    if (!data || data.length === 0) {
      await supabase
        .from("goals")
        .insert(DEFAULT_GOALS.map((content) => ({ content, period: "month" })));
      ({ data } = await supabase
        .from("goals")
        .select("*")
        .eq("period", "month")
        .order("created_at", { ascending: true }));
    }
    if (data) setGoals(data as GoalRow[]);
  }

  async function addGoal(e: React.FormEvent) {
    e.preventDefault();
    const content = newGoal.trim();
    if (!content) return;
    setNewGoal("");
    await supabase.from("goals").insert({ content, period: "month" });
    loadGoals();
  }

  async function removeGoal(id: string) {
    setGoals((prev) => prev.filter((g) => g.id !== id));
    await supabase.from("goals").delete().eq("id", id);
    loadGoals();
  }

  /* ---------------- Finance ---------------- */
  async function loadFinance() {
    let { data } = await supabase.from("finance").select("*");
    if (!data || data.length === 0) {
      await supabase.from("finance").insert(DEFAULT_FINANCE);
      ({ data } = await supabase.from("finance").select("*"));
    }
    if (data) setFinance(data as FinanceRow[]);
  }

  const financeBy = (label: string) =>
    finance.find((f) => f.label === label)?.amount ?? 0;

  /* ---------------- Journal ---------------- */
  async function loadJournal() {
    const { data } = await supabase
      .from("journal")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1);
    if (data && data.length > 0) setJournal(data[0] as JournalRow);
  }

  async function saveJournal(e: React.FormEvent) {
    e.preventDefault();
    const text = journalDraft.trim();
    if (!text) return;
    setJournalDraft("");
    await supabase.from("journal").insert({ date: todayStr(), raw_transcript: text });
    loadJournal();
  }

  /* ---------------- Nutrition ---------------- */
  async function loadMeals() {
    const { data } = await supabase
      .from("nutrition")
      .select("*")
      .gte("eaten_at", `${todayStr()}T00:00:00`)
      .order("eaten_at", { ascending: true });
    if (data) setMeals(data as NutritionRow[]);
  }

  async function addMeal(e: React.FormEvent) {
    e.preventDefault();
    const meal = mealDraft.meal.trim();
    if (!meal) return;
    const calories = parseInt(mealDraft.calories, 10);
    const protein = parseInt(mealDraft.protein, 10);
    setMealDraft({ meal: "", calories: "", protein: "" });
    setShowMealForm(false);
    await supabase.from("nutrition").insert({
      meal,
      calories: Number.isNaN(calories) ? null : calories,
      protein: Number.isNaN(protein) ? null : protein,
    });
    loadMeals();
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  /* ---------------- Derived ---------------- */
  const keyTasks = tasks.filter((t) => t.starred);

  const kanban: Record<TaskView, TaskRow[]> = useMemo(
    () => ({
      today: tasks.filter((t) => t.view === "today"),
      week: tasks.filter((t) => t.view === "week"),
      month: tasks.filter((t) => t.view === "month"),
    }),
    [tasks]
  );

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of tasks) {
      if (t.category) counts[t.category] = (counts[t.category] ?? 0) + 1;
    }
    return counts;
  }, [tasks]);

  const habitParents = habits.filter((h) => h.parent_id === null);
  const habitTotal = habits.filter((h) => h.parent_id !== null).length;
  const habitDone = habits.filter((h) => h.parent_id !== null && h.completed).length;
  const habitPct = habitTotal === 0 ? 0 : Math.round((habitDone / habitTotal) * 100);

  const totalCalories = meals.reduce((s, m) => s + (m.calories ?? 0), 0);
  const totalProtein = meals.reduce((s, m) => s + (m.protein ?? 0), 0);
  const kcalLeft = Math.max(CALORIE_TARGET - totalCalories, 0);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  if (!authed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink text-muted">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink px-3 pb-28 pt-4 text-ghost md:px-5">
      {/* HEADER */}
      <header className="mb-4 flex items-center justify-between border-b border-line pb-3">
        <div className="flex items-baseline gap-3">
          <h1 className="text-lg font-semibold tracking-tight text-acid">Operator</h1>
          <span className="panel-title">Personal OS · V1</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="panel-title">
            {today} ·{" "}
            {new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
          </span>
          <button onClick={signOut} className="chip hover:text-acid">
            Sign out
          </button>
        </div>
      </header>

      {/* GRID */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        {/* LEFT COLUMN */}
        <div className="space-y-3 lg:col-span-3">
          {/* Finance Pulse — LIVE */}
          <section className="panel">
            <PanelTitle
              right={
                <button onClick={() => setRevealMoney((v) => !v)} className="chip hover:text-acid">
                  {revealMoney ? "Hide" : "Reveal"}
                </button>
              }
            >
              Finance Pulse
            </PanelTitle>
            <div className={revealMoney ? "" : "select-none blur-md"}>
              <div className="text-3xl font-semibold text-acid">
                {money(financeBy("net_worth"))}
              </div>
              <div className="mt-1 flex gap-4 text-[12px]">
                <span className="text-acidDim">Month +{money(financeBy("month_change"))}</span>
                <span className="text-acidDim">Today +{money(financeBy("day_change"))}</span>
              </div>
            </div>
            <div className="mt-3 flex h-12 items-end gap-1">
              {FINANCE_BARS.map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-sm bg-acid/60"
                  style={{ height: `${h * 3}%` }}
                />
              ))}
            </div>
          </section>

          {/* Key Tasks — LIVE from Supabase */}
          <section className="panel">
            <PanelTitle right={<span className="text-[10px] text-acidDim">live</span>}>
              Key Tasks · Today
            </PanelTitle>
            {keyTasks.length === 0 && (
              <p className="py-1 text-[12px] text-muted">No starred tasks yet — add one below.</p>
            )}
            {keyTasks.map((t) => (
              <Check
                key={t.id}
                checked={false}
                onChange={() => completeTask(t.id)}
                label={t.content}
                meta={t.category ?? undefined}
              />
            ))}
            <form onSubmit={addTask} className="mt-2 flex gap-2">
              <input
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                placeholder="+ add a key task"
                className="flex-1 rounded border border-line bg-panel2 px-2 py-1 text-[12px] text-ghost outline-none placeholder:text-muted focus:border-acid/50"
              />
              <button className="chip hover:text-acid">Add</button>
            </form>
          </section>

          {/* Daily Habits — LIVE */}
          <section className="panel">
            <PanelTitle right={<span className="text-[11px] text-acid">{habitPct}%</span>}>
              Daily Habits
            </PanelTitle>
            <div className="mb-3 h-1 w-full overflow-hidden rounded bg-line">
              <div className="h-full bg-acid transition-all" style={{ width: `${habitPct}%` }} />
            </div>
            <div className="space-y-3">
              {habitParents.length === 0 && (
                <p className="py-1 text-[12px] text-muted">Loading habits…</p>
              )}
              {habitParents.map((parent) => {
                const items = habits.filter((h) => h.parent_id === parent.id);
                const n = items.filter((h) => h.completed).length;
                return (
                  <div key={parent.id}>
                    <div className="mb-1 flex justify-between text-[11px] text-muted">
                      <span className="uppercase tracking-wider">{parent.name}</span>
                      <span>
                        {n}/{items.length}
                      </span>
                    </div>
                    {items.map((item) => (
                      <Check
                        key={item.id}
                        checked={item.completed}
                        onChange={() => toggleHabit(item)}
                        label={item.name}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* CENTER COLUMN */}
        <div className="space-y-3 lg:col-span-5">
          {/* Kanban — LIVE (tasks by view) */}
          <section className="panel">
            <PanelTitle>CRM · Kanban</PanelTitle>
            <div className="grid grid-cols-3 gap-2">
              {(["today", "week", "month"] as const).map((col) => (
                <div key={col} className="rounded border border-line bg-panel2 p-2">
                  <div className="mb-2 text-[10px] uppercase tracking-wider text-muted">
                    {col === "today" ? "Today" : col === "week" ? "This week" : "This month"}
                  </div>
                  <div className="space-y-2">
                    {kanban[col].map((c) => (
                      <button
                        key={c.id}
                        onClick={() => completeTask(c.id)}
                        title="Click to complete"
                        className="w-full rounded border border-line bg-panel p-2 text-left text-[12px] text-ghost hover:border-acid/40 hover:text-acid"
                      >
                        {c.content}
                      </button>
                    ))}
                  </div>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      addKanban(col);
                    }}
                    className="mt-2"
                  >
                    <input
                      value={kanbanDraft[col]}
                      onChange={(e) =>
                        setKanbanDraft((d) => ({ ...d, [col]: e.target.value }))
                      }
                      placeholder="+ add"
                      className="w-full rounded border border-line bg-panel px-2 py-1 text-[11px] text-ghost outline-none placeholder:text-muted focus:border-acid/50"
                    />
                  </form>
                </div>
              ))}
            </div>
          </section>

          {/* Brain — life categories (live counts) */}
          <section className="panel">
            <PanelTitle>Brain · Life Categories</PanelTitle>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map((key) => {
                const count = categoryCounts[key] ?? 0;
                return (
                  <div key={key} className="rounded border border-line bg-panel2 p-3">
                    <div className="text-[12px] uppercase tracking-wider text-ghost">{key}</div>
                    <div className="mt-1 text-[11px] text-muted">
                      {count} active {count === 1 ? "task" : "tasks"}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Journal — LIVE */}
          <section className="panel">
            <PanelTitle>Journal</PanelTitle>
            <button
              onClick={() => alert("Voice capture arrives in Phase 4 (Telegram + Whisper).")}
              className="mb-3 flex w-full items-center justify-center gap-2 rounded border border-acid/40 bg-acid/5 py-2 text-[12px] text-acid hover:bg-acid/10"
            >
              <span className="h-2 w-2 rounded-full bg-acid" />
              Hold to voice-note your day
            </button>
            <form onSubmit={saveJournal} className="mb-3 flex gap-2">
              <input
                value={journalDraft}
                onChange={(e) => setJournalDraft(e.target.value)}
                placeholder="+ jot a quick note"
                className="flex-1 rounded border border-line bg-panel2 px-2 py-1 text-[12px] text-ghost outline-none placeholder:text-muted focus:border-acid/50"
              />
              <button className="chip hover:text-acid">Save</button>
            </form>
            <div className="text-[11px] text-muted">
              {journal ? (
                <>
                  <div className="mb-1 uppercase tracking-wider">
                    {journal.date === todayStr() ? "Today" : journal.date}
                  </div>
                  {journal.ai_summary || journal.raw_transcript || "—"}
                </>
              ) : (
                <>
                  <div className="mb-1 uppercase tracking-wider">Journal</div>
                  No entries yet — jot a note above.
                </>
              )}
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-3 lg:col-span-4">
          {/* Calendar (no events table yet — static placeholder) */}
          <section className="panel">
            <PanelTitle right={<span className="h-1.5 w-1.5 rounded-full bg-acid" />}>
              Calendar · Today
            </PanelTitle>
            <div className="space-y-1">
              {CALENDAR.map((e, i) => (
                <div
                  key={i}
                  className="flex gap-3 rounded border border-line bg-panel2 px-2 py-1.5 text-[12px]"
                >
                  <span className="text-acidDim">{e.time}</span>
                  <span className="text-ghost">{e.label}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Goals — LIVE */}
          <section className="panel">
            <PanelTitle>Goals · This Month</PanelTitle>
            <ol className="space-y-1.5">
              {goals.map((g, i) => (
                <li key={g.id} className="group flex items-center gap-2 text-[13px] text-ghost">
                  <span className="text-acidDim">{i + 1}</span>
                  <span className="flex-1">{g.content}</span>
                  <button
                    onClick={() => removeGoal(g.id)}
                    title="Remove goal"
                    className="text-[11px] text-muted opacity-0 transition hover:text-acid group-hover:opacity-100"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ol>
            <form onSubmit={addGoal} className="mt-2 flex gap-2">
              <input
                value={newGoal}
                onChange={(e) => setNewGoal(e.target.value)}
                placeholder="+ add a goal"
                className="flex-1 rounded border border-line bg-panel2 px-2 py-1 text-[12px] text-ghost outline-none placeholder:text-muted focus:border-acid/50"
              />
              <button className="chip hover:text-acid">Add</button>
            </form>
          </section>

          {/* Nutrition — LIVE */}
          <section className="panel">
            <PanelTitle
              right={
                <button
                  onClick={() => setShowMealForm((v) => !v)}
                  className="chip hover:text-acid"
                >
                  + Log
                </button>
              }
            >
              Nutrition
            </PanelTitle>
            {showMealForm && (
              <form onSubmit={addMeal} className="mb-3 space-y-2">
                <input
                  value={mealDraft.meal}
                  onChange={(e) => setMealDraft((m) => ({ ...m, meal: e.target.value }))}
                  placeholder="meal"
                  className="w-full rounded border border-line bg-panel2 px-2 py-1 text-[12px] text-ghost outline-none placeholder:text-muted focus:border-acid/50"
                />
                <div className="flex gap-2">
                  <input
                    value={mealDraft.calories}
                    onChange={(e) => setMealDraft((m) => ({ ...m, calories: e.target.value }))}
                    inputMode="numeric"
                    placeholder="kcal"
                    className="w-full rounded border border-line bg-panel2 px-2 py-1 text-[12px] text-ghost outline-none placeholder:text-muted focus:border-acid/50"
                  />
                  <input
                    value={mealDraft.protein}
                    onChange={(e) => setMealDraft((m) => ({ ...m, protein: e.target.value }))}
                    inputMode="numeric"
                    placeholder="protein g"
                    className="w-full rounded border border-line bg-panel2 px-2 py-1 text-[12px] text-ghost outline-none placeholder:text-muted focus:border-acid/50"
                  />
                  <button className="chip hover:text-acid">Add</button>
                </div>
              </form>
            )}
            <div className="space-y-1">
              {meals.length === 0 && (
                <p className="py-1 text-[12px] text-muted">No meals logged today.</p>
              )}
              {meals.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between rounded border border-line bg-panel2 px-2 py-1.5 text-[12px]"
                >
                  <span className="text-ghost">{m.meal}</span>
                  <span className="text-muted">
                    {m.calories ?? 0} kcal · {m.protein ?? 0}p
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <Stat n={totalCalories} label="kcal" />
              <Stat n={totalProtein} label="protein g" />
              <Stat n={kcalLeft} label="kcal left" />
            </div>
          </section>
        </div>
      </div>

      {/* ASK BAR */}
      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-ink/95 px-3 py-3 backdrop-blur md:px-5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            alert("Wired in Phase 3 (AI): this will ask Claude using your live task data.");
          }}
          className="mx-auto flex max-w-5xl gap-2"
        >
          <input
            value={ask}
            onChange={(e) => setAsk(e.target.value)}
            placeholder="Ask your OS:  what are the top 3 things I should do right now?"
            className="flex-1 rounded border border-line bg-panel px-3 py-2 text-[13px] text-ghost outline-none placeholder:text-muted focus:border-acid/50"
          />
          <button className="rounded bg-acid px-5 py-2 text-[13px] font-semibold text-ink hover:bg-acid/90">
            Ask
          </button>
        </form>
      </div>
    </div>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="rounded border border-line bg-panel2 py-2">
      <div className="text-lg font-semibold text-acid">{n}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
    </div>
  );
}
