"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  TaskRow,
  HabitRow,
  JournalRow,
  NutritionRow,
  GoalRow,
  FinanceRow,
  todayStr,
} from "@/lib/db";

/* ------------------------------------------------------------------ */
/*  STATIC / DECORATIVE BITS                                           */
/*  Everything the dashboard can source from supabase/schema.sql is   */
/*  now loaded live (see loadAll). The few constants below have no     */
/*  backing table in the Phase 2 schema, so they stay as visuals:      */
/*    - FINANCE_BARS: a decorative sparkline (no history table yet).   */
/*    - CALENDAR: there is no calendar table in schema.sql — deferred. */
/*    - CATEGORY_KEYS: the fixed life-areas; counts come from tasks.   */
/*    - PROTEIN_TARGET: no target column in the health table.          */
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

const CATEGORY_KEYS = [
  "legal",
  "finance",
  "content",
  "products",
  "opsec",
  "business",
];

const CALORIE_TARGET = 2800;

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

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-1 text-[12px] text-muted">{children}</p>;
}

/* ------------------------------------------------------------------ */
/*  PAGE                                                               */
/* ------------------------------------------------------------------ */

export default function Dashboard() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);

  // --- live data pulled from Supabase ---
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [habits, setHabits] = useState<HabitRow[]>([]);
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [meals, setMeals] = useState<NutritionRow[]>([]);
  const [finance, setFinance] = useState<FinanceRow[]>([]);
  const [journalEntry, setJournalEntry] = useState<JournalRow | null>(null);

  // --- local UI state ---
  const [newTask, setNewTask] = useState("");
  const [newGoal, setNewGoal] = useState("");
  const [logging, setLogging] = useState(false);
  const [mealForm, setMealForm] = useState({ meal: "", calories: "", protein: "" });
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

  /* --------------------------- loaders --------------------------- */

  async function loadTasks() {
    const { data } = await supabase
      .from("tasks")
      .select("*")
      .order("priority", { ascending: false });
    setTasks((data as TaskRow[]) ?? []);
  }

  async function loadHabits() {
    const { data } = await supabase
      .from("habits")
      .select("*")
      .eq("date", todayStr());
    setHabits((data as HabitRow[]) ?? []);
  }

  async function loadGoals() {
    const { data } = await supabase
      .from("goals")
      .select("*")
      .order("created_at", { ascending: true });
    setGoals((data as GoalRow[]) ?? []);
  }

  async function loadMeals() {
    // Meals eaten today (eaten_at within the local day).
    const start = `${todayStr()}T00:00:00`;
    const { data } = await supabase
      .from("nutrition")
      .select("*")
      .gte("eaten_at", start)
      .order("eaten_at", { ascending: true });
    setMeals((data as NutritionRow[]) ?? []);
  }

  async function loadFinance() {
    const { data } = await supabase
      .from("finance")
      .select("*")
      .order("as_of", { ascending: false });
    setFinance((data as FinanceRow[]) ?? []);
  }

  async function loadJournal() {
    const { data } = await supabase
      .from("journal")
      .select("*")
      .order("date", { ascending: false })
      .limit(1);
    setJournalEntry((data?.[0] as JournalRow) ?? null);
  }

  function loadAll() {
    loadTasks();
    loadHabits();
    loadGoals();
    loadMeals();
    loadFinance();
    loadJournal();
  }

  /* --------------------------- mutations ------------------------- */

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    const content = newTask.trim();
    if (!content) return;
    setNewTask("");
    await supabase.from("tasks").insert({ content, starred: true, view: "today" });
    loadTasks();
  }

  async function completeTask(id: string) {
    await supabase.from("tasks").update({ status: "done" }).eq("id", id);
    loadTasks();
  }

  async function toggleHabit(h: HabitRow) {
    // optimistic flip, then persist
    setHabits((hs) =>
      hs.map((x) => (x.id === h.id ? { ...x, completed: !x.completed } : x))
    );
    await supabase
      .from("habits")
      .update({ completed: !h.completed })
      .eq("id", h.id);
  }

  async function addGoal(e: React.FormEvent) {
    e.preventDefault();
    const content = newGoal.trim();
    if (!content) return;
    setNewGoal("");
    await supabase.from("goals").insert({ content, period: "month" });
    loadGoals();
  }

  async function addMeal(e: React.FormEvent) {
    e.preventDefault();
    const meal = mealForm.meal.trim();
    if (!meal) return;
    const calories = mealForm.calories ? Number(mealForm.calories) : null;
    const protein = mealForm.protein ? Number(mealForm.protein) : null;
    setMealForm({ meal: "", calories: "", protein: "" });
    setLogging(false);
    await supabase.from("nutrition").insert({ meal, calories, protein });
    loadMeals();
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  /* --------------------------- derived --------------------------- */

  const keyTasks = useMemo(
    () => tasks.filter((t) => t.starred && t.status === "active"),
    [tasks]
  );

  const kanban = useMemo(() => {
    const cols: Record<"today" | "week" | "month", TaskRow[]> = {
      today: [],
      week: [],
      month: [],
    };
    for (const t of tasks) {
      if (t.status === "active") cols[t.view]?.push(t);
    }
    return cols;
  }, [tasks]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of tasks) {
      if (t.status === "active" && t.category) {
        counts[t.category] = (counts[t.category] ?? 0) + 1;
      }
    }
    return counts;
  }, [tasks]);

  // habit grouping: top-level rows are group headers (if they have
  // children) or standalone items; leaves drive the completion %.
  const { habitGroups, habitStandalone, habitPct } = useMemo(() => {
    const parentIds = new Set(
      habits.map((h) => h.parent_id).filter(Boolean) as string[]
    );
    const leaves = habits.filter((h) => !parentIds.has(h.id));
    const pct = leaves.length
      ? Math.round((leaves.filter((h) => h.completed).length / leaves.length) * 100)
      : 0;
    const topLevel = habits.filter((h) => h.parent_id == null);
    const groups = topLevel
      .map((g) => ({ group: g, items: habits.filter((h) => h.parent_id === g.id) }))
      .filter((g) => g.items.length > 0);
    const standalone = topLevel.filter(
      (h) => !habits.some((c) => c.parent_id === h.id)
    );
    return { habitGroups: groups, habitStandalone: standalone, habitPct: pct };
  }, [habits]);

  const financeMap = useMemo(() => {
    const m: Record<string, number> = {};
    for (const f of finance) {
      // keep the most recent value per label (finance is sorted desc)
      if (!(f.label in m) && f.amount != null) m[f.label] = Number(f.amount);
    }
    return m;
  }, [finance]);

  const nutritionTotals = useMemo(() => {
    const calories = meals.reduce((s, m) => s + (m.calories ?? 0), 0);
    const protein = meals.reduce((s, m) => s + (m.protein ?? 0), 0);
    return { calories, protein };
  }, [meals]);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  const money = (n: number | undefined) =>
    n == null
      ? "—"
      : "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });

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
          {/* Finance Pulse — LIVE from Supabase */}
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
              <div className="text-3xl font-semibold text-acid">{money(financeMap.net_worth)}</div>
              <div className="mt-1 flex gap-4 text-[12px]">
                <span className="text-acidDim">Month +{money(financeMap.month)}</span>
                <span className="text-acidDim">Today +{money(financeMap.today)}</span>
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
              <Empty>No starred tasks yet — add one below.</Empty>
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

          {/* Daily Habits — LIVE from Supabase */}
          <section className="panel">
            <PanelTitle right={<span className="text-[11px] text-acid">{habitPct}%</span>}>
              Daily Habits
            </PanelTitle>
            <div className="mb-3 h-1 w-full overflow-hidden rounded bg-line">
              <div className="h-full bg-acid transition-all" style={{ width: `${habitPct}%` }} />
            </div>
            {habitGroups.length === 0 && habitStandalone.length === 0 && (
              <Empty>No habits for today yet. Add rows to the `habits` table to track them here.</Empty>
            )}
            <div className="space-y-3">
              {habitGroups.map(({ group, items }) => {
                const n = items.filter((h) => h.completed).length;
                return (
                  <div key={group.id}>
                    <div className="mb-1 flex justify-between text-[11px] text-muted">
                      <span className="uppercase tracking-wider">{group.name}</span>
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
              {habitStandalone.length > 0 && (
                <div>
                  {habitGroups.length > 0 && (
                    <div className="mb-1 text-[11px] uppercase tracking-wider text-muted">Other</div>
                  )}
                  {habitStandalone.map((item) => (
                    <Check
                      key={item.id}
                      checked={item.completed}
                      onChange={() => toggleHabit(item)}
                      label={item.name}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>

        {/* CENTER COLUMN */}
        <div className="space-y-3 lg:col-span-5">
          {/* Kanban — LIVE from tasks grouped by view */}
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
                  <div
                    key={key}
                    className={`rounded border bg-panel2 p-3 ${
                      n > 0 ? "border-acid/40" : "border-line"
                    }`}
                  >
                    <div className={`text-[12px] uppercase tracking-wider ${n > 0 ? "text-acid" : "text-ghost"}`}>
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

          {/* Journal — LIVE latest entry */}
          <section className="panel">
            <PanelTitle>Journal</PanelTitle>
            <button className="mb-3 flex w-full items-center justify-center gap-2 rounded border border-acid/40 bg-acid/5 py-2 text-[12px] text-acid hover:bg-acid/10">
              <span className="h-2 w-2 rounded-full bg-acid" />
              Hold to voice-note your day
            </button>
            {journalEntry ? (
              <div className="text-[11px] text-muted">
                <div className="mb-1 uppercase tracking-wider">{journalEntry.date}</div>
                {journalEntry.ai_summary ||
                  journalEntry.raw_transcript ||
                  "No summary yet."}
              </div>
            ) : (
              <Empty>No journal entries yet.</Empty>
            )}
          </section>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-3 lg:col-span-4">
          {/* Calendar — static placeholder (no calendar table in schema yet) */}
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

          {/* Goals — LIVE from Supabase */}
          <section className="panel">
            <PanelTitle>Goals · This Month</PanelTitle>
            {goals.length === 0 && <Empty>No goals yet — add one below.</Empty>}
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
                placeholder="+ add a goal"
                className="flex-1 rounded border border-line bg-panel2 px-2 py-1 text-[12px] text-ghost outline-none placeholder:text-muted focus:border-acid/50"
              />
              <button className="chip hover:text-acid">Add</button>
            </form>
          </section>

          {/* Nutrition — LIVE from Supabase */}
          <section className="panel">
            <PanelTitle
              right={
                <button onClick={() => setLogging((v) => !v)} className="chip hover:text-acid">
                  {logging ? "Close" : "+ Log"}
                </button>
              }
            >
              Nutrition
            </PanelTitle>
            {meals.length === 0 && <Empty>Nothing logged today.</Empty>}
            <div className="space-y-1">
              {meals.map((m) => (
                <div key={m.id} className="flex items-center justify-between rounded border border-line bg-panel2 px-2 py-1.5 text-[12px]">
                  <span className="text-ghost">{m.meal}</span>
                  <span className="text-muted">{m.calories ?? 0} kcal · {m.protein ?? 0}p</span>
                </div>
              ))}
            </div>
            {logging && (
              <form onSubmit={addMeal} className="mt-2 space-y-2">
                <input
                  value={mealForm.meal}
                  onChange={(e) => setMealForm((f) => ({ ...f, meal: e.target.value }))}
                  placeholder="meal"
                  className="w-full rounded border border-line bg-panel2 px-2 py-1 text-[12px] text-ghost outline-none placeholder:text-muted focus:border-acid/50"
                />
                <div className="flex gap-2">
                  <input
                    value={mealForm.calories}
                    onChange={(e) => setMealForm((f) => ({ ...f, calories: e.target.value }))}
                    placeholder="kcal"
                    inputMode="numeric"
                    className="w-1/2 rounded border border-line bg-panel2 px-2 py-1 text-[12px] text-ghost outline-none placeholder:text-muted focus:border-acid/50"
                  />
                  <input
                    value={mealForm.protein}
                    onChange={(e) => setMealForm((f) => ({ ...f, protein: e.target.value }))}
                    placeholder="protein g"
                    inputMode="numeric"
                    className="w-1/2 rounded border border-line bg-panel2 px-2 py-1 text-[12px] text-ghost outline-none placeholder:text-muted focus:border-acid/50"
                  />
                </div>
                <button className="chip hover:text-acid">Save meal</button>
              </form>
            )}
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <Stat n={nutritionTotals.calories} label="kcal" />
              <Stat n={nutritionTotals.protein} label="protein g" />
              <Stat n={Math.max(CALORIE_TARGET - nutritionTotals.calories, 0)} label="kcal left" />
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
