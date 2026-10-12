"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

/* ------------------------------------------------------------------ */
/*  ROW TYPES — match supabase/schema.sql                             */
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
  created_at: string;
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
/*  STILL-MOCK / COSMETIC BITS                                         */
/*  No table backs these yet: the Calendar has no schema table, and   */
/*  the Finance sparkline is a decorative flourish. Everything else   */
/*  on the dashboard is now live from Supabase.                       */
/* ------------------------------------------------------------------ */

// Decorative sparkline for Finance Pulse (purely cosmetic — not data).
const FINANCE_BARS = [
  8, 10, 7, 12, 9, 14, 11, 16, 13, 18, 15, 20, 17, 22, 19, 24, 21, 26, 23, 28,
];

// Calendar has no table in the schema yet, so it stays illustrative.
const CALENDAR = [
  { time: "09:30", label: "Standup w/ team" },
  { time: "11:30", label: "Investor call — fund II" },
  { time: "14:00", label: "Record finance video" },
  { time: "16:30", label: "1:1 with editor" },
];

// Life-category keys shown in the "Brain" panel. Counts are live
// (active tasks per category); opsec keeps a standing accent.
const CATEGORIES: { key: string; warn?: boolean }[] = [
  { key: "legal" },
  { key: "finance" },
  { key: "content" },
  { key: "products" },
  { key: "opsec", warn: true },
  { key: "business" },
];

// Default habit structure. The DB stores one copy per day (seeded from
// this on the first load of each day) so checks persist and reset daily.
const HABIT_TEMPLATE: { name: string; items: string[] }[] = [
  { name: "Morning", items: ["Warm-up", "Lift", "Stretch"] },
  { name: "Supplements", items: ["Creatine", "Omega-3", "Vit D", "Magnesium"] },
  { name: "Deep work", items: ["Scroll X", "Market research", "Ideate"] },
  { name: "Comms", items: ["Reply DMs", "Engage comments"] },
  { name: "Build", items: ["Portfolio", "Risk scan", "Dashboard"] },
];

const CALORIE_TARGET = 2040;

/* ------------------------------------------------------------------ */
/*  HELPERS                                                            */
/* ------------------------------------------------------------------ */

// Local-timezone YYYY-MM-DD, for the habits.date / journal.date columns.
function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Start of the local day as an ISO timestamp, for eaten_at comparisons.
function startOfTodayISO() {
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

  // Local form state
  const [newTask, setNewTask] = useState("");
  const [newGoal, setNewGoal] = useState("");
  const [revealMoney, setRevealMoney] = useState(false);
  const [ask, setAsk] = useState("");
  const [logging, setLogging] = useState(false);
  const [mealName, setMealName] = useState("");
  const [mealCals, setMealCals] = useState("");
  const [mealProt, setMealProt] = useState("");

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
      loadGoals(),
      loadMeals(),
      loadFinance(),
      loadJournal(),
    ]);
  }

  /* ---------------------------- tasks ---------------------------- */

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
    await supabase.from("tasks").update({ status: "done" }).eq("id", id);
    loadTasks();
  }

  /* --------------------------- habits ---------------------------- */

  async function loadHabits() {
    const today = todayISO();
    let { data } = await supabase.from("habits").select("*").eq("date", today);

    // Seed today's habits from the template on first load of the day.
    if (!data || data.length === 0) {
      const parents = HABIT_TEMPLATE.map((g) => ({ name: g.name, date: today }));
      const { data: parentRows } = await supabase
        .from("habits")
        .insert(parents)
        .select();

      if (parentRows && parentRows.length) {
        const children: {
          name: string;
          parent_id: string;
          date: string;
          completed: boolean;
        }[] = [];
        HABIT_TEMPLATE.forEach((g) => {
          const parent = (parentRows as HabitRow[]).find((p) => p.name === g.name);
          if (!parent) return;
          g.items.forEach((item) =>
            children.push({ name: item, parent_id: parent.id, date: today, completed: false })
          );
        });
        if (children.length) await supabase.from("habits").insert(children);
      }

      ({ data } = await supabase.from("habits").select("*").eq("date", today));
    }

    if (data) setHabits(data as HabitRow[]);
  }

  async function toggleHabit(id: string) {
    const h = habits.find((x) => x.id === id);
    if (!h) return;
    const next = !h.completed;
    // Optimistic update, then persist.
    setHabits((hs) => hs.map((x) => (x.id === id ? { ...x, completed: next } : x)));
    await supabase.from("habits").update({ completed: next }).eq("id", id);
  }

  /* ---------------------------- goals ---------------------------- */

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

  /* -------------------------- nutrition -------------------------- */

  async function loadMeals() {
    const { data } = await supabase
      .from("nutrition")
      .select("*")
      .gte("eaten_at", startOfTodayISO())
      .order("eaten_at", { ascending: false });
    if (data) setMeals(data as NutritionRow[]);
  }

  async function logMeal(e: React.FormEvent) {
    e.preventDefault();
    const meal = mealName.trim();
    if (!meal) return;
    await supabase.from("nutrition").insert({
      meal,
      calories: mealCals ? parseInt(mealCals, 10) : null,
      protein: mealProt ? parseInt(mealProt, 10) : null,
    });
    setMealName("");
    setMealCals("");
    setMealProt("");
    setLogging(false);
    loadMeals();
  }

  /* --------------------------- finance --------------------------- */

  async function loadFinance() {
    const { data } = await supabase.from("finance").select("*");
    if (data) setFinance(data as FinanceRow[]);
  }

  /* --------------------------- journal --------------------------- */

  async function loadJournal() {
    const { data } = await supabase
      .from("journal")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1);
    if (data && data.length) setJournal(data[0] as JournalRow);
  }

  /* --------------------------- derived --------------------------- */

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  const activeTasks = tasks.filter((t) => t.status === "active");
  const keyTasks = activeTasks.filter((t) => t.starred);

  const kanban = {
    today: activeTasks.filter((t) => t.view === "today"),
    week: activeTasks.filter((t) => t.view === "week"),
    month: activeTasks.filter((t) => t.view === "month"),
  };

  const catCount = (key: string) =>
    activeTasks.filter((t) => t.category === key).length;

  const habitItems = habits.filter((h) => h.parent_id !== null);
  const habitGroups = habits.filter((h) => h.parent_id === null);
  const habitPct =
    habitItems.length === 0
      ? 0
      : Math.round(
          (habitItems.filter((h) => h.completed).length / habitItems.length) * 100
        );

  const financeBy = (label: string) =>
    finance.find((f) => f.label === label)?.amount ?? null;
  const netWorth = financeBy("net_worth");
  const monthChange = financeBy("month");
  const dayChange = financeBy("day");

  const totalCals = meals.reduce((s, m) => s + (m.calories ?? 0), 0);
  const totalProt = meals.reduce((s, m) => s + (m.protein ?? 0), 0);
  const calsLeft = Math.max(CALORIE_TARGET - totalCals, 0);

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
              <div className="text-3xl font-semibold text-acid">
                {netWorth === null ? "—" : money(netWorth)}
              </div>
              <div className="mt-1 flex gap-4 text-[12px]">
                <span className="text-acidDim">
                  Month {monthChange === null ? "—" : "+" + money(monthChange)}
                </span>
                <span className="text-acidDim">
                  Today {dayChange === null ? "—" : "+" + money(dayChange)}
                </span>
              </div>
            </div>
            <div className="mt-3 flex h-12 items-end gap-1">
              {FINANCE_BARS.map((h, i) => (
                <div key={i} className="flex-1 rounded-sm bg-acid/60" style={{ height: `${h * 3}%` }} />
              ))}
            </div>
            {netWorth === null && (
              <p className="mt-2 text-[11px] text-muted">
                No finance rows yet — add rows to the <span className="text-ghost">finance</span> table
                with labels <span className="text-ghost">net_worth</span>, <span className="text-ghost">month</span>, <span className="text-ghost">day</span>.
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

          {/* Daily Habits — LIVE */}
          <section className="panel">
            <PanelTitle right={<span className="text-[11px] text-acid">{habitPct}%</span>}>
              Daily Habits
            </PanelTitle>
            <div className="mb-3 h-1 w-full overflow-hidden rounded bg-line">
              <div className="h-full bg-acid transition-all" style={{ width: `${habitPct}%` }} />
            </div>
            <div className="space-y-3">
              {habitGroups.map((g) => {
                const items = habitItems.filter((i) => i.parent_id === g.id);
                const n = items.filter((i) => i.completed).length;
                return (
                  <div key={g.id}>
                    <div className="mb-1 flex justify-between text-[11px] text-muted">
                      <span className="uppercase tracking-wider">{g.name}</span>
                      <span>{n}/{items.length}</span>
                    </div>
                    {items.map((item) => (
                      <Check
                        key={item.id}
                        checked={item.completed}
                        onChange={() => toggleHabit(item.id)}
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

          {/* Brain — life categories (counts are LIVE) */}
          <section className="panel">
            <PanelTitle>Brain · Life Categories</PanelTitle>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map((c) => {
                const n = catCount(c.key);
                return (
                  <div
                    key={c.key}
                    className={`rounded border bg-panel2 p-3 ${
                      c.warn ? "border-acid/40" : "border-line"
                    }`}
                  >
                    <div className={`text-[12px] uppercase tracking-wider ${c.warn ? "text-acid" : "text-ghost"}`}>
                      {c.key}
                    </div>
                    <div className="mt-1 text-[11px] text-muted">
                      {n} {n === 1 ? "task" : "tasks"}
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
                  {journal.ai_summary || journal.raw_transcript || "Entry saved — no summary yet."}
                </>
              ) : (
                <>
                  <div className="mb-1 uppercase tracking-wider">No entries yet</div>
                  Voice capture lands in Phase 4; entries saved to the journal table will show here.
                </>
              )}
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-3 lg:col-span-4">
          {/* Calendar (no table yet — illustrative) */}
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

          {/* Goals — LIVE */}
          <section className="panel">
            <PanelTitle>Goals · This Month</PanelTitle>
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
                    className="w-full rounded border border-line bg-panel2 px-2 py-1 text-[12px] text-ghost outline-none placeholder:text-muted focus:border-acid/50"
                  />
                  <input
                    value={mealProt}
                    onChange={(e) => setMealProt(e.target.value)}
                    inputMode="numeric"
                    placeholder="protein g"
                    className="w-full rounded border border-line bg-panel2 px-2 py-1 text-[12px] text-ghost outline-none placeholder:text-muted focus:border-acid/50"
                  />
                  <button className="chip hover:text-acid">Save</button>
                </div>
              </form>
            )}

            <div className="space-y-1">
              {meals.length === 0 && !logging && (
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
