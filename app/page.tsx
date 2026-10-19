"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

/* ------------------------------------------------------------------ */
/*  DATABASE ROW TYPES — these mirror supabase/schema.sql              */
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

type JournalRow = {
  id: string;
  date: string;
  raw_transcript: string | null;
  ai_summary: string | null;
};

/* ------------------------------------------------------------------ */
/*  MOCK DATA (still to come)                                          */
/*  Finance Pulse and the Calendar stay on sample data for now:        */
/*  the finance table is a flat label/amount ledger that needs a       */
/*  design pass, and there is no calendar table yet. Everything else   */
/*  on this page is live from Supabase.                                */
/* ------------------------------------------------------------------ */

const FINANCE = { netWorth: 2481300, month: 184000, day: 56210 };

const FINANCE_BARS = [
  8, 10, 7, 12, 9, 14, 11, 16, 13, 18, 15, 20, 17, 22, 19, 24, 21, 26, 23, 28,
];

const CALENDAR = [
  { time: "09:30", label: "Standup w/ team" },
  { time: "11:30", label: "Investor call — fund II" },
  { time: "14:00", label: "Record finance video" },
  { time: "16:30", label: "1:1 with editor" },
];

// The set of life categories the "Brain" panel tracks. Task counts next
// to each are computed live from the tasks table.
const CATEGORY_KEYS = [
  "legal",
  "finance",
  "content",
  "products",
  "opsec",
  "business",
];

const CALORIE_TARGET = 2040;

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

// Today's date as YYYY-MM-DD in local time — matches the `date` columns.
function todayISO() {
  return new Date().toLocaleDateString("en-CA");
}

/* ------------------------------------------------------------------ */
/*  PAGE                                                               */
/* ------------------------------------------------------------------ */

export default function Dashboard() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);

  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [habits, setHabits] = useState<HabitRow[]>([]);
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [meals, setMeals] = useState<MealRow[]>([]);
  const [journal, setJournal] = useState<JournalRow | null>(null);

  const [newTask, setNewTask] = useState("");
  const [newHabit, setNewHabit] = useState("");
  const [newGoal, setNewGoal] = useState("");
  const [logging, setLogging] = useState(false);
  const [mealDraft, setMealDraft] = useState({ meal: "", calories: "", protein: "" });

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

  /* ---------------------------------------------------------------- */
  /*  LOADERS                                                         */
  /* ---------------------------------------------------------------- */

  function loadAll() {
    loadTasks();
    loadHabits();
    loadGoals();
    loadMeals();
    loadJournal();
  }

  async function loadTasks() {
    const { data } = await supabase
      .from("tasks")
      .select("*")
      .order("priority", { ascending: false });
    if (data) setTasks(data as TaskRow[]);
  }

  async function loadHabits() {
    const { data } = await supabase
      .from("habits")
      .select("*")
      .eq("date", todayISO());
    if (data) setHabits(data as HabitRow[]);
  }

  async function loadGoals() {
    const { data } = await supabase
      .from("goals")
      .select("*")
      .order("created_at", { ascending: true });
    if (data) setGoals(data as GoalRow[]);
  }

  async function loadMeals() {
    // Everything eaten since local midnight.
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const { data } = await supabase
      .from("nutrition")
      .select("*")
      .gte("eaten_at", start.toISOString())
      .order("eaten_at", { ascending: true });
    if (data) setMeals(data as MealRow[]);
  }

  async function loadJournal() {
    const { data } = await supabase
      .from("journal")
      .select("*")
      .order("date", { ascending: false })
      .limit(1);
    if (data && data.length) setJournal(data[0] as JournalRow);
  }

  /* ---------------------------------------------------------------- */
  /*  MUTATIONS                                                       */
  /* ---------------------------------------------------------------- */

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
    // Optimistic flip, then persist.
    setHabits((hs) =>
      hs.map((x) => (x.id === h.id ? { ...x, completed: !x.completed } : x))
    );
    await supabase.from("habits").update({ completed: !h.completed }).eq("id", h.id);
  }

  async function addHabit(e: React.FormEvent) {
    e.preventDefault();
    const name = newHabit.trim();
    if (!name) return;
    setNewHabit("");
    await supabase.from("habits").insert({ name, date: todayISO(), completed: false });
    loadHabits();
  }

  async function addGoal(e: React.FormEvent) {
    e.preventDefault();
    const content = newGoal.trim();
    if (!content) return;
    setNewGoal("");
    await supabase.from("goals").insert({ content, period: "month" });
    loadGoals();
  }

  async function logMeal(e: React.FormEvent) {
    e.preventDefault();
    const meal = mealDraft.meal.trim();
    if (!meal) return;
    const calories = mealDraft.calories ? parseInt(mealDraft.calories, 10) : null;
    const protein = mealDraft.protein ? parseInt(mealDraft.protein, 10) : null;
    setMealDraft({ meal: "", calories: "", protein: "" });
    setLogging(false);
    await supabase.from("nutrition").insert({ meal, calories, protein });
    loadMeals();
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  /* ---------------------------------------------------------------- */
  /*  DERIVED VIEWS                                                   */
  /* ---------------------------------------------------------------- */

  const keyTasks = tasks.filter((t) => t.starred && t.status === "active");

  // Kanban columns come straight from the tasks table's `view` field.
  const kanban = useMemo(() => {
    const active = tasks.filter((t) => t.status === "active");
    return {
      today: active.filter((t) => t.view === "today"),
      week: active.filter((t) => t.view === "week"),
      month: active.filter((t) => t.view === "month"),
    };
  }, [tasks]);

  // Live task counts per life category.
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const key of CATEGORY_KEYS) counts[key] = 0;
    for (const t of tasks) {
      if (t.status === "active" && t.category && t.category in counts) {
        counts[t.category] += 1;
      }
    }
    return counts;
  }, [tasks]);

  // Habits grouped by their parent. Parents with children render as a
  // group; childless top-level habits fall under a "General" group.
  const habitGroups = useMemo(() => {
    const parents = habits.filter((h) => !h.parent_id);
    const childOf = (id: string) => habits.filter((h) => h.parent_id === id);

    const groups = parents
      .map((p) => ({ name: p.name, items: childOf(p.id) }))
      .filter((g) => g.items.length > 0);

    const standalone = parents.filter((p) => childOf(p.id).length === 0);
    if (standalone.length) groups.push({ name: "General", items: standalone });

    return groups;
  }, [habits]);

  const allLeaves = useMemo(
    () => habitGroups.flatMap((g) => g.items),
    [habitGroups]
  );
  const habitPct = allLeaves.length
    ? Math.round(
        (allLeaves.filter((h) => h.completed).length / allLeaves.length) * 100
      )
    : 0;

  const monthGoals = goals.filter((g) => g.period !== "week");

  const totals = useMemo(() => {
    const calories = meals.reduce((s, m) => s + (m.calories ?? 0), 0);
    const protein = meals.reduce((s, m) => s + (m.protein ?? 0), 0);
    return { calories, protein, left: Math.max(CALORIE_TARGET - calories, 0) };
  }, [meals]);

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
          {/* Finance Pulse — mock for now (see note above) */}
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
              <div className="text-3xl font-semibold text-acid">{money(FINANCE.netWorth)}</div>
              <div className="mt-1 flex gap-4 text-[12px]">
                <span className="text-acidDim">Month +{money(FINANCE.month)}</span>
                <span className="text-acidDim">Today +{money(FINANCE.day)}</span>
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
            {allLeaves.length === 0 && (
              <p className="py-1 text-[12px] text-muted">No habits for today yet — add one below.</p>
            )}
            <div className="space-y-3">
              {habitGroups.map((g) => {
                const n = g.items.filter((h) => h.completed).length;
                return (
                  <div key={g.name}>
                    <div className="mb-1 flex justify-between text-[11px] text-muted">
                      <span className="uppercase tracking-wider">{g.name}</span>
                      <span>{n}/{g.items.length}</span>
                    </div>
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
                placeholder="+ add a habit"
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
            <PanelTitle right={<span className="text-[10px] text-acidDim">live</span>}>
              CRM · Kanban
            </PanelTitle>
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

          {/* Brain — life categories with live task counts */}
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
                      {n} open task{n === 1 ? "" : "s"}
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
            {journal ? (
              <div className="text-[11px] text-muted">
                <div className="mb-1 uppercase tracking-wider">{journal.date}</div>
                {journal.ai_summary || journal.raw_transcript || "No text yet."}
              </div>
            ) : (
              <p className="text-[11px] text-muted">No journal entries yet.</p>
            )}
          </section>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-3 lg:col-span-4">
          {/* Calendar — mock for now (no calendar table yet) */}
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
            <PanelTitle right={<span className="text-[10px] text-acidDim">live</span>}>
              Goals · This Month
            </PanelTitle>
            {monthGoals.length === 0 && (
              <p className="py-1 text-[12px] text-muted">No goals yet — add one below.</p>
            )}
            <ol className="space-y-1.5">
              {monthGoals.map((g, i) => (
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
            {logging && (
              <form onSubmit={logMeal} className="mb-3 space-y-2">
                <input
                  value={mealDraft.meal}
                  onChange={(e) => setMealDraft((d) => ({ ...d, meal: e.target.value }))}
                  placeholder="meal"
                  className="w-full rounded border border-line bg-panel2 px-2 py-1 text-[12px] text-ghost outline-none placeholder:text-muted focus:border-acid/50"
                />
                <div className="flex gap-2">
                  <input
                    value={mealDraft.calories}
                    onChange={(e) => setMealDraft((d) => ({ ...d, calories: e.target.value }))}
                    placeholder="kcal"
                    inputMode="numeric"
                    className="w-full rounded border border-line bg-panel2 px-2 py-1 text-[12px] text-ghost outline-none placeholder:text-muted focus:border-acid/50"
                  />
                  <input
                    value={mealDraft.protein}
                    onChange={(e) => setMealDraft((d) => ({ ...d, protein: e.target.value }))}
                    placeholder="protein g"
                    inputMode="numeric"
                    className="w-full rounded border border-line bg-panel2 px-2 py-1 text-[12px] text-ghost outline-none placeholder:text-muted focus:border-acid/50"
                  />
                  <button className="chip hover:text-acid">Save</button>
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
              <Stat n={totals.calories} label="kcal" />
              <Stat n={totals.protein} label="protein g" />
              <Stat n={totals.left} label="kcal left" />
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
