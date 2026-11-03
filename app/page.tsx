"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  type TaskRow,
  type HabitRow,
  type GoalRow,
  type NutritionRow,
  type FinanceRow,
  type JournalRow,
  fetchTasks,
  fetchHabitsForToday,
  fetchGoals,
  fetchMealsToday,
  fetchFinance,
  fetchLatestJournal,
  insertTask,
  setTaskStatus,
  setHabitCompleted,
  insertHabit,
  insertGoal,
  insertMeal,
} from "@/lib/db";

/* ------------------------------------------------------------------ */
/*  STATIC DISPLAY CONFIG                                              */
/*  Not data — these are fixed labels/targets the UI renders around.  */
/*  Everything that is *data* now comes live from Supabase (Phase 2). */
/* ------------------------------------------------------------------ */

// Decorative sparkline for the finance panel (no time-series in schema).
const FINANCE_BARS = [
  8, 10, 7, 12, 9, 14, 11, 16, 13, 18, 15, 20, 17, 22, 19, 24, 21, 26, 23, 28,
];

// The six life categories (mirrors the `tasks.category` comment in schema.sql).
const CATEGORY_KEYS = [
  "legal",
  "finance",
  "content",
  "products",
  "opsec",
  "business",
] as const;

// Calendar has no table in the schema yet — left as a placeholder panel.
const CALENDAR = [
  { time: "09:30", label: "Standup w/ team" },
  { time: "11:30", label: "Investor call — fund II" },
  { time: "14:00", label: "Record finance video" },
  { time: "16:30", label: "1:1 with editor" },
];

const CALORIE_TARGET = 2040; // daily kcal goal (display only)

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

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="rounded border border-line bg-panel2 py-2">
      <div className="text-lg font-semibold text-acid">{n}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  PAGE                                                               */
/* ------------------------------------------------------------------ */

export default function Dashboard() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);

  // Live data
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [habits, setHabits] = useState<HabitRow[]>([]);
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [meals, setMeals] = useState<NutritionRow[]>([]);
  const [finance, setFinance] = useState<FinanceRow[]>([]);
  const [journal, setJournal] = useState<JournalRow | null>(null);

  // UI state
  const [newTask, setNewTask] = useState("");
  const [newHabit, setNewHabit] = useState("");
  const [newGoal, setNewGoal] = useState("");
  const [revealMoney, setRevealMoney] = useState(false);
  const [ask, setAsk] = useState("");

  const loadAll = useCallback(async () => {
    const [t, h, g, m, f, j] = await Promise.all([
      fetchTasks(),
      fetchHabitsForToday(),
      fetchGoals("month"),
      fetchMealsToday(),
      fetchFinance(),
      fetchLatestJournal(),
    ]);
    setTasks(t);
    setHabits(h);
    setGoals(g);
    setMeals(m);
    setFinance(f);
    setJournal(j);
  }, []);

  // --- Auth gate: redirect to /login if not signed in ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace("/login");
      } else {
        setAuthed(true);
        loadAll();
      }
    });
  }, [router, loadAll]);

  /* ---- Task actions ---- */
  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    const content = newTask.trim();
    if (!content) return;
    setNewTask("");
    await insertTask(content);
    loadAll();
  }

  async function completeTask(id: string) {
    await setTaskStatus(id, "done");
    loadAll();
  }

  /* ---- Habit actions ---- */
  async function toggleHabit(h: HabitRow) {
    // optimistic
    setHabits((prev) =>
      prev.map((x) => (x.id === h.id ? { ...x, completed: !x.completed } : x))
    );
    await setHabitCompleted(h.id, !h.completed);
  }

  async function addHabit(e: React.FormEvent) {
    e.preventDefault();
    const name = newHabit.trim();
    if (!name) return;
    setNewHabit("");
    await insertHabit(name);
    loadAll();
  }

  /* ---- Goal actions ---- */
  async function addGoal(e: React.FormEvent) {
    e.preventDefault();
    const content = newGoal.trim();
    if (!content) return;
    setNewGoal("");
    await insertGoal(content, "month");
    loadAll();
  }

  /* ---- Nutrition actions ---- */
  async function logMeal() {
    const meal = window.prompt("Meal?");
    if (!meal || !meal.trim()) return;
    const cal = window.prompt("Calories? (optional)");
    const pro = window.prompt("Protein (g)? (optional)");
    const calories = cal && cal.trim() ? Number(cal) : null;
    const protein = pro && pro.trim() ? Number(pro) : null;
    await insertMeal(
      meal.trim(),
      Number.isFinite(calories as number) ? calories : null,
      Number.isFinite(protein as number) ? protein : null
    );
    loadAll();
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  /* ---- Derived views ---- */
  const keyTasks = tasks.filter((t) => t.starred && t.status === "active");

  // Kanban columns from live tasks (active, grouped by `view`).
  const kanban = useMemo(() => {
    const active = tasks.filter((t) => t.status === "active");
    return {
      today: active.filter((t) => t.view === "today"),
      week: active.filter((t) => t.view === "week"),
      month: active.filter((t) => t.view === "month"),
    };
  }, [tasks]);

  // Brain categories: live counts of active tasks per category.
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of tasks) {
      if (t.status !== "active" || !t.category) continue;
      counts[t.category] = (counts[t.category] ?? 0) + 1;
    }
    return counts;
  }, [tasks]);

  // Habits grouped by parent. Leaf habits are the checkable ones.
  const habitGroups = useMemo(() => {
    const childrenByParent = new Map<string, HabitRow[]>();
    for (const h of habits) {
      if (h.parent_id) {
        const arr = childrenByParent.get(h.parent_id) ?? [];
        arr.push(h);
        childrenByParent.set(h.parent_id, arr);
      }
    }
    const parents = habits.filter((h) => h.parent_id === null);
    const groups: { name: string | null; items: HabitRow[] }[] = [];
    const standalone: HabitRow[] = [];
    for (const p of parents) {
      const kids = childrenByParent.get(p.id);
      if (kids && kids.length) groups.push({ name: p.name, items: kids });
      else standalone.push(p);
    }
    if (standalone.length) groups.push({ name: "Habits", items: standalone });
    return groups;
  }, [habits]);

  const leafHabits = useMemo(
    () => habitGroups.flatMap((g) => g.items),
    [habitGroups]
  );
  const habitPct =
    leafHabits.length === 0
      ? 0
      : Math.round(
          (leafHabits.filter((h) => h.completed).length / leafHabits.length) * 100
        );

  // Nutrition totals from today's live meals.
  const consumedCals = meals.reduce((s, m) => s + (m.calories ?? 0), 0);
  const consumedProtein = meals.reduce((s, m) => s + (m.protein ?? 0), 0);
  const calsLeft = Math.max(CALORIE_TARGET - consumedCals, 0);

  // Finance: hero = a "net worth" labeled row if present, else most recent.
  const netWorthRow =
    finance.find((f) => /net\s*worth/i.test(f.label)) ?? finance[0] ?? null;
  const otherFinance = finance.filter((f) => f.id !== netWorthRow?.id).slice(0, 3);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  const money = (n: number) =>
    "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });

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
            {new Date().toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
            })}
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
                <button
                  onClick={() => setRevealMoney((v) => !v)}
                  className="chip hover:text-acid"
                >
                  {revealMoney ? "Hide" : "Reveal"}
                </button>
              }
            >
              Finance Pulse
            </PanelTitle>
            <div className={revealMoney ? "" : "select-none blur-md"}>
              {netWorthRow ? (
                <>
                  <div className="text-3xl font-semibold text-acid">
                    {money(netWorthRow.amount ?? 0)}
                  </div>
                  <div className="mt-1 text-[11px] uppercase tracking-wider text-muted">
                    {netWorthRow.label}
                  </div>
                  {otherFinance.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-4 text-[12px]">
                      {otherFinance.map((f) => (
                        <span key={f.id} className="text-acidDim">
                          {f.label} {money(f.amount ?? 0)}
                        </span>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <p className="py-1 text-[12px] text-muted">
                  No finance entries yet — add rows to the `finance` table.
                </p>
              )}
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

          {/* Key Tasks — LIVE */}
          <section className="panel">
            <PanelTitle right={<span className="text-[10px] text-acidDim">live</span>}>
              Key Tasks · Today
            </PanelTitle>
            {keyTasks.length === 0 && (
              <p className="py-1 text-[12px] text-muted">
                No starred tasks yet — add one below.
              </p>
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
              <div
                className="h-full bg-acid transition-all"
                style={{ width: `${habitPct}%` }}
              />
            </div>
            {leafHabits.length === 0 && (
              <p className="py-1 text-[12px] text-muted">
                No habits for today — add one below.
              </p>
            )}
            <div className="space-y-3">
              {habitGroups.map((g) => {
                const n = g.items.filter((h) => h.completed).length;
                return (
                  <div key={g.name ?? "ungrouped"}>
                    {g.name && (
                      <div className="mb-1 flex justify-between text-[11px] text-muted">
                        <span className="uppercase tracking-wider">{g.name}</span>
                        <span>
                          {n}/{g.items.length}
                        </span>
                      </div>
                    )}
                    {g.items.map((h) => (
                      <Check
                        key={h.id}
                        checked={h.completed}
                        onChange={() => toggleHabit(h)}
                        label={h.name}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
            <form onSubmit={addHabit} className="mt-3 flex gap-2">
              <input
                value={newHabit}
                onChange={(e) => setNewHabit(e.target.value)}
                placeholder="+ add a habit for today"
                className="flex-1 rounded border border-line bg-panel2 px-2 py-1 text-[12px] text-ghost outline-none placeholder:text-muted focus:border-acid/50"
              />
              <button className="chip hover:text-acid">Add</button>
            </form>
          </section>
        </div>

        {/* CENTER COLUMN */}
        <div className="space-y-3 lg:col-span-5">
          {/* Kanban — LIVE from tasks.view */}
          <section className="panel">
            <PanelTitle>CRM · Kanban</PanelTitle>
            <div className="grid grid-cols-3 gap-2">
              {(["today", "week", "month"] as const).map((col) => (
                <div key={col} className="rounded border border-line bg-panel2 p-2">
                  <div className="mb-2 text-[10px] uppercase tracking-wider text-muted">
                    {col === "today"
                      ? "Today"
                      : col === "week"
                      ? "This week"
                      : "This month"}
                  </div>
                  <div className="space-y-2">
                    {kanban[col].length === 0 && (
                      <div className="text-[11px] text-muted">—</div>
                    )}
                    {kanban[col].map((t) => (
                      <div
                        key={t.id}
                        className="rounded border border-line bg-panel p-2 text-[12px] text-ghost"
                      >
                        {t.content}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Brain — live category counts */}
          <section className="panel">
            <PanelTitle>Brain · Life Categories</PanelTitle>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORY_KEYS.map((key) => {
                const n = categoryCounts[key] ?? 0;
                return (
                  <div key={key} className="rounded border border-line bg-panel2 p-3">
                    <div className="text-[12px] uppercase tracking-wider text-ghost">
                      {key}
                    </div>
                    <div className="mt-1 text-[11px] text-muted">
                      {n === 0 ? "clear" : `${n} active`}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Journal — latest live entry */}
          <section className="panel">
            <PanelTitle>Journal</PanelTitle>
            <button
              onClick={() =>
                alert("Voice capture arrives in Phase 4 (Telegram + Whisper).")
              }
              className="mb-3 flex w-full items-center justify-center gap-2 rounded border border-acid/40 bg-acid/5 py-2 text-[12px] text-acid hover:bg-acid/10"
            >
              <span className="h-2 w-2 rounded-full bg-acid" />
              Hold to voice-note your day
            </button>
            {journal ? (
              <div className="text-[11px] text-muted">
                <div className="mb-1 uppercase tracking-wider">{journal.date}</div>
                {journal.ai_summary ||
                  journal.raw_transcript ||
                  "Entry recorded — no summary yet."}
              </div>
            ) : (
              <p className="text-[11px] text-muted">
                No journal entries yet.
              </p>
            )}
          </section>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-3 lg:col-span-4">
          {/* Calendar (placeholder — no table in schema yet) */}
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
            {goals.length === 0 && (
              <p className="py-1 text-[12px] text-muted">
                No goals yet — add one below.
              </p>
            )}
            <ol className="space-y-1.5">
              {goals.map((g, i) => (
                <li key={g.id} className="flex gap-2 text-[13px] text-ghost">
                  <span className="text-acidDim">{i + 1}</span>
                  {g.content}
                </li>
              ))}
            </ol>
            <form onSubmit={addGoal} className="mt-3 flex gap-2">
              <input
                value={newGoal}
                onChange={(e) => setNewGoal(e.target.value)}
                placeholder="+ add a monthly goal"
                className="flex-1 rounded border border-line bg-panel2 px-2 py-1 text-[12px] text-ghost outline-none placeholder:text-muted focus:border-acid/50"
              />
              <button className="chip hover:text-acid">Add</button>
            </form>
          </section>

          {/* Nutrition — LIVE */}
          <section className="panel">
            <PanelTitle
              right={
                <button onClick={logMeal} className="chip hover:text-acid">
                  + Log
                </button>
              }
            >
              Nutrition
            </PanelTitle>
            {meals.length === 0 && (
              <p className="py-1 text-[12px] text-muted">
                No meals logged today.
              </p>
            )}
            <div className="space-y-1">
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
              <Stat n={consumedCals} label="kcal" />
              <Stat n={consumedProtein} label="protein g" />
              <Stat n={calsLeft} label="kcal left" />
            </div>
          </section>
        </div>
      </div>

      {/* ASK BAR */}
      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-ink/95 px-3 py-3 backdrop-blur md:px-5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            alert(
              "Wired in Phase 3 (AI): this will ask Claude using your live task data."
            );
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
