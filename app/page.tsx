"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

/* ------------------------------------------------------------------ */
/*  ROW TYPES — these match the tables in supabase/schema.sql          */
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

type JournalRow = {
  id: string;
  date: string;
  raw_transcript: string | null;
  ai_summary: string | null;
  created_at: string;
};

type NutritionRow = {
  id: string;
  meal: string;
  calories: number | null;
  protein: number | null;
  eaten_at: string;
};

type GoalRow = {
  id: string;
  content: string;
  period: "week" | "month" | null;
  created_at: string;
};

type FinanceRow = {
  id: string;
  label: string;
  amount: number | null;
  as_of: string;
};

/* ------------------------------------------------------------------ */
/*  CONFIG                                                             */
/*  Not data — just display settings. The six life categories mirror  */
/*  the `category` check in the tasks column; the kcal target is the   */
/*  single-user daily goal until a settings table exists.              */
/* ------------------------------------------------------------------ */

const CATEGORY_KEYS = ["legal", "finance", "content", "products", "opsec", "business"] as const;
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
/*  DATE HELPERS                                                       */
/* ------------------------------------------------------------------ */

const todayISO = () => new Date().toISOString().slice(0, 10);
const startOfTodayISO = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

/* ------------------------------------------------------------------ */
/*  PAGE                                                               */
/* ------------------------------------------------------------------ */

export default function Dashboard() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);

  // Live table state
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [habits, setHabits] = useState<HabitRow[]>([]);
  const [journal, setJournal] = useState<JournalRow | null>(null);
  const [meals, setMeals] = useState<NutritionRow[]>([]);
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [finance, setFinance] = useState<FinanceRow[]>([]);

  // Form state
  const [newTask, setNewTask] = useState("");
  const [newGoal, setNewGoal] = useState("");
  const [logging, setLogging] = useState(false);
  const [mealName, setMealName] = useState("");
  const [mealKcal, setMealKcal] = useState("");
  const [mealProtein, setMealProtein] = useState("");

  const [revealMoney, setRevealMoney] = useState(false);
  const [ask, setAsk] = useState("");

  /* ---- loaders (one per table, so a single failing query can't blank
          the whole dashboard) ---- */

  const loadTasks = useCallback(async () => {
    const { data } = await supabase
      .from("tasks")
      .select("*")
      .order("priority", { ascending: false })
      .order("created_at", { ascending: true });
    if (data) setTasks(data as TaskRow[]);
  }, []);

  const loadHabits = useCallback(async () => {
    const { data } = await supabase
      .from("habits")
      .select("*")
      .eq("date", todayISO());
    if (data) setHabits(data as HabitRow[]);
  }, []);

  const loadJournal = useCallback(async () => {
    const { data } = await supabase
      .from("journal")
      .select("*")
      .order("date", { ascending: false })
      .limit(1);
    setJournal(data && data.length ? (data[0] as JournalRow) : null);
  }, []);

  const loadMeals = useCallback(async () => {
    const { data } = await supabase
      .from("nutrition")
      .select("*")
      .gte("eaten_at", startOfTodayISO())
      .order("eaten_at", { ascending: true });
    if (data) setMeals(data as NutritionRow[]);
  }, []);

  const loadGoals = useCallback(async () => {
    const { data } = await supabase
      .from("goals")
      .select("*")
      .eq("period", "month")
      .order("created_at", { ascending: true });
    if (data) setGoals(data as GoalRow[]);
  }, []);

  const loadFinance = useCallback(async () => {
    const { data } = await supabase
      .from("finance")
      .select("*")
      .order("as_of", { ascending: true });
    if (data) setFinance(data as FinanceRow[]);
  }, []);

  const loadAll = useCallback(() => {
    loadTasks();
    loadHabits();
    loadJournal();
    loadMeals();
    loadGoals();
    loadFinance();
  }, [loadTasks, loadHabits, loadJournal, loadMeals, loadGoals, loadFinance]);

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

  /* ---- mutations ---- */

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
    await supabase.from("habits").update({ completed: !h.completed }).eq("id", h.id);
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
    const meal = mealName.trim();
    if (!meal) return;
    await supabase.from("nutrition").insert({
      meal,
      calories: mealKcal ? Number(mealKcal) : null,
      protein: mealProtein ? Number(mealProtein) : null,
    });
    setMealName("");
    setMealKcal("");
    setMealProtein("");
    setLogging(false);
    loadMeals();
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  /* ---- derived views ---- */

  const keyTasks = tasks.filter((t) => t.starred && t.status === "active");

  const activeTasks = useMemo(
    () => tasks.filter((t) => t.status === "active"),
    [tasks]
  );

  const kanban = useMemo(() => {
    const cols: Record<"today" | "week" | "month", TaskRow[]> = {
      today: [],
      week: [],
      month: [],
    };
    for (const t of activeTasks) cols[t.view]?.push(t);
    return cols;
  }, [activeTasks]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of activeTasks) {
      if (t.category) counts[t.category] = (counts[t.category] ?? 0) + 1;
    }
    return counts;
  }, [activeTasks]);

  // Habits grouped by parent. Parents have parent_id === null.
  const habitGroups = useMemo(() => {
    const parents = habits.filter((h) => h.parent_id === null);
    return parents.map((p) => ({
      group: p,
      items: habits.filter((h) => h.parent_id === p.id),
    }));
  }, [habits]);

  // Flat list of the completable leaf habits (items under a group).
  const leafHabits = useMemo(() => habits.filter((h) => h.parent_id !== null), [habits]);
  const habitPct = leafHabits.length
    ? Math.round((leafHabits.filter((h) => h.completed).length / leafHabits.length) * 100)
    : 0;

  // Nutrition totals for today, summed from the logged meals.
  const kcalToday = meals.reduce((s, m) => s + (m.calories ?? 0), 0);
  const proteinToday = meals.reduce((s, m) => s + (m.protein ?? 0), 0);
  const kcalLeft = Math.max(DAILY_KCAL_TARGET - kcalToday, 0);

  // Finance: latest value per label + a net-worth sparkline from history.
  const financeByLabel = useMemo(() => {
    const latest: Record<string, number> = {};
    for (const row of finance) {
      if (row.amount !== null) latest[row.label] = row.amount; // ordered asc → last wins
    }
    return latest;
  }, [finance]);

  const netWorthHistory = useMemo(
    () =>
      finance
        .filter((r) => r.label === "net_worth" && r.amount !== null)
        .map((r) => r.amount as number),
    [finance]
  );

  const sparkline = useMemo(() => {
    if (netWorthHistory.length < 2) return [] as number[];
    const min = Math.min(...netWorthHistory);
    const max = Math.max(...netWorthHistory);
    const span = max - min || 1;
    return netWorthHistory.map((v) => 15 + ((v - min) / span) * 85); // 15%..100%
  }, [netWorthHistory]);

  const netWorth = financeByLabel["net_worth"] ?? 0;
  const monthChange = financeByLabel["month"] ?? 0;
  const dayChange = financeByLabel["day"] ?? 0;

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
          {/* Finance Pulse — LIVE from the finance table */}
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
            {sparkline.length > 0 ? (
              <div className="mt-3 flex h-12 items-end gap-1">
                {sparkline.map((h, i) => (
                  <div key={i} className="flex-1 rounded-sm bg-acid/60" style={{ height: `${h}%` }} />
                ))}
              </div>
            ) : (
              <p className="mt-3 text-[11px] text-muted">
                Add rows to the <span className="text-acidDim">finance</span> table (label
                <span className="text-acidDim"> net_worth</span>) to see your trend.
              </p>
            )}
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

          {/* Daily Habits — LIVE from the habits table */}
          <section className="panel">
            <PanelTitle right={<span className="text-[11px] text-acid">{habitPct}%</span>}>
              Daily Habits
            </PanelTitle>
            <div className="mb-3 h-1 w-full overflow-hidden rounded bg-line">
              <div className="h-full bg-acid transition-all" style={{ width: `${habitPct}%` }} />
            </div>
            {habitGroups.length === 0 ? (
              <p className="py-1 text-[12px] text-muted">
                No habits for today yet. Add rows to the{" "}
                <span className="text-acidDim">habits</span> table (a parent row per group, child
                rows for each habit).
              </p>
            ) : (
              <div className="space-y-3">
                {habitGroups.map(({ group, items }) => {
                  const n = items.filter((i) => i.completed).length;
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
              </div>
            )}
          </section>
        </div>

        {/* CENTER COLUMN */}
        <div className="space-y-3 lg:col-span-5">
          {/* Kanban — LIVE from tasks grouped by `view` */}
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

          {/* Brain — life categories, counts derived from live tasks */}
          <section className="panel">
            <PanelTitle>Brain · Life Categories</PanelTitle>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORY_KEYS.map((key) => {
                const n = categoryCounts[key] ?? 0;
                return (
                  <div key={key} className="rounded border border-line bg-panel2 p-3">
                    <div className="text-[12px] uppercase tracking-wider text-ghost">{key}</div>
                    <div className="mt-1 text-[11px] text-muted">
                      {n > 0 ? `${n} active` : "clear"}
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
                {journal.ai_summary || journal.raw_transcript || "No entry text yet."}
              </div>
            ) : (
              <p className="text-[11px] text-muted">
                No journal entries yet. Voice capture lands in Phase 4.
              </p>
            )}
          </section>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-3 lg:col-span-4">
          {/* Calendar — static for now (no calendar table in the schema) */}
          <section className="panel">
            <PanelTitle right={<span className="h-1.5 w-1.5 rounded-full bg-acid" />}>
              Calendar · Today
            </PanelTitle>
            <p className="text-[11px] text-muted">
              Calendar sync isn&apos;t wired yet — there&apos;s no calendar table in the schema.
              This panel lights up in a later phase.
            </p>
          </section>

          {/* Goals — LIVE from the goals table */}
          <section className="panel">
            <PanelTitle>Goals · This Month</PanelTitle>
            {goals.length === 0 ? (
              <p className="mb-2 text-[12px] text-muted">No goals yet — add one below.</p>
            ) : (
              <ol className="space-y-1.5">
                {goals.map((g, i) => (
                  <li key={g.id} className="flex gap-2 text-[13px] text-ghost">
                    <span className="text-acidDim">{i + 1}</span>
                    {g.content}
                  </li>
                ))}
              </ol>
            )}
            <form onSubmit={addGoal} className="mt-2 flex gap-2">
              <input
                value={newGoal}
                onChange={(e) => setNewGoal(e.target.value)}
                placeholder="+ add a monthly goal"
                className="flex-1 rounded border border-line bg-panel2 px-2 py-1 text-[12px] text-ghost outline-none placeholder:text-muted focus:border-acid/50"
              />
              <button className="chip hover:text-acid">Add</button>
            </form>
          </section>

          {/* Nutrition — LIVE meals + totals */}
          <section className="panel">
            <PanelTitle
              right={
                <button onClick={() => setLogging((v) => !v)} className="chip hover:text-acid">
                  {logging ? "Cancel" : "+ Log"}
                </button>
              }
            >
              Nutrition
            </PanelTitle>
            {logging && (
              <form onSubmit={logMeal} className="mb-3 space-y-2">
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
                <button className="w-full rounded bg-acid py-1.5 text-[12px] font-semibold text-ink hover:bg-acid/90">
                  Save meal
                </button>
              </form>
            )}
            {meals.length === 0 ? (
              <p className="text-[12px] text-muted">No meals logged today.</p>
            ) : (
              <div className="space-y-1">
                {meals.map((m) => (
                  <div key={m.id} className="flex items-center justify-between rounded border border-line bg-panel2 px-2 py-1.5 text-[12px]">
                    <span className="text-ghost">{m.meal}</span>
                    <span className="text-muted">{m.calories ?? 0} kcal · {m.protein ?? 0}p</span>
                  </div>
                ))}
              </div>
            )}
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
