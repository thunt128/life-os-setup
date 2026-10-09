"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import type {
  FinanceRow,
  GoalRow,
  HabitRow,
  JournalRow,
  NutritionRow,
  TaskRow,
} from "@/lib/types";

/* ------------------------------------------------------------------ */
/*  CONSTANTS                                                          */
/*  Phase 2 replaces the old hard-coded mock data with live Supabase   */
/*  queries. What's left here is genuine configuration, not data:      */
/*  the life-category keys, the daily protein target, and the default  */
/*  habit list used to seed a fresh day.                               */
/* ------------------------------------------------------------------ */

const CATEGORY_KEYS = ["legal", "finance", "content", "products", "opsec", "business"] as const;

const PROTEIN_TARGET_KCAL = 2040;

// Used once per day to seed today's habits when none exist yet.
const DEFAULT_HABITS: { name: string; items: string[] }[] = [
  { name: "Morning", items: ["Warm-up", "Lift", "Stretch"] },
  { name: "Supplements", items: ["Creatine", "Omega-3", "Vit D", "Magnesium"] },
  { name: "Deep work", items: ["Scroll X", "Market research", "Ideate"] },
  { name: "Comms", items: ["Reply DMs", "Engage comments"] },
  { name: "Build", items: ["Portfolio", "Risk scan", "Dashboard"] },
];

// Finance rows are looked up by label; these aliases map the three
// headline numbers to whatever the user labelled them in the DB.
const FINANCE_LOOKUP = {
  netWorth: ["net worth", "net_worth", "networth"],
  month: ["month", "this month", "monthly"],
  day: ["day", "today", "daily"],
};

// Still mocked: the calendar has no table in schema.sql yet.
const CALENDAR = [
  { time: "09:30", label: "Standup w/ team" },
  { time: "11:30", label: "Investor call — fund II" },
  { time: "14:00", label: "Record finance video" },
  { time: "16:30", label: "1:1 with editor" },
];

/* ------------------------------------------------------------------ */
/*  DATE HELPERS                                                       */
/* ------------------------------------------------------------------ */

// Local YYYY-MM-DD, matching the `date` columns in the schema.
function todayStr(): string {
  const d = new Date();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

// Start of the local day as an ISO timestamp, for `eaten_at` filters.
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

  // Live data pulled from Supabase.
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [habits, setHabits] = useState<HabitRow[]>([]);
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [meals, setMeals] = useState<NutritionRow[]>([]);
  const [finance, setFinance] = useState<FinanceRow[]>([]);
  const [journal, setJournal] = useState<JournalRow | null>(null);

  // Local form state.
  const [newTask, setNewTask] = useState("");
  const [newGoal, setNewGoal] = useState("");
  const [newMeal, setNewMeal] = useState({ meal: "", calories: "", protein: "" });
  const [revealMoney, setRevealMoney] = useState(false);
  const [ask, setAsk] = useState("");

  /* ----------------------------- LOADERS ----------------------------- */

  const loadTasks = useCallback(async () => {
    const { data } = await supabase
      .from("tasks")
      .select("*")
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false });
    if (data) setTasks(data as TaskRow[]);
  }, []);

  const loadHabits = useCallback(async () => {
    const { data } = await supabase.from("habits").select("*").eq("date", todayStr());
    if (data) setHabits(data as HabitRow[]);
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
    const { data } = await supabase.from("finance").select("*").order("as_of", { ascending: false });
    if (data) setFinance(data as FinanceRow[]);
  }, []);

  const loadJournal = useCallback(async () => {
    const { data } = await supabase
      .from("journal")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1);
    if (data && data.length) setJournal(data[0] as JournalRow);
  }, []);

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

  /* ----------------------------- MUTATIONS ----------------------------- */

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
    setHabits((prev) => prev.map((x) => (x.id === h.id ? { ...x, completed: !x.completed } : x)));
    await supabase.from("habits").update({ completed: !h.completed }).eq("id", h.id);
  }

  async function seedHabits() {
    const date = todayStr();
    for (const group of DEFAULT_HABITS) {
      const { data: parent } = await supabase
        .from("habits")
        .insert({ name: group.name, date })
        .select()
        .single();
      if (!parent) continue;
      await supabase
        .from("habits")
        .insert(group.items.map((name) => ({ name, parent_id: (parent as HabitRow).id, date })));
    }
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

  async function addMeal(e: React.FormEvent) {
    e.preventDefault();
    const meal = newMeal.meal.trim();
    if (!meal) return;
    const calories = newMeal.calories ? parseInt(newMeal.calories, 10) : null;
    const protein = newMeal.protein ? parseInt(newMeal.protein, 10) : null;
    setNewMeal({ meal: "", calories: "", protein: "" });
    await supabase.from("nutrition").insert({ meal, calories, protein });
    loadMeals();
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  /* ----------------------------- DERIVED ----------------------------- */

  const keyTasks = tasks.filter((t) => t.starred && t.status === "active");

  const kanban = useMemo(() => {
    const active = tasks.filter((t) => t.status === "active");
    return {
      today: active.filter((t) => t.view === "today"),
      week: active.filter((t) => t.view === "week"),
      month: active.filter((t) => t.view === "month"),
    };
  }, [tasks]);

  const categoryCounts = useMemo(
    () =>
      CATEGORY_KEYS.map((key) => ({
        key,
        n: tasks.filter((t) => t.category === key && t.status === "active").length,
      })),
    [tasks]
  );

  const habitGroups = useMemo(() => {
    const parents = habits.filter((h) => h.parent_id === null);
    return parents.map((p) => ({
      group: p,
      items: habits.filter((h) => h.parent_id === p.id),
    }));
  }, [habits]);

  const habitItems = habits.filter((h) => h.parent_id !== null);
  const habitPct = habitItems.length
    ? Math.round((habitItems.filter((h) => h.completed).length / habitItems.length) * 100)
    : 0;

  const consumedCal = meals.reduce((s, m) => s + (m.calories ?? 0), 0);
  const consumedProtein = meals.reduce((s, m) => s + (m.protein ?? 0), 0);
  const kcalLeft = Math.max(PROTEIN_TARGET_KCAL - consumedCal, 0);

  const financeValue = useCallback(
    (aliases: string[]): number | null => {
      const row = finance.find((f) => aliases.includes(f.label.trim().toLowerCase()));
      return row ? Number(row.amount ?? 0) : null;
    },
    [finance]
  );

  const netWorth = financeValue(FINANCE_LOOKUP.netWorth);
  const monthGain = financeValue(FINANCE_LOOKUP.month);
  const dayGain = financeValue(FINANCE_LOOKUP.day);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  const money = (n: number | null) =>
    n === null ? "—" : "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });

  if (!authed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink text-muted">Loading…</div>
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
                <span className="text-acidDim">Month +{money(monthGain)}</span>
                <span className="text-acidDim">Today +{money(dayGain)}</span>
              </div>
            </div>
            {finance.length === 0 && (
              <p className="mt-2 text-[11px] text-muted">
                No finance rows yet — add rows labelled “net worth”, “month”, “today”.
              </p>
            )}
          </section>

          {/* Key Tasks — LIVE */}
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
            {habitGroups.length === 0 ? (
              <div className="space-y-2 text-[12px] text-muted">
                <p>No habits logged for today yet.</p>
                <button onClick={seedHabits} className="chip hover:text-acid">
                  Set up today’s habits
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {habitGroups.map(({ group, items }) => {
                  const n = items.filter((i) => i.completed).length;
                  return (
                    <div key={group.id}>
                      <div className="mb-1 flex justify-between text-[11px] text-muted">
                        <span className="uppercase tracking-wider">{group.name}</span>
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
                      <div
                        key={t.id}
                        className="rounded border border-line bg-panel p-2 text-[12px] text-ghost"
                      >
                        {t.content}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Brain — LIVE (active task counts per category) */}
          <section className="panel">
            <PanelTitle>Brain · Life Categories</PanelTitle>
            <div className="grid grid-cols-2 gap-2">
              {categoryCounts.map((c) => (
                <div
                  key={c.key}
                  className={`rounded border bg-panel2 p-3 ${
                    c.n > 0 ? "border-acid/40" : "border-line"
                  }`}
                >
                  <div
                    className={`text-[12px] uppercase tracking-wider ${
                      c.n > 0 ? "text-acid" : "text-ghost"
                    }`}
                  >
                    {c.key}
                  </div>
                  <div className="mt-1 text-[11px] text-muted">{c.n} open</div>
                </div>
              ))}
            </div>
          </section>

          {/* Journal — LIVE (latest entry) */}
          <section className="panel">
            <PanelTitle>Journal</PanelTitle>
            <button className="mb-3 flex w-full items-center justify-center gap-2 rounded border border-acid/40 bg-acid/5 py-2 text-[12px] text-acid hover:bg-acid/10">
              <span className="h-2 w-2 rounded-full bg-acid" />
              Hold to voice-note your day
            </button>
            {journal ? (
              <div className="text-[11px] text-muted">
                <div className="mb-1 uppercase tracking-wider">
                  {new Date(journal.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </div>
                {journal.ai_summary || journal.raw_transcript || "—"}
              </div>
            ) : (
              <p className="text-[11px] text-muted">No journal entries yet.</p>
            )}
          </section>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-3 lg:col-span-4">
          {/* Calendar — still mock (no table in schema) */}
          <section className="panel">
            <PanelTitle right={<span className="text-[10px] text-muted">mock</span>}>
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

          {/* Goals — LIVE */}
          <section className="panel">
            <PanelTitle>Goals · This Month</PanelTitle>
            {goals.length === 0 && (
              <p className="mb-2 text-[12px] text-muted">No goals yet — add one below.</p>
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

          {/* Nutrition — LIVE */}
          <section className="panel">
            <PanelTitle>Nutrition</PanelTitle>
            {meals.length === 0 && (
              <p className="mb-2 text-[12px] text-muted">Nothing logged today.</p>
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
            <form onSubmit={addMeal} className="mt-2 flex gap-2">
              <input
                value={newMeal.meal}
                onChange={(e) => setNewMeal((s) => ({ ...s, meal: e.target.value }))}
                placeholder="meal"
                className="flex-1 rounded border border-line bg-panel2 px-2 py-1 text-[12px] text-ghost outline-none placeholder:text-muted focus:border-acid/50"
              />
              <input
                value={newMeal.calories}
                onChange={(e) => setNewMeal((s) => ({ ...s, calories: e.target.value }))}
                placeholder="kcal"
                inputMode="numeric"
                className="w-14 rounded border border-line bg-panel2 px-2 py-1 text-[12px] text-ghost outline-none placeholder:text-muted focus:border-acid/50"
              />
              <input
                value={newMeal.protein}
                onChange={(e) => setNewMeal((s) => ({ ...s, protein: e.target.value }))}
                placeholder="p"
                inputMode="numeric"
                className="w-10 rounded border border-line bg-panel2 px-2 py-1 text-[12px] text-ghost outline-none placeholder:text-muted focus:border-acid/50"
              />
              <button className="chip hover:text-acid">Log</button>
            </form>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <Stat n={consumedCal} label="kcal" />
              <Stat n={consumedProtein} label="protein g" />
              <Stat n={kcalLeft} label="kcal left" />
            </div>
          </section>
        </div>
      </div>

      {/* ASK BAR — stub until Phase 3 (AI) */}
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
