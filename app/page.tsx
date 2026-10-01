"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  HABIT_TEMPLATE,
  todayISO,
  fetchTasks,
  addTask as dbAddTask,
  completeTask as dbCompleteTask,
  ensureHabits,
  setHabitCompleted,
  fetchGoals,
  addGoal as dbAddGoal,
  deleteGoal as dbDeleteGoal,
  fetchMealsToday,
  addMeal as dbAddMeal,
  fetchFinance,
  fetchLatestJournal,
  type TaskRow,
  type HabitRow,
  type GoalRow,
  type MealRow,
  type FinanceRow,
  type JournalRow,
} from "@/lib/data";

/* ------------------------------------------------------------------ */
/*  STATIC BITS                                                        */
/*  These stay hard-coded on purpose:                                  */
/*   • FINANCE_BARS — a decorative sparkline (no time-series table).   */
/*   • CALENDAR     — there is no calendar table in schema.sql yet.    */
/*  Everything else below is now live from Supabase.                   */
/* ------------------------------------------------------------------ */

const FINANCE_BARS = [
  8, 10, 7, 12, 9, 14, 11, 16, 13, 18, 15, 20, 17, 22, 19, 24, 21, 26, 23, 28,
];

const CALENDAR = [
  { time: "09:30", label: "Standup w/ team" },
  { time: "11:30", label: "Investor call — fund II" },
  { time: "14:00", label: "Record finance video" },
  { time: "16:30", label: "1:1 with editor" },
];

// Life categories shown in the Brain panel. Counts are derived live from
// active tasks tagged with each category.
const CATEGORY_KEYS = ["legal", "finance", "content", "products", "opsec", "business"];

const DAILY_KCAL_TARGET = 2040;

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

  // Live data
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [habits, setHabits] = useState<HabitRow[]>([]);
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [meals, setMeals] = useState<MealRow[]>([]);
  const [finance, setFinance] = useState<FinanceRow[]>([]);
  const [journal, setJournal] = useState<JournalRow | null>(null);

  // Form state
  const [newTask, setNewTask] = useState("");
  const [newGoal, setNewGoal] = useState("");
  const [showMealForm, setShowMealForm] = useState(false);
  const [mealName, setMealName] = useState("");
  const [mealKcal, setMealKcal] = useState("");
  const [mealProtein, setMealProtein] = useState("");

  const [revealMoney, setRevealMoney] = useState(false);
  const [ask, setAsk] = useState("");

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
  }, [router]);

  async function loadAll() {
    const [t, h, g, m, f, j] = await Promise.all([
      fetchTasks(),
      ensureHabits(todayISO()),
      fetchGoals(),
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
  }

  /* ---------------- Tasks ---------------- */
  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    const content = newTask.trim();
    if (!content) return;
    setNewTask("");
    await dbAddTask({ content, starred: true, view: "today" });
    setTasks(await fetchTasks());
  }

  async function completeTask(id: string) {
    await dbCompleteTask(id);
    setTasks(await fetchTasks());
  }

  /* ---------------- Habits ---------------- */
  async function toggleHabit(h: HabitRow) {
    const next = !h.completed;
    // Optimistic update, then persist.
    setHabits((prev) =>
      prev.map((row) => (row.id === h.id ? { ...row, completed: next } : row))
    );
    await setHabitCompleted(h.id, next);
  }

  /* ---------------- Goals ---------------- */
  async function addGoal(e: React.FormEvent) {
    e.preventDefault();
    const content = newGoal.trim();
    if (!content) return;
    setNewGoal("");
    await dbAddGoal(content, "month");
    setGoals(await fetchGoals());
  }

  async function removeGoal(id: string) {
    await dbDeleteGoal(id);
    setGoals(await fetchGoals());
  }

  /* ---------------- Nutrition ---------------- */
  async function addMeal(e: React.FormEvent) {
    e.preventDefault();
    const name = mealName.trim();
    if (!name) return;
    await dbAddMeal(name, Number(mealKcal) || 0, Number(mealProtein) || 0);
    setMealName("");
    setMealKcal("");
    setMealProtein("");
    setShowMealForm(false);
    setMeals(await fetchMealsToday());
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  /* ---------------- Derived values ---------------- */
  const keyTasks = useMemo(
    () => tasks.filter((t) => t.starred && t.status === "active"),
    [tasks]
  );

  // Kanban columns from active tasks, grouped by their view.
  const kanban = useMemo(() => {
    const cols: Record<"today" | "week" | "month", TaskRow[]> = {
      today: [],
      week: [],
      month: [],
    };
    tasks
      .filter((t) => t.status === "active")
      .forEach((t) => cols[t.view]?.push(t));
    return cols;
  }, [tasks]);

  // Category counts from active tasks.
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    tasks
      .filter((t) => t.status === "active" && t.category)
      .forEach((t) => {
        const c = t.category as string;
        counts[c] = (counts[c] ?? 0) + 1;
      });
    return counts;
  }, [tasks]);

  // Habits grouped by parent, ordered to match the template.
  const habitGroups = useMemo(() => {
    const parents = habits.filter((h) => h.parent_id === null);
    const order = (name: string) => {
      const i = HABIT_TEMPLATE.findIndex((g) => g.name === name);
      return i === -1 ? 999 : i;
    };
    return parents
      .slice()
      .sort((a, b) => order(a.name) - order(b.name))
      .map((parent) => ({
        parent,
        items: habits.filter((h) => h.parent_id === parent.id),
      }));
  }, [habits]);

  const allChildHabits = useMemo(
    () => habits.filter((h) => h.parent_id !== null),
    [habits]
  );
  const habitPct =
    allChildHabits.length === 0
      ? 0
      : Math.round(
          (allChildHabits.filter((h) => h.completed).length /
            allChildHabits.length) *
            100
        );

  // Finance figures by label.
  const financeMap = useMemo(() => {
    const map: Record<string, number> = {};
    finance.forEach((row) => {
      if (row.amount != null) map[row.label.toLowerCase()] = Number(row.amount);
    });
    return map;
  }, [finance]);
  const netWorth = financeMap["net_worth"] ?? financeMap["net worth"] ?? 0;
  const monthChange = financeMap["month"] ?? 0;
  const dayChange = financeMap["day"] ?? financeMap["today"] ?? 0;

  // Nutrition totals.
  const kcalToday = meals.reduce((s, m) => s + (m.calories ?? 0), 0);
  const proteinToday = meals.reduce((s, m) => s + (m.protein ?? 0), 0);
  const kcalLeft = Math.max(DAILY_KCAL_TARGET - kcalToday, 0);

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
          <span className="panel-title">{today} · {new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</span>
          <button onClick={signOut} className="chip hover:text-acid">Sign out</button>
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
              <div className="text-3xl font-semibold text-acid">{money(netWorth)}</div>
              <div className="mt-1 flex gap-4 text-[12px]">
                <span className="text-acidDim">Month +{money(monthChange)}</span>
                <span className="text-acidDim">Today +{money(dayChange)}</span>
              </div>
            </div>
            <div className="mt-3 flex h-12 items-end gap-1">
              {FINANCE_BARS.map((h, i) => (
                <div key={i} className="flex-1 rounded-sm bg-acid/60" style={{ height: `${h * 3}%` }} />
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

          {/* Daily Habits — LIVE, saves on toggle */}
          <section className="panel">
            <PanelTitle right={<span className="text-[11px] text-acid">{habitPct}%</span>}>
              Daily Habits
            </PanelTitle>
            <div className="mb-3 h-1 w-full overflow-hidden rounded bg-line">
              <div className="h-full bg-acid transition-all" style={{ width: `${habitPct}%` }} />
            </div>
            <div className="space-y-3">
              {habitGroups.map(({ parent, items }) => {
                const n = items.filter((i) => i.completed).length;
                return (
                  <div key={parent.id}>
                    <div className="mb-1 flex justify-between text-[11px] text-muted">
                      <span className="uppercase tracking-wider">{parent.name}</span>
                      <span>{n}/{items.length}</span>
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
          {/* Kanban — LIVE from tasks */}
          <section className="panel">
            <PanelTitle>CRM · Kanban</PanelTitle>
            <div className="grid grid-cols-3 gap-2">
              {(["today", "week", "month"] as const).map((col) => (
                <div key={col} className="rounded border border-line bg-panel2 p-2">
                  <div className="mb-2 text-[10px] uppercase tracking-wider text-muted">
                    {col === "today" ? "Today" : col === "week" ? "This week" : "This month"}
                  </div>
                  <div className="space-y-2">
                    {kanban[col].length === 0 && (
                      <div className="text-[11px] text-muted">—</div>
                    )}
                    {kanban[col].map((t) => (
                      <div key={t.id} className="rounded border border-line bg-panel p-2 text-[12px] text-ghost">
                        {t.content}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Brain — life categories, counts LIVE from tasks */}
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
                      {n > 0 ? `${n} open` : "clear"}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Journal — latest entry LIVE (voice capture lands in Phase 4) */}
          <section className="panel">
            <PanelTitle>Journal</PanelTitle>
            <button className="mb-3 flex w-full items-center justify-center gap-2 rounded border border-acid/40 bg-acid/5 py-2 text-[12px] text-acid hover:bg-acid/10">
              <span className="h-2 w-2 rounded-full bg-acid" />
              Hold to voice-note your day
            </button>
            <div className="text-[11px] text-muted">
              {journal ? (
                <>
                  <div className="mb-1 uppercase tracking-wider">{journal.date}</div>
                  {journal.ai_summary || journal.raw_transcript || "No summary yet."}
                </>
              ) : (
                <>
                  <div className="mb-1 uppercase tracking-wider">No entries yet</div>
                  Your voice notes and summaries will appear here.
                </>
              )}
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-3 lg:col-span-4">
          {/* Calendar — static for now (no calendar table in schema) */}
          <section className="panel">
            <PanelTitle right={<span className="h-1.5 w-1.5 rounded-full bg-acid" />}>
              Calendar · Today
            </PanelTitle>
            <div className="space-y-1">
              {CALENDAR.map((e, i) => (
                <div key={i} className="flex gap-3 rounded border border-line bg-panel2 px-2 py-1.5 text-[12px]">
                  <span className="text-acidDim">{e.time}</span>
                  <span className="text-ghost">{e.label}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Goals — LIVE, saves on add */}
          <section className="panel">
            <PanelTitle>Goals · This Month</PanelTitle>
            {goals.length === 0 && (
              <p className="py-1 text-[12px] text-muted">No goals yet — add one below.</p>
            )}
            <ol className="space-y-1.5">
              {goals.map((g, i) => (
                <li key={g.id} className="group flex items-center gap-2 text-[13px] text-ghost">
                  <span className="text-acidDim">{i + 1}</span>
                  <span className="flex-1">{g.content}</span>
                  <button
                    onClick={() => removeGoal(g.id)}
                    className="text-[11px] text-muted opacity-0 transition-opacity hover:text-acid group-hover:opacity-100"
                    aria-label="Remove goal"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ol>
            <form onSubmit={addGoal} className="mt-3 flex gap-2">
              <input
                value={newGoal}
                onChange={(e) => setNewGoal(e.target.value)}
                placeholder="+ add a goal"
                className="flex-1 rounded border border-line bg-panel2 px-2 py-1 text-[12px] text-ghost outline-none placeholder:text-muted focus:border-acid/50"
              />
              <button className="chip hover:text-acid">Add</button>
            </form>
          </section>

          {/* Nutrition — LIVE, saves on log */}
          <section className="panel">
            <PanelTitle
              right={
                <button
                  onClick={() => setShowMealForm((v) => !v)}
                  className="chip hover:text-acid"
                >
                  {showMealForm ? "Close" : "+ Log"}
                </button>
              }
            >
              Nutrition
            </PanelTitle>
            {showMealForm && (
              <form onSubmit={addMeal} className="mb-3 space-y-2">
                <input
                  value={mealName}
                  onChange={(e) => setMealName(e.target.value)}
                  placeholder="meal"
                  className="w-full rounded border border-line bg-panel2 px-2 py-1 text-[12px] text-ghost outline-none placeholder:text-muted focus:border-acid/50"
                />
                <div className="flex gap-2">
                  <input
                    value={mealKcal}
                    onChange={(e) => setMealKcal(e.target.value)}
                    inputMode="numeric"
                    placeholder="kcal"
                    className="w-full rounded border border-line bg-panel2 px-2 py-1 text-[12px] text-ghost outline-none placeholder:text-muted focus:border-acid/50"
                  />
                  <input
                    value={mealProtein}
                    onChange={(e) => setMealProtein(e.target.value)}
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
                <p className="py-1 text-[12px] text-muted">Nothing logged today.</p>
              )}
              {meals.map((m) => (
                <div key={m.id} className="flex items-center justify-between rounded border border-line bg-panel2 px-2 py-1.5 text-[12px]">
                  <span className="text-ghost">{m.meal}</span>
                  <span className="text-muted">{m.calories ?? 0} kcal · {m.protein ?? 0}p</span>
                </div>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <Stat n={kcalToday} label="kcal" />
              <Stat n={proteinToday} label="protein g" />
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
