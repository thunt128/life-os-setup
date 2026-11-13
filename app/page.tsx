"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

/* ------------------------------------------------------------------ */
/*  ROW TYPES — these mirror the tables in supabase/schema.sql         */
/* ------------------------------------------------------------------ */

type TaskRow = {
  id: string;
  content: string;
  category: string | null;
  priority: number;
  starred: boolean;
  status: "active" | "done" | "archived";
  view: "today" | "week" | "month";
};

type HabitRow = {
  id: string;
  name: string;
  parent_id: string | null;
  date: string;
  completed: boolean;
};

type GoalRow = {
  id: string;
  content: string;
  period: "week" | "month" | null;
};

type MealRow = {
  id: string;
  meal: string;
  calories: number | null;
  protein: number | null;
  eaten_at: string;
};

type FinanceRow = { id: string; label: string; amount: number | null };

type JournalRow = {
  id: string;
  date: string;
  raw_transcript: string | null;
  ai_summary: string | null;
};

/* ------------------------------------------------------------------ */
/*  STATIC CONFIG / FALLBACKS                                          */
/*  Panels without a backing table (Categories, Calendar) stay as     */
/*  shell data for now. Finance falls back to these numbers until the  */
/*  `finance` table has rows. The bar chart is decorative (there is no */
/*  time-series table yet).                                            */
/* ------------------------------------------------------------------ */

const FINANCE_FALLBACK = { netWorth: 2481300, month: 184000, day: 56210 };

const FINANCE_BARS = [
  8, 10, 7, 12, 9, 14, 11, 16, 13, 18, 15, 20, 17, 22, 19, 24, 21, 26, 23, 28,
];

// Used once, to seed today's habits when the `habits` table has no rows for
// today. After seeding, the rows in Supabase are the source of truth.
const HABIT_TEMPLATE = [
  { name: "Morning", items: ["Warm-up", "Lift", "Stretch"] },
  { name: "Supplements", items: ["Creatine", "Omega-3", "Vit D", "Magnesium"] },
  { name: "Deep work", items: ["Scroll X", "Market research", "Ideate"] },
  { name: "Comms", items: ["Reply DMs", "Engage comments"] },
  { name: "Build", items: ["Portfolio", "Risk scan", "Dashboard"] },
];

const CATEGORIES = [
  { key: "legal", note: "2 open" },
  { key: "finance", note: "live · synced" },
  { key: "content", note: "4 in pipeline" },
  { key: "products", note: "1 shipping" },
  { key: "opsec", note: "backup overdue", warn: true },
  { key: "business", note: "3 opportunities" },
];

const CALENDAR = [
  { time: "09:30", label: "Standup w/ team" },
  { time: "11:30", label: "Investor call — fund II" },
  { time: "14:00", label: "Record finance video" },
  { time: "16:30", label: "1:1 with editor" },
];

const CALORIE_TARGET = 2040;

const KANBAN_COLS = [
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
] as const;

/* ------------------------------------------------------------------ */
/*  DATE HELPERS                                                       */
/*  Compute "today" on the client and pass it explicitly so client and */
/*  database agree regardless of the DB's timezone.                    */
/* ------------------------------------------------------------------ */

const todayISO = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD, local
const startOfTodayISO = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

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
  const [finance, setFinance] = useState(FINANCE_FALLBACK);
  const [journal, setJournal] = useState<JournalRow | null>(null);

  // Local form state
  const [newTask, setNewTask] = useState("");
  const [revealMoney, setRevealMoney] = useState(false);
  const [ask, setAsk] = useState("");
  const [seedingHabits, setSeedingHabits] = useState(false);

  const [newGoal, setNewGoal] = useState("");
  const [showLog, setShowLog] = useState(false);
  const [mealName, setMealName] = useState("");
  const [mealCals, setMealCals] = useState("");
  const [mealProtein, setMealProtein] = useState("");

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

  function loadAll() {
    loadTasks();
    loadHabits();
    loadGoals();
    loadMeals();
    loadFinance();
    loadJournal();
  }

  /* ---------------------------- TASKS ---------------------------- */

  async function loadTasks() {
    const { data } = await supabase
      .from("tasks")
      .select("*")
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

  async function completeTask(id: string) {
    await supabase.from("tasks").update({ status: "done" }).eq("id", id);
    loadTasks();
  }

  /* --------------------------- HABITS ---------------------------- */

  async function loadHabits() {
    const { data } = await supabase
      .from("habits")
      .select("*")
      .eq("date", todayISO());
    setHabits((data as HabitRow[]) ?? []);
  }

  async function seedHabitsFromTemplate() {
    setSeedingHabits(true);
    const day = todayISO();
    for (const group of HABIT_TEMPLATE) {
      const { data: parent } = await supabase
        .from("habits")
        .insert({ name: group.name, date: day })
        .select("id")
        .single();
      if (!parent) continue;
      await supabase.from("habits").insert(
        group.items.map((name) => ({ name, parent_id: (parent as { id: string }).id, date: day }))
      );
    }
    await loadHabits();
    setSeedingHabits(false);
  }

  async function toggleHabit(h: HabitRow) {
    const next = !h.completed;
    // Optimistic update, then persist.
    setHabits((prev) => prev.map((x) => (x.id === h.id ? { ...x, completed: next } : x)));
    await supabase.from("habits").update({ completed: next }).eq("id", h.id);
  }

  /* ---------------------------- GOALS ---------------------------- */

  async function loadGoals() {
    const { data } = await supabase
      .from("goals")
      .select("*")
      .eq("period", "month")
      .order("created_at", { ascending: true });
    setGoals((data as GoalRow[]) ?? []);
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
    await supabase.from("goals").delete().eq("id", id);
    loadGoals();
  }

  /* ------------------------- NUTRITION --------------------------- */

  async function loadMeals() {
    const { data } = await supabase
      .from("nutrition")
      .select("*")
      .gte("eaten_at", startOfTodayISO())
      .order("eaten_at", { ascending: false });
    setMeals((data as MealRow[]) ?? []);
  }

  async function addMeal(e: React.FormEvent) {
    e.preventDefault();
    const meal = mealName.trim();
    if (!meal) return;
    const calories = mealCals ? parseInt(mealCals, 10) : null;
    const protein = mealProtein ? parseInt(mealProtein, 10) : null;
    setMealName("");
    setMealCals("");
    setMealProtein("");
    setShowLog(false);
    await supabase.from("nutrition").insert({ meal, calories, protein });
    loadMeals();
  }

  /* --------------------------- FINANCE --------------------------- */

  async function loadFinance() {
    const { data } = await supabase.from("finance").select("*");
    const rows = (data as FinanceRow[]) ?? [];
    if (rows.length === 0) {
      setFinance(FINANCE_FALLBACK);
      return;
    }
    const get = (label: string) => rows.find((r) => r.label === label)?.amount;
    setFinance({
      netWorth: get("net_worth") ?? FINANCE_FALLBACK.netWorth,
      month: get("month_change") ?? FINANCE_FALLBACK.month,
      day: get("day_change") ?? FINANCE_FALLBACK.day,
    });
  }

  /* --------------------------- JOURNAL --------------------------- */

  async function loadJournal() {
    const { data } = await supabase
      .from("journal")
      .select("*")
      .order("date", { ascending: false })
      .limit(1);
    const row = (data as JournalRow[] | null)?.[0] ?? null;
    setJournal(row);
  }

  /* --------------------------- DERIVED --------------------------- */

  const activeTasks = tasks.filter((t) => t.status === "active");
  const keyTasks = activeTasks.filter((t) => t.starred);

  const habitGroups = useMemo(() => {
    const parents = habits.filter((h) => !h.parent_id);
    return parents.map((p) => ({
      parent: p,
      items: habits.filter((h) => h.parent_id === p.id),
    }));
  }, [habits]);

  const habitChildren = habits.filter((h) => h.parent_id);
  const habitPct =
    habitChildren.length === 0
      ? 0
      : Math.round(
          (habitChildren.filter((h) => h.completed).length / habitChildren.length) * 100
        );

  const totals = meals.reduce(
    (acc, m) => {
      acc.calories += m.calories ?? 0;
      acc.protein += m.protein ?? 0;
      return acc;
    },
    { calories: 0, protein: 0 }
  );
  const kcalLeft = Math.max(CALORIE_TARGET - totals.calories, 0);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  const money = (n: number) =>
    "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

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
          {/* Finance Pulse — LIVE (falls back to sample until finance rows exist) */}
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
              <div className="text-3xl font-semibold text-acid">{money(finance.netWorth)}</div>
              <div className="mt-1 flex gap-4 text-[12px]">
                <span className="text-acidDim">Month +{money(finance.month)}</span>
                <span className="text-acidDim">Today +{money(finance.day)}</span>
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

          {/* Daily Habits — LIVE from Supabase */}
          <section className="panel">
            <PanelTitle right={<span className="text-[11px] text-acid">{habitPct}%</span>}>
              Daily Habits
            </PanelTitle>
            <div className="mb-3 h-1 w-full overflow-hidden rounded bg-line">
              <div className="h-full bg-acid transition-all" style={{ width: `${habitPct}%` }} />
            </div>

            {habitGroups.length === 0 ? (
              <div className="py-1 text-[12px] text-muted">
                <p className="mb-2">No habits set up for today yet.</p>
                <button
                  onClick={seedHabitsFromTemplate}
                  disabled={seedingHabits}
                  className="chip hover:text-acid disabled:opacity-50"
                >
                  {seedingHabits ? "Setting up…" : "Set up today's habits"}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {habitGroups.map((g) => {
                  const n = g.items.filter((i) => i.completed).length;
                  return (
                    <div key={g.parent.id}>
                      <div className="mb-1 flex justify-between text-[11px] text-muted">
                        <span className="uppercase tracking-wider">{g.parent.name}</span>
                        <span>{n}/{g.items.length}</span>
                      </div>
                      {g.items.map((item) => (
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
            )}
          </section>
        </div>

        {/* CENTER COLUMN */}
        <div className="space-y-3 lg:col-span-5">
          {/* Kanban — LIVE from tasks, grouped by view */}
          <section className="panel">
            <PanelTitle>CRM · Kanban</PanelTitle>
            <div className="grid grid-cols-3 gap-2">
              {KANBAN_COLS.map((col) => {
                const cards = activeTasks.filter((t) => t.view === col.key);
                return (
                  <div key={col.key} className="rounded border border-line bg-panel2 p-2">
                    <div className="mb-2 text-[10px] uppercase tracking-wider text-muted">
                      {col.label}
                    </div>
                    <div className="space-y-2">
                      {cards.length === 0 && (
                        <div className="text-[11px] text-muted">—</div>
                      )}
                      {cards.map((t) => (
                        <div
                          key={t.id}
                          className="rounded border border-line bg-panel p-2 text-[12px] text-ghost"
                        >
                          {t.content}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Brain — life categories (shell: no backing table yet) */}
          <section className="panel">
            <PanelTitle>Brain · Life Categories</PanelTitle>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map((c) => (
                <div
                  key={c.key}
                  className={`rounded border bg-panel2 p-3 ${
                    c.warn ? "border-acid/40" : "border-line"
                  }`}
                >
                  <div className={`text-[12px] uppercase tracking-wider ${c.warn ? "text-acid" : "text-ghost"}`}>
                    {c.key}
                  </div>
                  <div className="mt-1 text-[11px] text-muted">{c.note}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Journal — LIVE read of the latest entry (capture lands in Phase 4) */}
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
                  {journal.ai_summary || journal.raw_transcript || "Entry saved — no text yet."}
                </>
              ) : (
                <>
                  <div className="mb-1 uppercase tracking-wider">No entries yet</div>
                  Your latest journal entry will show here once you capture one.
                </>
              )}
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-3 lg:col-span-4">
          {/* Calendar (shell: no backing table yet) */}
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
            {goals.length === 0 && (
              <p className="py-1 text-[12px] text-muted">No goals yet — add one below.</p>
            )}
            <ol className="space-y-1.5">
              {goals.map((g, i) => (
                <li key={g.id} className="group flex items-start gap-2 text-[13px] text-ghost">
                  <span className="text-acidDim">{i + 1}</span>
                  <span className="flex-1">{g.content}</span>
                  <button
                    onClick={() => removeGoal(g.id)}
                    className="text-[11px] text-muted opacity-0 transition hover:text-acid group-hover:opacity-100"
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

          {/* Nutrition — LIVE from Supabase */}
          <section className="panel">
            <PanelTitle
              right={
                <button onClick={() => setShowLog((v) => !v)} className="chip hover:text-acid">
                  {showLog ? "Close" : "+ Log"}
                </button>
              }
            >
              Nutrition
            </PanelTitle>

            {showLog && (
              <form onSubmit={addMeal} className="mb-3 space-y-2">
                <input
                  value={mealName}
                  onChange={(e) => setMealName(e.target.value)}
                  placeholder="meal"
                  className="w-full rounded border border-line bg-panel2 px-2 py-1 text-[12px] text-ghost outline-none placeholder:text-muted focus:border-acid/50"
                />
                <div className="flex gap-2">
                  <input
                    value={mealCals}
                    onChange={(e) => setMealCals(e.target.value)}
                    inputMode="numeric"
                    placeholder="kcal"
                    className="w-1/2 rounded border border-line bg-panel2 px-2 py-1 text-[12px] text-ghost outline-none placeholder:text-muted focus:border-acid/50"
                  />
                  <input
                    value={mealProtein}
                    onChange={(e) => setMealProtein(e.target.value)}
                    inputMode="numeric"
                    placeholder="protein g"
                    className="w-1/2 rounded border border-line bg-panel2 px-2 py-1 text-[12px] text-ghost outline-none placeholder:text-muted focus:border-acid/50"
                  />
                </div>
                <button className="chip w-full hover:text-acid">Save meal</button>
              </form>
            )}

            <div className="space-y-1">
              {meals.length === 0 && (
                <p className="py-1 text-[12px] text-muted">Nothing logged today.</p>
              )}
              {meals.map((m) => (
                <div key={m.id} className="flex items-center justify-between rounded border border-line bg-panel2 px-2 py-1.5 text-[12px]">
                  <span className="text-ghost">{m.meal}</span>
                  <span className="text-muted">
                    {m.calories ?? 0} kcal · {m.protein ?? 0}p
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <Stat n={totals.calories} label="kcal" />
              <Stat n={totals.protein} label="protein g" />
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
