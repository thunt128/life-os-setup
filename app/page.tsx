"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

/* ------------------------------------------------------------------ */
/*  ROW TYPES — match supabase/schema.sql                              */
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
};

type FinanceRow = {
  id: string;
  label: string;
  amount: number | null;
  as_of: string;
};

/* ------------------------------------------------------------------ */
/*  CONSTANTS (not backed by a table)                                  */
/* ------------------------------------------------------------------ */

// The six life categories the Brain panel tracks. Counts are derived
// live from the tasks table; "opsec" is flagged when it has no activity.
const CATEGORY_KEYS = ["legal", "finance", "content", "products", "opsec", "business"] as const;

// Daily calorie target (no column for this in the schema yet).
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

function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="py-1 text-[12px] text-muted">{children}</p>;
}

/* ------------------------------------------------------------------ */
/*  PAGE                                                               */
/* ------------------------------------------------------------------ */

export default function Dashboard() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);

  // Live data from Supabase.
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [habits, setHabits] = useState<HabitRow[]>([]);
  const [journal, setJournal] = useState<JournalRow | null>(null);
  const [meals, setMeals] = useState<NutritionRow[]>([]);
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [finance, setFinance] = useState<FinanceRow[]>([]);

  // Local UI state.
  const [newTask, setNewTask] = useState("");
  const [newGoal, setNewGoal] = useState("");
  const [revealMoney, setRevealMoney] = useState(false);
  const [ask, setAsk] = useState("");

  const todayISO = new Date().toISOString().slice(0, 10);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function loadAll() {
    await Promise.all([
      loadTasks(),
      loadHabits(),
      loadJournal(),
      loadMeals(),
      loadGoals(),
      loadFinance(),
    ]);
  }

  /* ---------------- loaders ---------------- */

  async function loadTasks() {
    const { data } = await supabase
      .from("tasks")
      .select("*")
      .eq("status", "active")
      .order("priority", { ascending: false })
      .order("created_at", { ascending: true });
    if (data) setTasks(data as TaskRow[]);
  }

  async function loadHabits() {
    const { data } = await supabase
      .from("habits")
      .select("*")
      .eq("date", todayISO);
    if (data) setHabits(data as HabitRow[]);
  }

  async function loadJournal() {
    const { data } = await supabase
      .from("journal")
      .select("*")
      .order("date", { ascending: false })
      .limit(1);
    setJournal(data && data.length ? (data[0] as JournalRow) : null);
  }

  async function loadMeals() {
    // Meals eaten today (local-day window).
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const { data } = await supabase
      .from("nutrition")
      .select("*")
      .gte("eaten_at", start.toISOString())
      .order("eaten_at", { ascending: true });
    if (data) setMeals(data as NutritionRow[]);
  }

  async function loadGoals() {
    const { data } = await supabase
      .from("goals")
      .select("*")
      .eq("period", "month")
      .order("created_at", { ascending: true });
    if (data) setGoals(data as GoalRow[]);
  }

  async function loadFinance() {
    const { data } = await supabase
      .from("finance")
      .select("*")
      .order("as_of", { ascending: false });
    if (data) setFinance(data as FinanceRow[]);
  }

  /* ---------------- mutations ---------------- */

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
    setHabits((hs) => hs.map((x) => (x.id === h.id ? { ...x, completed: !x.completed } : x)));
    await supabase.from("habits").update({ completed: !h.completed }).eq("id", h.id);
  }

  async function addGoal(e: React.FormEvent) {
    e.preventDefault();
    const content = newGoal.trim();
    if (!content) return;
    setNewGoal("");
    await supabase.from("goals").insert({ content, period: "month" });
    loadGoals();
  }

  async function logMeal() {
    const meal = window.prompt("Meal (e.g. Chicken & rice)")?.trim();
    if (!meal) return;
    const cal = Number(window.prompt("Calories?", "0")) || null;
    const pro = Number(window.prompt("Protein (g)?", "0")) || null;
    await supabase.from("nutrition").insert({ meal, calories: cal, protein: pro });
    loadMeals();
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  /* ---------------- derived views ---------------- */

  const keyTasks = useMemo(() => tasks.filter((t) => t.starred), [tasks]);

  const kanban = useMemo(() => {
    const cols: Record<"today" | "week" | "month", TaskRow[]> = {
      today: [],
      week: [],
      month: [],
    };
    for (const t of tasks) cols[t.view]?.push(t);
    return cols;
  }, [tasks]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of tasks) {
      if (t.category) counts[t.category] = (counts[t.category] ?? 0) + 1;
    }
    return counts;
  }, [tasks]);

  // Habits: group children under their parent row; parents have parent_id null.
  const habitGroups = useMemo(() => {
    const parents = habits.filter((h) => h.parent_id === null);
    return parents
      .map((p) => ({
        parent: p,
        items: habits.filter((h) => h.parent_id === p.id),
      }))
      .filter((g) => g.items.length > 0);
  }, [habits]);

  const habitItems = useMemo(() => habits.filter((h) => h.parent_id !== null), [habits]);
  const habitPct = habitItems.length
    ? Math.round((habitItems.filter((h) => h.completed).length / habitItems.length) * 100)
    : 0;

  const financeVal = (re: RegExp) =>
    finance.find((r) => re.test(r.label))?.amount ?? null;
  const netWorth = financeVal(/net.?worth/i);
  const monthChange = financeVal(/month/i);
  const dayChange = financeVal(/day|today/i);

  const kcalToday = meals.reduce((s, m) => s + (m.calories ?? 0), 0);
  const proteinToday = meals.reduce((s, m) => s + (m.protein ?? 0), 0);
  const kcalLeft = Math.max(CALORIE_TARGET - kcalToday, 0);

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
            {today} · {new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
          </span>
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
            {finance.length === 0 ? (
              <EmptyNote>No finance rows yet.</EmptyNote>
            ) : (
              <div className={revealMoney ? "" : "select-none blur-md"}>
                <div className="text-3xl font-semibold text-acid">{money(netWorth ?? 0)}</div>
                <div className="mt-1 flex gap-4 text-[12px]">
                  {monthChange !== null && (
                    <span className="text-acidDim">Month +{money(monthChange)}</span>
                  )}
                  {dayChange !== null && (
                    <span className="text-acidDim">Today +{money(dayChange)}</span>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* Key Tasks — LIVE */}
          <section className="panel">
            <PanelTitle right={<span className="text-[10px] text-acidDim">live</span>}>
              Key Tasks · Today
            </PanelTitle>
            {keyTasks.length === 0 && (
              <EmptyNote>No starred tasks yet — add one below.</EmptyNote>
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
            {habitGroups.length === 0 ? (
              <EmptyNote>No habits for today yet.</EmptyNote>
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
          {/* Kanban — LIVE (tasks grouped by view) */}
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
              {CATEGORY_KEYS.map((key) => {
                const count = categoryCounts[key] ?? 0;
                const warn = key === "opsec" && count === 0;
                return (
                  <div
                    key={key}
                    className={`rounded border bg-panel2 p-3 ${warn ? "border-acid/40" : "border-line"}`}
                  >
                    <div className={`text-[12px] uppercase tracking-wider ${warn ? "text-acid" : "text-ghost"}`}>
                      {key}
                    </div>
                    <div className="mt-1 text-[11px] text-muted">
                      {warn ? "backup overdue" : `${count} open`}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Journal — LIVE (most recent entry) */}
          <section className="panel">
            <PanelTitle>Journal</PanelTitle>
            <button className="mb-3 flex w-full items-center justify-center gap-2 rounded border border-acid/40 bg-acid/5 py-2 text-[12px] text-acid hover:bg-acid/10">
              <span className="h-2 w-2 rounded-full bg-acid" />
              Hold to voice-note your day
            </button>
            {journal ? (
              <div className="text-[11px] text-muted">
                <div className="mb-1 uppercase tracking-wider">{journal.date}</div>
                {journal.ai_summary || journal.raw_transcript || "No summary yet."}
              </div>
            ) : (
              <EmptyNote>No journal entries yet.</EmptyNote>
            )}
          </section>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-3 lg:col-span-4">
          {/* Calendar — no table in schema yet; shown as a placeholder. */}
          <section className="panel">
            <PanelTitle right={<span className="h-1.5 w-1.5 rounded-full bg-acid" />}>
              Calendar · Today
            </PanelTitle>
            <EmptyNote>Calendar sync arrives in a later phase.</EmptyNote>
          </section>

          {/* Goals — LIVE (period = month) */}
          <section className="panel">
            <PanelTitle>Goals · This Month</PanelTitle>
            {goals.length === 0 ? (
              <EmptyNote>No goals yet — add one below.</EmptyNote>
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

          {/* Nutrition — LIVE (today's meals) */}
          <section className="panel">
            <PanelTitle right={<button onClick={logMeal} className="chip hover:text-acid">+ Log</button>}>
              Nutrition
            </PanelTitle>
            {meals.length === 0 ? (
              <EmptyNote>No meals logged today.</EmptyNote>
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
