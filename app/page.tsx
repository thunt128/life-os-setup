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

type GoalRow = { id: string; content: string; period: "week" | "month" | null };

type FinanceRow = { id: string; label: string; amount: number | null; as_of: string };

type NutritionRow = {
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

type HabitRow = { id: string; name: string; date: string; completed: boolean };

/* ------------------------------------------------------------------ */
/*  STATIC SHAPE (no backing table in the schema yet)                  */
/*  The habit *structure* lives here; which items are ticked each day  */
/*  is persisted to the `habits` table (name = "Group:Item", per day). */
/* ------------------------------------------------------------------ */

const HABIT_GROUPS = [
  { name: "Morning", items: ["Warm-up", "Lift", "Stretch"] },
  { name: "Supplements", items: ["Creatine", "Omega-3", "Vit D", "Magnesium"] },
  { name: "Deep work", items: ["Scroll X", "Market research", "Ideate"] },
  { name: "Comms", items: ["Reply DMs", "Engage comments"] },
  { name: "Build", items: ["Portfolio", "Risk scan", "Dashboard"] },
];

// Life-category keys shown in the Brain panel. Counts are computed live
// from the tasks table; there is no `categories` table in the schema.
const CATEGORY_KEYS = ["legal", "finance", "content", "products", "opsec", "business"];

// Visual sparkline for the Finance panel. There is no finance time-series
// table in the schema, so this stays presentational for now.
const FINANCE_BARS = [
  8, 10, 7, 12, 9, 14, 11, 16, 13, 18, 15, 20, 17, 22, 19, 24, 21, 26, 23, 28,
];

// Calendar has no backing table in the schema, so it stays presentational.
const CALENDAR = [
  { time: "09:30", label: "Standup w/ team" },
  { time: "11:30", label: "Investor call — fund II" },
  { time: "14:00", label: "Record finance video" },
  { time: "16:30", label: "1:1 with editor" },
];

const KCAL_TARGET = 2040;

/* ------------------------------------------------------------------ */
/*  HELPERS                                                            */
/* ------------------------------------------------------------------ */

// Local YYYY-MM-DD, used for per-day habit rows.
function todayStr() {
  const d = new Date();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

// Start of today (local) as an ISO timestamp, for filtering `eaten_at`.
function startOfTodayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

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

  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [finance, setFinance] = useState<FinanceRow[]>([]);
  const [meals, setMeals] = useState<NutritionRow[]>([]);
  const [journal, setJournal] = useState<JournalRow | null>(null);
  // Per-day habit completion, keyed by "Group:Item". Seeded from the DB.
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [habitRows, setHabitRows] = useState<Record<string, HabitRow>>({});

  const [newTask, setNewTask] = useState("");
  const [newGoal, setNewGoal] = useState("");
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

  function loadAll() {
    loadTasks();
    loadGoals();
    loadFinance();
    loadNutrition();
    loadJournal();
    loadHabits();
  }

  /* ---- loaders ---- */

  async function loadTasks() {
    const { data } = await supabase
      .from("tasks")
      .select("*")
      .order("priority", { ascending: false });
    if (data) setTasks(data as TaskRow[]);
  }

  async function loadGoals() {
    const { data } = await supabase
      .from("goals")
      .select("*")
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

  async function loadNutrition() {
    const { data } = await supabase
      .from("nutrition")
      .select("*")
      .gte("eaten_at", startOfTodayISO())
      .order("eaten_at", { ascending: true });
    if (data) setMeals(data as NutritionRow[]);
  }

  async function loadJournal() {
    const { data } = await supabase
      .from("journal")
      .select("*")
      .order("date", { ascending: false })
      .limit(1);
    if (data && data.length) setJournal(data[0] as JournalRow);
  }

  async function loadHabits() {
    const { data } = await supabase
      .from("habits")
      .select("*")
      .eq("date", todayStr());
    if (data) {
      const rows: Record<string, HabitRow> = {};
      const state: Record<string, boolean> = {};
      (data as HabitRow[]).forEach((r) => {
        rows[r.name] = r;
        state[r.name] = r.completed;
      });
      setHabitRows(rows);
      setDone(state);
    }
  }

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

  async function addGoal(e: React.FormEvent) {
    e.preventDefault();
    const content = newGoal.trim();
    if (!content) return;
    setNewGoal("");
    await supabase.from("goals").insert({ content, period: "month" });
    loadGoals();
  }

  async function logMeal() {
    const meal = window.prompt("Meal?");
    if (!meal || !meal.trim()) return;
    const calories = Number(window.prompt("Calories?", "0")) || 0;
    const protein = Number(window.prompt("Protein (g)?", "0")) || 0;
    await supabase.from("nutrition").insert({ meal: meal.trim(), calories, protein });
    loadNutrition();
  }

  // Toggle a habit for today; persists to the `habits` table.
  async function toggleHabit(name: string) {
    const next = !done[name];
    setDone((d) => ({ ...d, [name]: next }));
    const existing = habitRows[name];
    if (existing) {
      await supabase.from("habits").update({ completed: next }).eq("id", existing.id);
      setHabitRows((r) => ({ ...r, [name]: { ...existing, completed: next } }));
    } else {
      const { data } = await supabase
        .from("habits")
        .insert({ name, date: todayStr(), completed: next })
        .select()
        .single();
      if (data) setHabitRows((r) => ({ ...r, [name]: data as HabitRow }));
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  /* ---- derived ---- */

  const keyTasks = tasks.filter((t) => t.starred && t.status === "active");

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

  const catCount = (key: string) =>
    tasks.filter((t) => t.status === "active" && t.category === key).length;

  const financeRow = (re: RegExp) => finance.find((f) => re.test(f.label));
  const netWorthRow = financeRow(/net\s*_?\s*worth/i);
  const monthRow = financeRow(/month/i);
  const dayRow = financeRow(/day|today/i);

  const kcal = meals.reduce((s, m) => s + (m.calories ?? 0), 0);
  const protein = meals.reduce((s, m) => s + (m.protein ?? 0), 0);
  const kcalLeft = Math.max(KCAL_TARGET - kcal, 0);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  const allHabits = useMemo(
    () => HABIT_GROUPS.flatMap((g) => g.items.map((i) => `${g.name}:${i}`)),
    []
  );
  const habitPct = Math.round(
    (allHabits.filter((k) => done[k]).length / allHabits.length) * 100
  );

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
            {finance.length === 0 ? (
              <p className="py-1 text-[12px] text-muted">
                No finance rows yet — add rows to the <code>finance</code> table
                (e.g. label “net worth”).
              </p>
            ) : (
              <div className={revealMoney ? "" : "select-none blur-md"}>
                <div className="text-3xl font-semibold text-acid">
                  {money(Number(netWorthRow?.amount ?? finance[0]?.amount ?? 0))}
                </div>
                <div className="mt-1 flex gap-4 text-[12px]">
                  {monthRow && (
                    <span className="text-acidDim">Month +{money(Number(monthRow.amount ?? 0))}</span>
                  )}
                  {dayRow && (
                    <span className="text-acidDim">Today +{money(Number(dayRow.amount ?? 0))}</span>
                  )}
                </div>
              </div>
            )}
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

          {/* Daily Habits — LIVE (completion persisted per day) */}
          <section className="panel">
            <PanelTitle right={<span className="text-[11px] text-acid">{habitPct}%</span>}>
              Daily Habits
            </PanelTitle>
            <div className="mb-3 h-1 w-full overflow-hidden rounded bg-line">
              <div className="h-full bg-acid transition-all" style={{ width: `${habitPct}%` }} />
            </div>
            <div className="space-y-3">
              {HABIT_GROUPS.map((g) => {
                const keys = g.items.map((i) => `${g.name}:${i}`);
                const n = keys.filter((k) => done[k]).length;
                return (
                  <div key={g.name}>
                    <div className="mb-1 flex justify-between text-[11px] text-muted">
                      <span className="uppercase tracking-wider">{g.name}</span>
                      <span>{n}/{g.items.length}</span>
                    </div>
                    {g.items.map((item) => {
                      const k = `${g.name}:${item}`;
                      return (
                        <Check key={k} checked={!!done[k]} onChange={() => toggleHabit(k)} label={item} />
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* CENTER COLUMN */}
        <div className="space-y-3 lg:col-span-5">
          {/* Kanban — LIVE tasks grouped by view */}
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

          {/* Brain — life categories, live task counts */}
          <section className="panel">
            <PanelTitle>Brain · Life Categories</PanelTitle>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORY_KEYS.map((key) => {
                const n = catCount(key);
                return (
                  <div key={key} className="rounded border border-line bg-panel2 p-3">
                    <div className="text-[12px] uppercase tracking-wider text-ghost">{key}</div>
                    <div className="mt-1 text-[11px] text-muted">
                      {n} active {n === 1 ? "task" : "tasks"}
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
            <div className="text-[11px] text-muted">
              {journal ? (
                <>
                  <div className="mb-1 uppercase tracking-wider">{journal.date}</div>
                  {journal.ai_summary || journal.raw_transcript || "No summary yet."}
                </>
              ) : (
                <>
                  <div className="mb-1 uppercase tracking-wider">Journal</div>
                  No entries yet — voice capture lands in Phase 4.
                </>
              )}
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-3 lg:col-span-4">
          {/* Calendar (presentational — no table in schema yet) */}
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
              <p className="mb-2 py-1 text-[12px] text-muted">No goals yet — add one below.</p>
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
            <PanelTitle right={<button onClick={logMeal} className="chip hover:text-acid">+ Log</button>}>
              Nutrition
            </PanelTitle>
            <div className="space-y-1">
              {meals.length === 0 && (
                <p className="py-1 text-[12px] text-muted">No meals logged today.</p>
              )}
              {meals.map((m) => (
                <div key={m.id} className="flex items-center justify-between rounded border border-line bg-panel2 px-2 py-1.5 text-[12px]">
                  <span className="text-ghost">{m.meal}</span>
                  <span className="text-muted">{m.calories ?? 0} kcal · {m.protein ?? 0}p</span>
                </div>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <Stat n={kcal} label="kcal" />
              <Stat n={protein} label="protein g" />
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
