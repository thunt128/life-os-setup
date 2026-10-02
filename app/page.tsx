"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

type NutritionRow = {
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
  created_at: string;
};

/* ------------------------------------------------------------------ */
/*  STATIC CONFIG                                                      */
/*  Decorative / Phase-4 bits that have no backing table yet.          */
/* ------------------------------------------------------------------ */

// Sparkline bars under Finance Pulse — purely decorative until a
// finance-history table exists (a later phase).
const FINANCE_BARS = [
  8, 10, 7, 12, 9, 14, 11, 16, 13, 18, 15, 20, 17, 22, 19, 24, 21, 26, 23, 28,
];

// Daily calorie target used to compute "kcal left".
const CALORIE_TARGET = 2800;

// The life categories shown in the Brain panel. Counts come from live
// task rows; the keys match the `category` values used on tasks.
const CATEGORY_KEYS = [
  "legal",
  "finance",
  "content",
  "products",
  "opsec",
  "business",
] as const;

// Default habit template. Seeded into the habits table (one parent row
// per group, one child row per item) the first time a given day is
// opened, so toggles have real rows to persist against.
const HABIT_TEMPLATE: { group: string; items: string[] }[] = [
  { group: "Morning", items: ["Warm-up", "Lift", "Stretch"] },
  { group: "Supplements", items: ["Creatine", "Omega-3", "Vit D", "Magnesium"] },
  { group: "Deep work", items: ["Scroll X", "Market research", "Ideate"] },
  { group: "Comms", items: ["Reply DMs", "Engage comments"] },
  { group: "Build", items: ["Portfolio", "Risk scan", "Dashboard"] },
];

// Calendar has no backing table yet — kept as a static agenda.
const CALENDAR = [
  { time: "09:30", label: "Standup w/ team" },
  { time: "11:30", label: "Investor call — fund II" },
  { time: "14:00", label: "Record finance video" },
  { time: "16:30", label: "1:1 with editor" },
];

/* ------------------------------------------------------------------ */
/*  HELPERS                                                            */
/* ------------------------------------------------------------------ */

// Local (not UTC) YYYY-MM-DD, for `date` columns.
function localDateISO(): string {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

// Start of today as an ISO timestamp, for `eaten_at`/`created_at` filters.
function startOfTodayISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
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

  // Live data
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [habits, setHabits] = useState<HabitRow[]>([]);
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [meals, setMeals] = useState<NutritionRow[]>([]);
  const [finance, setFinance] = useState<FinanceRow[]>([]);
  const [journal, setJournal] = useState<JournalRow | null>(null);

  // Local input state
  const [newTask, setNewTask] = useState("");
  const [newGoal, setNewGoal] = useState("");
  const [logging, setLogging] = useState(false);
  const [mealName, setMealName] = useState("");
  const [mealCals, setMealCals] = useState("");
  const [mealProt, setMealProt] = useState("");
  const [revealMoney, setRevealMoney] = useState(false);
  const [ask, setAsk] = useState("");

  const today = localDateISO();

  /* ---------------- data loaders ---------------- */

  const loadTasks = useCallback(async () => {
    const { data } = await supabase
      .from("tasks")
      .select("*")
      .order("priority", { ascending: false });
    if (data) setTasks(data as TaskRow[]);
  }, []);

  const loadGoals = useCallback(async () => {
    const { data } = await supabase
      .from("goals")
      .select("*")
      .eq("period", "month")
      .order("created_at", { ascending: true });
    if (data) setGoals(data as GoalRow[]);
  }, []);

  const loadMeals = useCallback(async () => {
    const { data } = await supabase
      .from("nutrition")
      .select("*")
      .gte("eaten_at", startOfTodayISO())
      .order("eaten_at", { ascending: true });
    if (data) setMeals(data as NutritionRow[]);
  }, []);

  const loadFinance = useCallback(async () => {
    const { data } = await supabase.from("finance").select("*");
    if (data) setFinance(data as FinanceRow[]);
  }, []);

  const loadJournal = useCallback(async () => {
    const { data } = await supabase
      .from("journal")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1);
    setJournal(data && data.length ? (data[0] as JournalRow) : null);
  }, []);

  // Habits: load today's rows, seeding the default template the first
  // time this day is opened so there are real rows to toggle.
  const loadHabits = useCallback(async () => {
    const { data } = await supabase.from("habits").select("*").eq("date", today);
    let rows = (data ?? []) as HabitRow[];

    if (rows.length === 0) {
      // Seed parents, then children keyed to the returned parent ids.
      const { data: parents } = await supabase
        .from("habits")
        .insert(HABIT_TEMPLATE.map((g) => ({ name: g.group, date: today })))
        .select();
      if (parents) {
        const byName = new Map(
          (parents as HabitRow[]).map((p) => [p.name, p.id])
        );
        const children = HABIT_TEMPLATE.flatMap((g) =>
          g.items.map((item) => ({
            name: item,
            parent_id: byName.get(g.group) ?? null,
            date: today,
          }))
        );
        await supabase.from("habits").insert(children);
      }
      const reload = await supabase.from("habits").select("*").eq("date", today);
      rows = (reload.data ?? []) as HabitRow[];
    }

    setHabits(rows);
  }, [today]);

  const loadAll = useCallback(() => {
    loadTasks();
    loadHabits();
    loadGoals();
    loadMeals();
    loadFinance();
    loadJournal();
  }, [loadTasks, loadHabits, loadGoals, loadMeals, loadFinance, loadJournal]);

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

  /* ---------------- writes ---------------- */

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

  async function toggleHabit(id: string, completed: boolean) {
    // Optimistic update, then persist.
    setHabits((hs) => hs.map((h) => (h.id === id ? { ...h, completed } : h)));
    await supabase.from("habits").update({ completed }).eq("id", id);
  }

  async function addGoal(e: React.FormEvent) {
    e.preventDefault();
    const content = newGoal.trim();
    if (!content) return;
    setNewGoal("");
    await supabase.from("goals").insert({ content, period: "month" });
    loadGoals();
  }

  async function deleteGoal(id: string) {
    await supabase.from("goals").delete().eq("id", id);
    loadGoals();
  }

  async function addMeal(e: React.FormEvent) {
    e.preventDefault();
    const meal = mealName.trim();
    if (!meal) return;
    await supabase.from("nutrition").insert({
      meal,
      calories: mealCals ? Number(mealCals) : null,
      protein: mealProt ? Number(mealProt) : null,
    });
    setMealName("");
    setMealCals("");
    setMealProt("");
    setLogging(false);
    loadMeals();
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  /* ---------------- derived ---------------- */

  const activeTasks = useMemo(
    () => tasks.filter((t) => t.status === "active"),
    [tasks]
  );

  const keyTasks = useMemo(
    () => activeTasks.filter((t) => t.starred),
    [activeTasks]
  );

  // Kanban columns from live tasks, grouped by their `view`.
  const kanban = useMemo(
    () => ({
      today: activeTasks.filter((t) => t.view === "today"),
      week: activeTasks.filter((t) => t.view === "week"),
      month: activeTasks.filter((t) => t.view === "month"),
    }),
    [activeTasks]
  );

  // Life-category counts from live tasks.
  const categories = useMemo(
    () =>
      CATEGORY_KEYS.map((key) => {
        const n = activeTasks.filter((t) => t.category === key).length;
        return { key, note: n > 0 ? `${n} open` : "clear" };
      }),
    [activeTasks]
  );

  // Habit groups, re-assembled from the flat rows in template order.
  const habitGroups = useMemo(() => {
    const parents = habits.filter((h) => !h.parent_id);
    const orderOf = (name: string) => {
      const i = HABIT_TEMPLATE.findIndex((g) => g.group === name);
      return i === -1 ? 999 : i;
    };
    return parents
      .slice()
      .sort((a, b) => orderOf(a.name) - orderOf(b.name))
      .map((p) => {
        const tmpl = HABIT_TEMPLATE.find((g) => g.group === p.name);
        const items = habits
          .filter((h) => h.parent_id === p.id)
          .slice()
          .sort((a, b) => {
            const order = tmpl?.items ?? [];
            return order.indexOf(a.name) - order.indexOf(b.name);
          });
        return { id: p.id, name: p.name, items };
      });
  }, [habits]);

  const habitChildren = useMemo(
    () => habits.filter((h) => h.parent_id),
    [habits]
  );
  const habitPct = habitChildren.length
    ? Math.round(
        (habitChildren.filter((h) => h.completed).length /
          habitChildren.length) *
          100
      )
    : 0;

  // Nutrition totals from today's meals.
  const totalCals = meals.reduce((s, m) => s + (m.calories ?? 0), 0);
  const totalProt = meals.reduce((s, m) => s + (m.protein ?? 0), 0);
  const calsLeft = Math.max(CALORIE_TARGET - totalCals, 0);

  // Finance figures keyed by label.
  const financeMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const row of finance) m.set(row.label, row.amount ?? 0);
    return m;
  }, [finance]);
  const netWorth = financeMap.get("net_worth") ?? 0;
  const monthChange = financeMap.get("month_change") ?? 0;
  const dayChange = financeMap.get("day_change") ?? 0;

  const money = (n: number) =>
    "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });

  const todayLabel = new Date().toLocaleDateString("en-US", {
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
          <span className="panel-title">{todayLabel} · {new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</span>
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

          {/* Daily Habits — LIVE from Supabase */}
          <section className="panel">
            <PanelTitle right={<span className="text-[11px] text-acid">{habitPct}%</span>}>
              Daily Habits
            </PanelTitle>
            <div className="mb-3 h-1 w-full overflow-hidden rounded bg-line">
              <div className="h-full bg-acid transition-all" style={{ width: `${habitPct}%` }} />
            </div>
            <div className="space-y-3">
              {habitGroups.map((g) => {
                const n = g.items.filter((i) => i.completed).length;
                return (
                  <div key={g.id}>
                    <div className="mb-1 flex justify-between text-[11px] text-muted">
                      <span className="uppercase tracking-wider">{g.name}</span>
                      <span>{n}/{g.items.length}</span>
                    </div>
                    {g.items.map((item) => (
                      <Check
                        key={item.id}
                        checked={item.completed}
                        onChange={() => toggleHabit(item.id, !item.completed)}
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
          {/* Kanban — LIVE from task views */}
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

          {/* Brain — life categories, LIVE counts from tasks */}
          <section className="panel">
            <PanelTitle>Brain · Life Categories</PanelTitle>
            <div className="grid grid-cols-2 gap-2">
              {categories.map((c) => (
                <div
                  key={c.key}
                  className="rounded border border-line bg-panel2 p-3"
                >
                  <div className="text-[12px] uppercase tracking-wider text-ghost">
                    {c.key}
                  </div>
                  <div className="mt-1 text-[11px] text-muted">{c.note}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Journal — LIVE latest entry */}
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
                  Voice capture lands in Phase 4 — entries will show here.
                </>
              )}
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-3 lg:col-span-4">
          {/* Calendar — static agenda (no backing table yet) */}
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
                <li key={g.id} className="group flex items-center gap-2 text-[13px] text-ghost">
                  <span className="text-acidDim">{i + 1}</span>
                  <span className="flex-1">{g.content}</span>
                  <button
                    onClick={() => deleteGoal(g.id)}
                    className="text-[11px] text-muted opacity-0 transition hover:text-acid group-hover:opacity-100"
                    aria-label="Delete goal"
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
                placeholder="+ add a monthly goal"
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
              <form onSubmit={addMeal} className="mb-3 space-y-2 rounded border border-line bg-panel2 p-2">
                <input
                  value={mealName}
                  onChange={(e) => setMealName(e.target.value)}
                  placeholder="meal"
                  className="w-full rounded border border-line bg-panel px-2 py-1 text-[12px] text-ghost outline-none placeholder:text-muted focus:border-acid/50"
                />
                <div className="flex gap-2">
                  <input
                    value={mealCals}
                    onChange={(e) => setMealCals(e.target.value)}
                    inputMode="numeric"
                    placeholder="kcal"
                    className="w-1/2 rounded border border-line bg-panel px-2 py-1 text-[12px] text-ghost outline-none placeholder:text-muted focus:border-acid/50"
                  />
                  <input
                    value={mealProt}
                    onChange={(e) => setMealProt(e.target.value)}
                    inputMode="numeric"
                    placeholder="protein g"
                    className="w-1/2 rounded border border-line bg-panel px-2 py-1 text-[12px] text-ghost outline-none placeholder:text-muted focus:border-acid/50"
                  />
                </div>
                <button className="w-full rounded bg-acid py-1.5 text-[12px] font-semibold text-ink hover:bg-acid/90">
                  Add meal
                </button>
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
              <Stat n={totalCals} label="kcal" />
              <Stat n={totalProt} label="protein g" />
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
