"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  addGoal,
  addTask,
  completeTask,
  getFinance,
  getGoals,
  getHabitGroupsForToday,
  getLatestJournal,
  getMealsToday,
  getTasks,
  logMeal,
  setHabitCompleted,
  type FinanceRow,
  type GoalRow,
  type HabitGroup,
  type JournalRow,
  type NutritionRow,
  type TaskRow,
} from "@/lib/data";

/* ------------------------------------------------------------------ */
/*  STATIC CONFIG                                                      */
/*  Panels without a backing table in schema.sql stay configured in   */
/*  code (Calendar, the finance sparkline, the daily calorie target). */
/* ------------------------------------------------------------------ */

const FINANCE_BARS = [
  8, 10, 7, 12, 9, 14, 11, 16, 13, 18, 15, 20, 17, 22, 19, 24, 21, 26, 23, 28,
];

// Fixed life-category keys. Live counts are derived from task rows below.
const CATEGORY_KEYS = [
  "legal",
  "finance",
  "content",
  "products",
  "opsec",
  "business",
] as const;

const CALENDAR = [
  { time: "09:30", label: "Standup w/ team" },
  { time: "11:30", label: "Investor call — fund II" },
  { time: "14:00", label: "Record finance video" },
  { time: "16:30", label: "1:1 with editor" },
];

const DAILY_CAL_TARGET = 2040;

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

  // live data
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [habitGroups, setHabitGroups] = useState<HabitGroup[]>([]);
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [meals, setMeals] = useState<NutritionRow[]>([]);
  const [finance, setFinance] = useState<FinanceRow[]>([]);
  const [journal, setJournal] = useState<JournalRow | null>(null);

  // form inputs
  const [newTask, setNewTask] = useState("");
  const [kanbanInput, setKanbanInput] = useState<Record<string, string>>({});
  const [newGoal, setNewGoal] = useState("");
  const [meal, setMeal] = useState({ name: "", calories: "", protein: "" });
  const [logging, setLogging] = useState(false);

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
    const [t, h, g, m, f, j] = await Promise.all([
      getTasks(),
      getHabitGroupsForToday(),
      getGoals("month"),
      getMealsToday(),
      getFinance(),
      getLatestJournal(),
    ]);
    setTasks(t);
    setHabitGroups(h);
    setGoals(g);
    setMeals(m);
    setFinance(f);
    setJournal(j);
  }

  /* --------------------------- TASKS ------------------------------ */

  async function addKeyTask(e: React.FormEvent) {
    e.preventDefault();
    const content = newTask.trim();
    if (!content) return;
    setNewTask("");
    await addTask({ content, view: "today", starred: true });
    setTasks(await getTasks());
  }

  async function addKanbanTask(view: TaskRow["view"]) {
    const content = (kanbanInput[view] ?? "").trim();
    if (!content) return;
    setKanbanInput((s) => ({ ...s, [view]: "" }));
    await addTask({ content, view });
    setTasks(await getTasks());
  }

  async function finishTask(id: string) {
    await completeTask(id);
    setTasks(await getTasks());
  }

  const keyTasks = tasks.filter((t) => t.starred && t.status === "active");

  const kanban = useMemo(() => {
    const active = tasks.filter((t) => t.status === "active");
    return {
      today: active.filter((t) => t.view === "today"),
      week: active.filter((t) => t.view === "week"),
      month: active.filter((t) => t.view === "month"),
    };
  }, [tasks]);

  // Derive live counts for the Brain / life-category tiles from task rows.
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of tasks) {
      if (t.status !== "active" || !t.category) continue;
      counts[t.category] = (counts[t.category] ?? 0) + 1;
    }
    return counts;
  }, [tasks]);

  /* --------------------------- HABITS ----------------------------- */

  async function toggleHabit(id: string, current: boolean) {
    // optimistic update, then persist
    setHabitGroups((groups) =>
      groups.map((g) => ({
        ...g,
        items: g.items.map((i) =>
          i.id === id ? { ...i, completed: !current } : i
        ),
      }))
    );
    await setHabitCompleted(id, !current);
  }

  const allHabitItems = habitGroups.flatMap((g) => g.items);
  const habitPct =
    allHabitItems.length === 0
      ? 0
      : Math.round(
          (allHabitItems.filter((i) => i.completed).length /
            allHabitItems.length) *
            100
        );

  /* ---------------------------- GOALS ----------------------------- */

  async function submitGoal(e: React.FormEvent) {
    e.preventDefault();
    const content = newGoal.trim();
    if (!content) return;
    setNewGoal("");
    await addGoal(content, "month");
    setGoals(await getGoals("month"));
  }

  /* -------------------------- NUTRITION --------------------------- */

  async function submitMeal(e: React.FormEvent) {
    e.preventDefault();
    const name = meal.name.trim();
    if (!name) return;
    setLogging(true);
    await logMeal({
      meal: name,
      calories: meal.calories ? parseInt(meal.calories, 10) : null,
      protein: meal.protein ? parseInt(meal.protein, 10) : null,
    });
    setMeal({ name: "", calories: "", protein: "" });
    setMeals(await getMealsToday());
    setLogging(false);
  }

  const totals = useMemo(() => {
    const calories = meals.reduce((s, m) => s + (m.calories ?? 0), 0);
    const protein = meals.reduce((s, m) => s + (m.protein ?? 0), 0);
    return { calories, protein, left: Math.max(DAILY_CAL_TARGET - calories, 0) };
  }, [meals]);

  /* --------------------------- FINANCE ---------------------------- */

  const financeFor = (re: RegExp) =>
    finance.find((r) => re.test(r.label))?.amount ?? null;

  const netWorth = financeFor(/net|worth/i);
  const monthDelta = financeFor(/month/i);
  const dayDelta = financeFor(/day|today/i);

  /* ----------------------------------------------------------------- */

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  const money = (n: number | null) =>
    n == null
      ? "—"
      : "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });

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
            <div className={revealMoney ? "" : "select-none blur-md"}>
              <div className="text-3xl font-semibold text-acid">{money(netWorth)}</div>
              <div className="mt-1 flex gap-4 text-[12px]">
                <span className="text-acidDim">Month {monthDelta != null ? "+" : ""}{money(monthDelta)}</span>
                <span className="text-acidDim">Today {dayDelta != null ? "+" : ""}{money(dayDelta)}</span>
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
                onChange={() => finishTask(t.id)}
                label={t.content}
                meta={t.category ?? undefined}
              />
            ))}
            <form onSubmit={addKeyTask} className="mt-2 flex gap-2">
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
                  <div key={g.parent.id}>
                    <div className="mb-1 flex justify-between text-[11px] text-muted">
                      <span className="uppercase tracking-wider">{g.parent.name}</span>
                      <span>{n}/{g.items.length}</span>
                    </div>
                    {g.items.map((item) => (
                      <Check
                        key={item.id}
                        checked={item.completed}
                        onChange={() => toggleHabit(item.id, item.completed)}
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
          {/* Kanban — LIVE from Supabase (tasks grouped by view) */}
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
                    {kanban[col].map((c) => (
                      <button
                        key={c.id}
                        onClick={() => finishTask(c.id)}
                        title="Mark done"
                        className="block w-full rounded border border-line bg-panel p-2 text-left text-[12px] text-ghost hover:border-acid/40 hover:text-acid"
                      >
                        {c.content}
                      </button>
                    ))}
                    {kanban[col].length === 0 && (
                      <p className="text-[11px] text-muted">Nothing yet.</p>
                    )}
                  </div>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      addKanbanTask(col);
                    }}
                    className="mt-2"
                  >
                    <input
                      value={kanbanInput[col] ?? ""}
                      onChange={(e) =>
                        setKanbanInput((s) => ({ ...s, [col]: e.target.value }))
                      }
                      placeholder="+ add"
                      className="w-full rounded border border-line bg-panel px-2 py-1 text-[11px] text-ghost outline-none placeholder:text-muted focus:border-acid/50"
                    />
                  </form>
                </div>
              ))}
            </div>
          </section>

          {/* Brain — life categories (counts derived from task rows) */}
          <section className="panel">
            <PanelTitle>Brain · Life Categories</PanelTitle>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORY_KEYS.map((key) => {
                const count = categoryCounts[key] ?? 0;
                return (
                  <div
                    key={key}
                    className="rounded border border-line bg-panel2 p-3"
                  >
                    <div className="text-[12px] uppercase tracking-wider text-ghost">
                      {key}
                    </div>
                    <div className="mt-1 text-[11px] text-muted">
                      {count > 0 ? `${count} active` : "clear"}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Journal — LIVE latest entry (capture lands in Phase 4) */}
          <section className="panel">
            <PanelTitle>Journal</PanelTitle>
            <button
              onClick={() =>
                alert("Voice capture arrives in Phase 4 (Telegram + Whisper).")
              }
              className="mb-3 flex w-full items-center justify-center gap-2 rounded border border-acid/40 bg-acid/5 py-2 text-[12px] text-acid hover:bg-acid/10"
            >
              <span className="h-2 w-2 rounded-full bg-acid" />
              Hold to voice-note your day
            </button>
            <div className="text-[11px] text-muted">
              {journal ? (
                <>
                  <div className="mb-1 uppercase tracking-wider">{journal.date}</div>
                  {journal.ai_summary || journal.raw_transcript || "No notes yet."}
                </>
              ) : (
                <>
                  <div className="mb-1 uppercase tracking-wider">No entries yet</div>
                  Your most recent journal entry will show here.
                </>
              )}
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-3 lg:col-span-4">
          {/* Calendar — static for now (no table in schema.sql) */}
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
            <form onSubmit={submitGoal} className="mt-3 flex gap-2">
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
            <PanelTitle right={<span className="text-[10px] text-acidDim">live</span>}>
              Nutrition
            </PanelTitle>
            <div className="space-y-1">
              {meals.length === 0 && (
                <p className="text-[12px] text-muted">No meals logged today.</p>
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
            <form onSubmit={submitMeal} className="mt-3 space-y-2">
              <input
                value={meal.name}
                onChange={(e) => setMeal((s) => ({ ...s, name: e.target.value }))}
                placeholder="meal"
                className="w-full rounded border border-line bg-panel2 px-2 py-1 text-[12px] text-ghost outline-none placeholder:text-muted focus:border-acid/50"
              />
              <div className="flex gap-2">
                <input
                  value={meal.calories}
                  onChange={(e) => setMeal((s) => ({ ...s, calories: e.target.value.replace(/\D/g, "") }))}
                  inputMode="numeric"
                  placeholder="kcal"
                  className="w-full rounded border border-line bg-panel2 px-2 py-1 text-[12px] text-ghost outline-none placeholder:text-muted focus:border-acid/50"
                />
                <input
                  value={meal.protein}
                  onChange={(e) => setMeal((s) => ({ ...s, protein: e.target.value.replace(/\D/g, "") }))}
                  inputMode="numeric"
                  placeholder="protein g"
                  className="w-full rounded border border-line bg-panel2 px-2 py-1 text-[12px] text-ghost outline-none placeholder:text-muted focus:border-acid/50"
                />
                <button disabled={logging} className="chip hover:text-acid disabled:opacity-50">
                  {logging ? "…" : "+ Log"}
                </button>
              </div>
            </form>
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
