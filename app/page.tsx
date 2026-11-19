"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

/* ------------------------------------------------------------------ */
/*  ROW TYPES — shapes mirror supabase/schema.sql                      */
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

type FinanceRow = {
  id: string;
  label: string;
  amount: number | null;
  as_of: string;
};

type JournalRow = {
  id: string;
  date: string;
  raw_transcript: string | null;
  ai_summary: string | null;
};

/* ------------------------------------------------------------------ */
/*  STATIC CONFIG                                                      */
/*  Not mock data — these are app constants:                          */
/*   - the habit template used to seed a fresh day                    */
/*   - the fixed set of life categories                               */
/*   - the daily calorie target                                       */
/* ------------------------------------------------------------------ */

const HABIT_TEMPLATE: { name: string; items: string[] }[] = [
  { name: "Morning", items: ["Warm-up", "Lift", "Stretch"] },
  { name: "Supplements", items: ["Creatine", "Omega-3", "Vit D", "Magnesium"] },
  { name: "Deep work", items: ["Scroll X", "Market research", "Ideate"] },
  { name: "Comms", items: ["Reply DMs", "Engage comments"] },
  { name: "Build", items: ["Portfolio", "Risk scan", "Dashboard"] },
];

const CATEGORY_KEYS = [
  "legal",
  "finance",
  "content",
  "products",
  "opsec",
  "business",
] as const;

const DAILY_TARGET = 2040; // kcal/day target

// Decorative sparkline for the Finance Pulse panel (no time-series table yet).
const FINANCE_BARS = [
  8, 10, 7, 12, 9, 14, 11, 16, 13, 18, 15, 20, 17, 22, 19, 24, 21, 26, 23, 28,
];

// Calendar has no table in the schema yet, so it stays a static preview.
const CALENDAR = [
  { time: "09:30", label: "Standup w/ team" },
  { time: "11:30", label: "Investor call — fund II" },
  { time: "14:00", label: "Record finance video" },
  { time: "16:30", label: "1:1 with editor" },
];

/* ------------------------------------------------------------------ */
/*  HELPERS                                                            */
/* ------------------------------------------------------------------ */

// Local YYYY-MM-DD (matches how we store/query the `date` columns).
const todayStr = () => new Date().toLocaleDateString("en-CA");

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

function LiveTag() {
  return <span className="text-[10px] text-acidDim">live</span>;
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

  // --- Live data from Supabase ---
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [habits, setHabits] = useState<HabitRow[]>([]);
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [meals, setMeals] = useState<MealRow[]>([]);
  const [finance, setFinance] = useState<FinanceRow[]>([]);
  const [journal, setJournal] = useState<JournalRow | null>(null);

  // --- Form state ---
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
    await Promise.all([
      loadTasks(),
      loadHabits(),
      loadGoals(),
      loadMeals(),
      loadFinance(),
      loadJournal(),
    ]);
  }

  /* ---------- Tasks (Key Tasks + Kanban + Brain) ---------- */

  async function loadTasks() {
    const { data } = await supabase
      .from("tasks")
      .select("*")
      .order("priority", { ascending: false });
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
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, status: "done" } : t)));
    await supabase.from("tasks").update({ status: "done" }).eq("id", id);
    loadTasks();
  }

  /* ---------- Habits (seed-on-empty + persisted toggles) ---------- */

  async function loadHabits() {
    const d = todayStr();
    const { data } = await supabase.from("habits").select("*").eq("date", d);
    if (!data || data.length === 0) {
      const seeded = await seedHabits(d);
      setHabits(seeded);
    } else {
      setHabits(data as HabitRow[]);
    }
  }

  // First visit of the day: create this day's habit rows from the template.
  async function seedHabits(d: string): Promise<HabitRow[]> {
    const parentPayload = HABIT_TEMPLATE.map((g) => ({
      name: g.name,
      date: d,
      completed: false,
    }));
    const { data: parents } = await supabase
      .from("habits")
      .insert(parentPayload)
      .select();
    if (!parents) return [];

    const childPayload: {
      name: string;
      parent_id: string;
      date: string;
      completed: boolean;
    }[] = [];
    HABIT_TEMPLATE.forEach((g) => {
      const parent = parents.find((p) => p.name === g.name);
      if (!parent) return;
      g.items.forEach((item) =>
        childPayload.push({ name: item, parent_id: parent.id, date: d, completed: false })
      );
    });
    const { data: children } = await supabase
      .from("habits")
      .insert(childPayload)
      .select();

    return [...(parents as HabitRow[]), ...((children ?? []) as HabitRow[])];
  }

  async function toggleHabit(h: HabitRow) {
    const next = !h.completed;
    setHabits((hs) => hs.map((x) => (x.id === h.id ? { ...x, completed: next } : x)));
    await supabase.from("habits").update({ completed: next }).eq("id", h.id);
  }

  /* ---------- Goals ---------- */

  async function loadGoals() {
    const { data } = await supabase
      .from("goals")
      .select("*")
      .eq("period", "month")
      .order("created_at", { ascending: true });
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

  /* ---------- Nutrition ---------- */

  async function loadMeals() {
    const start = todayStr() + "T00:00:00";
    const { data } = await supabase
      .from("nutrition")
      .select("*")
      .gte("eaten_at", start)
      .order("eaten_at", { ascending: true });
    if (data) setMeals(data as MealRow[]);
  }

  async function addMeal(e: React.FormEvent) {
    e.preventDefault();
    const meal = mealName.trim();
    if (!meal) return;
    const calories = mealKcal ? parseInt(mealKcal, 10) : null;
    const protein = mealProtein ? parseInt(mealProtein, 10) : null;
    setMealName("");
    setMealKcal("");
    setMealProtein("");
    setShowMealForm(false);
    await supabase.from("nutrition").insert({ meal, calories, protein });
    loadMeals();
  }

  /* ---------- Finance ---------- */

  async function loadFinance() {
    const { data } = await supabase.from("finance").select("*");
    if (data) setFinance(data as FinanceRow[]);
  }

  /* ---------- Journal ---------- */

  async function loadJournal() {
    const { data } = await supabase
      .from("journal")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1);
    setJournal((data?.[0] as JournalRow) ?? null);
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  /* ---------- Derived values ---------- */

  const keyTasks = tasks.filter((t) => t.starred && t.status === "active");

  const kanbanCol = (v: "today" | "week" | "month") =>
    tasks.filter((t) => t.status === "active" && t.view === v);

  const parentHabits = useMemo(() => {
    const parents = habits.filter((h) => h.parent_id === null);
    const order = (n: string) => {
      const i = HABIT_TEMPLATE.findIndex((g) => g.name === n);
      return i === -1 ? 999 : i;
    };
    return [...parents].sort((a, b) => order(a.name) - order(b.name));
  }, [habits]);

  const childHabits = (parentId: string) =>
    habits.filter((h) => h.parent_id === parentId);

  const childRows = habits.filter((h) => h.parent_id !== null);
  const habitPct =
    childRows.length === 0
      ? 0
      : Math.round((childRows.filter((h) => h.completed).length / childRows.length) * 100);

  const fin = (label: string) =>
    finance.find((f) => f.label === label)?.amount ?? 0;
  const netWorth = fin("net_worth");
  const monthChange = fin("month_change");
  const dayChange = fin("day_change");

  const kcalToday = meals.reduce((s, m) => s + (m.calories ?? 0), 0);
  const proteinToday = meals.reduce((s, m) => s + (m.protein ?? 0), 0);
  const kcalLeft = Math.max(DAILY_TARGET - kcalToday, 0);

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
              <div className="text-3xl font-semibold text-acid">{money(netWorth)}</div>
              <div className="mt-1 flex gap-4 text-[12px]">
                <span className="text-acidDim">Month +{money(monthChange)}</span>
                <span className="text-acidDim">Today +{money(dayChange)}</span>
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
            <PanelTitle right={<LiveTag />}>Key Tasks · Today</PanelTitle>
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

          {/* Daily Habits — LIVE from Supabase */}
          <section className="panel">
            <PanelTitle right={<span className="text-[11px] text-acid">{habitPct}%</span>}>
              Daily Habits
            </PanelTitle>
            <div className="mb-3 h-1 w-full overflow-hidden rounded bg-line">
              <div className="h-full bg-acid transition-all" style={{ width: `${habitPct}%` }} />
            </div>
            <div className="space-y-3">
              {parentHabits.map((g) => {
                const items = childHabits(g.id);
                const n = items.filter((i) => i.completed).length;
                return (
                  <div key={g.id}>
                    <div className="mb-1 flex justify-between text-[11px] text-muted">
                      <span className="uppercase tracking-wider">{g.name}</span>
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
          {/* Kanban — LIVE from tasks */}
          <section className="panel">
            <PanelTitle right={<LiveTag />}>CRM · Kanban</PanelTitle>
            <div className="grid grid-cols-3 gap-2">
              {(["today", "week", "month"] as const).map((col) => {
                const items = kanbanCol(col);
                return (
                  <div key={col} className="rounded border border-line bg-panel2 p-2">
                    <div className="mb-2 text-[10px] uppercase tracking-wider text-muted">
                      {col === "today" ? "Today" : col === "week" ? "This week" : "This month"}
                    </div>
                    <div className="space-y-2">
                      {items.length === 0 && (
                        <div className="text-[11px] text-muted">—</div>
                      )}
                      {items.map((t) => (
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

          {/* Brain — life categories, counts LIVE from tasks */}
          <section className="panel">
            <PanelTitle right={<LiveTag />}>Brain · Life Categories</PanelTitle>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORY_KEYS.map((key) => {
                const count = tasks.filter(
                  (t) => t.status === "active" && t.category === key
                ).length;
                return (
                  <div key={key} className="rounded border border-line bg-panel2 p-3">
                    <div className="text-[12px] uppercase tracking-wider text-ghost">{key}</div>
                    <div className="mt-1 text-[11px] text-muted">
                      {count} open
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Journal — latest entry LIVE; voice capture lands in Phase 4 */}
          <section className="panel">
            <PanelTitle right={<LiveTag />}>Journal</PanelTitle>
            <button
              onClick={() =>
                alert("Voice capture is wired in Phase 4 (Telegram + Whisper).")
              }
              className="mb-3 flex w-full items-center justify-center gap-2 rounded border border-acid/40 bg-acid/5 py-2 text-[12px] text-acid hover:bg-acid/10"
            >
              <span className="h-2 w-2 rounded-full bg-acid" />
              Hold to voice-note your day
            </button>
            <div className="text-[11px] text-muted">
              {journal ? (
                <>
                  <div className="mb-1 uppercase tracking-wider">
                    {new Date(journal.date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </div>
                  {journal.ai_summary || journal.raw_transcript || "No summary yet."}
                </>
              ) : (
                <>
                  <div className="mb-1 uppercase tracking-wider">No entries yet</div>
                  Your most recent journal summary will appear here.
                </>
              )}
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-3 lg:col-span-4">
          {/* Calendar — static preview (no table in schema yet) */}
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

          {/* Goals — LIVE from Supabase */}
          <section className="panel">
            <PanelTitle right={<LiveTag />}>Goals · This Month</PanelTitle>
            {goals.length === 0 && (
              <p className="py-1 text-[12px] text-muted">No goals yet — add one below.</p>
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
                  <button className="chip hover:text-acid">Save</button>
                </div>
              </form>
            )}

            {meals.length === 0 && !showMealForm && (
              <p className="mb-2 py-1 text-[12px] text-muted">
                No meals logged today — tap “+ Log”.
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
