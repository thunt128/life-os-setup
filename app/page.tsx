"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

/* ------------------------------------------------------------------ */
/*  ROW TYPES — these mirror supabase/schema.sql exactly.             */
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
};

/* ------------------------------------------------------------------ */
/*  STATIC DATA                                                        */
/*  These panels have no table in schema.sql yet, so they stay as     */
/*  presentational placeholders until a later phase adds a table.     */
/* ------------------------------------------------------------------ */

const FINANCE_BARS = [
  8, 10, 7, 12, 9, 14, 11, 16, 13, 18, 15, 20, 17, 22, 19, 24, 21, 26, 23, 28,
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

const KCAL_TARGET = 2040;

/* ------------------------------------------------------------------ */
/*  HELPERS                                                            */
/* ------------------------------------------------------------------ */

// Local calendar date as YYYY-MM-DD (not UTC — matches the schema's
// `date default current_date` on the user's machine well enough for a
// single-user app).
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

const money = (n: number) =>
  "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });

/* ------------------------------------------------------------------ */
/*  SMALL UI HELPERS                                                   */
/* ------------------------------------------------------------------ */

function PanelTitle({
  children,
  right,
}: {
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
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

  // Form inputs
  const [newTask, setNewTask] = useState("");
  const [kanbanInput, setKanbanInput] = useState<Record<string, string>>({});
  const [newGoal, setNewGoal] = useState("");
  const [logOpen, setLogOpen] = useState(false);
  const [meal, setMeal] = useState({ meal: "", calories: "", protein: "" });
  const [addingGroup, setAddingGroup] = useState(false);
  const [newGroup, setNewGroup] = useState("");
  const [habitInput, setHabitInput] = useState<Record<string, string>>({});

  const [revealMoney, setRevealMoney] = useState(false);
  const [ask, setAsk] = useState("");

  /* -------------------------------- loaders -------------------------------- */

  const loadTasks = useCallback(async () => {
    const { data } = await supabase
      .from("tasks")
      .select("*")
      .neq("status", "archived")
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

  const loadGoals = useCallback(async () => {
    const { data } = await supabase
      .from("goals")
      .select("*")
      .eq("period", "month")
      .order("created_at", { ascending: true });
    if (data) setGoals(data as GoalRow[]);
  }, []);

  const loadMeals = useCallback(async () => {
    const start = todayISO();
    const { data } = await supabase
      .from("nutrition")
      .select("*")
      .gte("eaten_at", `${start}T00:00:00`)
      .lte("eaten_at", `${start}T23:59:59`)
      .order("eaten_at", { ascending: true });
    if (data) setMeals(data as NutritionRow[]);
  }, []);

  const loadFinance = useCallback(async () => {
    const { data } = await supabase
      .from("finance")
      .select("*")
      .order("as_of", { ascending: false });
    if (data) setFinance(data as FinanceRow[]);
  }, []);

  const loadJournal = useCallback(async () => {
    const { data } = await supabase
      .from("journal")
      .select("*")
      .order("date", { ascending: false })
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

  /* -------------------------------- tasks -------------------------------- */

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    const content = newTask.trim();
    if (!content) return;
    setNewTask("");
    await supabase.from("tasks").insert({ content, starred: true, view: "today" });
    loadTasks();
  }

  async function addKanbanTask(view: TaskRow["view"]) {
    const content = (kanbanInput[view] ?? "").trim();
    if (!content) return;
    setKanbanInput((s) => ({ ...s, [view]: "" }));
    await supabase.from("tasks").insert({ content, view });
    loadTasks();
  }

  async function completeTask(id: string) {
    await supabase.from("tasks").update({ status: "done" }).eq("id", id);
    loadTasks();
  }

  /* -------------------------------- habits -------------------------------- */

  async function toggleHabit(h: HabitRow) {
    await supabase
      .from("habits")
      .update({ completed: !h.completed })
      .eq("id", h.id);
    loadHabits();
  }

  async function addGroup(e: React.FormEvent) {
    e.preventDefault();
    const name = newGroup.trim();
    if (!name) return;
    setNewGroup("");
    setAddingGroup(false);
    await supabase
      .from("habits")
      .insert({ name, parent_id: null, date: todayISO(), completed: false });
    loadHabits();
  }

  async function addHabit(groupId: string) {
    const name = (habitInput[groupId] ?? "").trim();
    if (!name) return;
    setHabitInput((s) => ({ ...s, [groupId]: "" }));
    await supabase
      .from("habits")
      .insert({ name, parent_id: groupId, date: todayISO(), completed: false });
    loadHabits();
  }

  /* -------------------------------- goals -------------------------------- */

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

  /* -------------------------------- nutrition -------------------------------- */

  async function logMeal(e: React.FormEvent) {
    e.preventDefault();
    const name = meal.meal.trim();
    if (!name) return;
    await supabase.from("nutrition").insert({
      meal: name,
      calories: meal.calories ? Number(meal.calories) : null,
      protein: meal.protein ? Number(meal.protein) : null,
    });
    setMeal({ meal: "", calories: "", protein: "" });
    setLogOpen(false);
    loadMeals();
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  /* -------------------------------- derived -------------------------------- */

  const keyTasks = useMemo(
    () => tasks.filter((t) => t.starred && t.status === "active"),
    [tasks]
  );

  const kanban = useMemo(() => {
    const active = tasks.filter((t) => t.status === "active");
    return {
      today: active.filter((t) => t.view === "today"),
      week: active.filter((t) => t.view === "week"),
      month: active.filter((t) => t.view === "month"),
    };
  }, [tasks]);

  // Habits: parent rows (parent_id null) are groups; the rest are items.
  const habitGroups = useMemo(() => {
    const groups = habits.filter((h) => h.parent_id === null);
    return groups.map((g) => ({
      group: g,
      items: habits.filter((h) => h.parent_id === g.id),
    }));
  }, [habits]);

  const leafHabits = useMemo(
    () => habits.filter((h) => h.parent_id !== null),
    [habits]
  );
  const habitPct = leafHabits.length
    ? Math.round(
        (leafHabits.filter((h) => h.completed).length / leafHabits.length) * 100
      )
    : 0;

  const financeBy = useMemo(() => {
    const map: Record<string, number> = {};
    // Latest row per label wins (finance is ordered by as_of desc).
    for (const row of finance) {
      if (!(row.label in map)) map[row.label] = row.amount ?? 0;
    }
    return map;
  }, [finance]);
  const netWorth = financeBy["net_worth"] ?? 0;
  const monthChange = financeBy["month"] ?? 0;
  const dayChange = financeBy["day"] ?? 0;
  const hasFinance = finance.length > 0;

  const consumedCals = meals.reduce((s, m) => s + (m.calories ?? 0), 0);
  const consumedProtein = meals.reduce((s, m) => s + (m.protein ?? 0), 0);
  const kcalLeft = Math.max(KCAL_TARGET - consumedCals, 0);

  const today = new Date().toLocaleDateString("en-US", {
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
          <span className="panel-title">
            {today} ·{" "}
            {new Date().toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
            })}
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
          {/* Finance Pulse — LIVE from finance table */}
          <section className="panel">
            <PanelTitle
              right={
                <button
                  onClick={() => setRevealMoney((v) => !v)}
                  className="chip hover:text-acid"
                >
                  {revealMoney ? "Hide" : "Reveal"}
                </button>
              }
            >
              Finance Pulse
            </PanelTitle>
            {!hasFinance && (
              <p className="mb-2 text-[12px] text-muted">
                No finance rows yet. Add rows to the{" "}
                <code className="text-acidDim">finance</code> table with labels{" "}
                <code className="text-acidDim">net_worth</code>,{" "}
                <code className="text-acidDim">month</code>,{" "}
                <code className="text-acidDim">day</code>.
              </p>
            )}
            <div className={revealMoney ? "" : "select-none blur-md"}>
              <div className="text-3xl font-semibold text-acid">
                {money(netWorth)}
              </div>
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

          {/* Key Tasks — LIVE from tasks table */}
          <section className="panel">
            <PanelTitle right={<span className="text-[10px] text-acidDim">live</span>}>
              Key Tasks · Today
            </PanelTitle>
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

          {/* Daily Habits — LIVE from habits table */}
          <section className="panel">
            <PanelTitle right={<span className="text-[11px] text-acid">{habitPct}%</span>}>
              Daily Habits
            </PanelTitle>
            <div className="mb-3 h-1 w-full overflow-hidden rounded bg-line">
              <div
                className="h-full bg-acid transition-all"
                style={{ width: `${habitPct}%` }}
              />
            </div>
            <div className="space-y-3">
              {habitGroups.length === 0 && (
                <p className="text-[12px] text-muted">
                  No habits for today yet — add a group to start.
                </p>
              )}
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
                    <input
                      value={habitInput[group.id] ?? ""}
                      onChange={(e) =>
                        setHabitInput((s) => ({ ...s, [group.id]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addHabit(group.id);
                        }
                      }}
                      placeholder="+ add habit"
                      className="mt-1 w-full rounded border border-line bg-panel2 px-2 py-1 text-[11px] text-ghost outline-none placeholder:text-muted focus:border-acid/50"
                    />
                  </div>
                );
              })}
            </div>
            {addingGroup ? (
              <form onSubmit={addGroup} className="mt-3 flex gap-2">
                <input
                  autoFocus
                  value={newGroup}
                  onChange={(e) => setNewGroup(e.target.value)}
                  placeholder="group name"
                  className="flex-1 rounded border border-line bg-panel2 px-2 py-1 text-[12px] text-ghost outline-none placeholder:text-muted focus:border-acid/50"
                />
                <button className="chip hover:text-acid">Add</button>
              </form>
            ) : (
              <button
                onClick={() => setAddingGroup(true)}
                className="mt-3 chip hover:text-acid"
              >
                + group
              </button>
            )}
          </section>
        </div>

        {/* CENTER COLUMN */}
        <div className="space-y-3 lg:col-span-5">
          {/* Kanban — LIVE from tasks table (grouped by view) */}
          <section className="panel">
            <PanelTitle>CRM · Kanban</PanelTitle>
            <div className="grid grid-cols-3 gap-2">
              {(["today", "week", "month"] as const).map((col) => (
                <div key={col} className="rounded border border-line bg-panel2 p-2">
                  <div className="mb-2 text-[10px] uppercase tracking-wider text-muted">
                    {col === "today" ? "Today" : col === "week" ? "This week" : "This month"}
                  </div>
                  <div className="space-y-2">
                    {kanban[col].map((c) => (
                      <button
                        key={c.id}
                        onClick={() => completeTask(c.id)}
                        title="Click to mark done"
                        className="block w-full rounded border border-line bg-panel p-2 text-left text-[12px] text-ghost hover:border-acid/40 hover:text-acid"
                      >
                        {c.content}
                      </button>
                    ))}
                  </div>
                  <input
                    value={kanbanInput[col] ?? ""}
                    onChange={(e) =>
                      setKanbanInput((s) => ({ ...s, [col]: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addKanbanTask(col);
                      }
                    }}
                    placeholder="+ add"
                    className="mt-2 w-full rounded border border-line bg-panel px-2 py-1 text-[11px] text-ghost outline-none placeholder:text-muted focus:border-acid/50"
                  />
                </div>
              ))}
            </div>
          </section>

          {/* Brain — life categories (static: no table yet) */}
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
                  <div
                    className={`text-[12px] uppercase tracking-wider ${
                      c.warn ? "text-acid" : "text-ghost"
                    }`}
                  >
                    {c.key}
                  </div>
                  <div className="mt-1 text-[11px] text-muted">{c.note}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Journal — LIVE (latest entry); capture arrives in Phase 4 */}
          <section className="panel">
            <PanelTitle>Journal</PanelTitle>
            <button
              className="mb-3 flex w-full items-center justify-center gap-2 rounded border border-acid/40 bg-acid/5 py-2 text-[12px] text-acid hover:bg-acid/10"
              title="Voice capture arrives in Phase 4"
            >
              <span className="h-2 w-2 rounded-full bg-acid" />
              Hold to voice-note your day
            </button>
            <div className="text-[11px] text-muted">
              <div className="mb-1 uppercase tracking-wider">
                {journal ? journal.date : "No entries yet"}
              </div>
              {journal
                ? journal.ai_summary ||
                  journal.raw_transcript ||
                  "Entry saved (no text)."
                : "Your latest journal entry will show here once you capture one."}
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-3 lg:col-span-4">
          {/* Calendar (static: no table yet) */}
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

          {/* Goals — LIVE from goals table */}
          <section className="panel">
            <PanelTitle>Goals · This Month</PanelTitle>
            {goals.length === 0 && (
              <p className="mb-2 text-[12px] text-muted">
                No goals yet — add one below.
              </p>
            )}
            <ol className="space-y-1.5">
              {goals.map((g, i) => (
                <li
                  key={g.id}
                  className="group flex items-center gap-2 text-[13px] text-ghost"
                >
                  <span className="text-acidDim">{i + 1}</span>
                  <span className="flex-1">{g.content}</span>
                  <button
                    onClick={() => removeGoal(g.id)}
                    className="text-[11px] text-muted opacity-0 transition group-hover:opacity-100 hover:text-acid"
                    title="Remove goal"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ol>
            <form onSubmit={addGoal} className="mt-2 flex gap-2">
              <input
                value={newGoal}
                onChange={(e) => setNewGoal(e.target.value)}
                placeholder="+ add a goal"
                className="flex-1 rounded border border-line bg-panel2 px-2 py-1 text-[12px] text-ghost outline-none placeholder:text-muted focus:border-acid/50"
              />
              <button className="chip hover:text-acid">Add</button>
            </form>
          </section>

          {/* Nutrition — LIVE from nutrition table */}
          <section className="panel">
            <PanelTitle
              right={
                <button
                  onClick={() => setLogOpen((v) => !v)}
                  className="chip hover:text-acid"
                >
                  {logOpen ? "Close" : "+ Log"}
                </button>
              }
            >
              Nutrition
            </PanelTitle>

            {logOpen && (
              <form onSubmit={logMeal} className="mb-3 space-y-2">
                <input
                  value={meal.meal}
                  onChange={(e) => setMeal((m) => ({ ...m, meal: e.target.value }))}
                  placeholder="meal"
                  className="w-full rounded border border-line bg-panel2 px-2 py-1 text-[12px] text-ghost outline-none placeholder:text-muted focus:border-acid/50"
                />
                <div className="flex gap-2">
                  <input
                    value={meal.calories}
                    onChange={(e) =>
                      setMeal((m) => ({ ...m, calories: e.target.value }))
                    }
                    inputMode="numeric"
                    placeholder="kcal"
                    className="w-1/2 rounded border border-line bg-panel2 px-2 py-1 text-[12px] text-ghost outline-none placeholder:text-muted focus:border-acid/50"
                  />
                  <input
                    value={meal.protein}
                    onChange={(e) =>
                      setMeal((m) => ({ ...m, protein: e.target.value }))
                    }
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

            <div className="space-y-1">
              {meals.length === 0 && (
                <p className="text-[12px] text-muted">Nothing logged today.</p>
              )}
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
              <Stat n={consumedCals} label="kcal" />
              <Stat n={consumedProtein} label="protein g" />
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
