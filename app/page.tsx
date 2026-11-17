"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  addGoal,
  addHabitGroup,
  addHabitItem,
  addMeal,
  addTask,
  completeTask,
  deleteGoal,
  ensureHabitsForToday,
  getFinance,
  getGoals,
  getHealthToday,
  getLatestJournal,
  getMealsToday,
  getTasks,
  toggleHabit,
  type FinanceRow,
  type GoalRow,
  type HabitRow,
  type HealthRow,
  type JournalRow,
  type NutritionRow,
  type TaskRow,
} from "@/lib/db";

/* ------------------------------------------------------------------ */
/*  STATIC / DECORATIVE DATA                                          */
/*  Everything a real table backs is now loaded live (see lib/db.ts). */
/*  What remains here is purely decorative (the finance sparkline) or */
/*  has no table in supabase/schema.sql yet (the calendar).           */
/* ------------------------------------------------------------------ */

// Decorative sparkline for the Finance panel — not data-bound.
const FINANCE_BARS = [
  8, 10, 7, 12, 9, 14, 11, 16, 13, 18, 15, 20, 17, 22, 19, 24, 21, 26, 23, 28,
];

// The calendar has no table in the schema yet — left as a placeholder.
const CALENDAR = [
  { time: "09:30", label: "Standup w/ team" },
  { time: "11:30", label: "Investor call — fund II" },
  { time: "14:00", label: "Record finance video" },
  { time: "16:30", label: "1:1 with editor" },
];

// Fixed category keys; counts/notes are derived from live task rows.
const CATEGORY_KEYS = [
  "legal",
  "finance",
  "content",
  "products",
  "opsec",
  "business",
] as const;

const DEFAULT_CAL_TARGET = 2040;

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
  const [finance, setFinance] = useState<FinanceRow[]>([]);
  const [meals, setMeals] = useState<NutritionRow[]>([]);
  const [health, setHealth] = useState<HealthRow | null>(null);
  const [journal, setJournal] = useState<JournalRow | null>(null);

  // Input state
  const [newTask, setNewTask] = useState("");
  const [newGoal, setNewGoal] = useState("");
  const [newGroup, setNewGroup] = useState("");
  const [habitDraft, setHabitDraft] = useState<Record<string, string>>({});
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
    const [t, h, g, f, m, hl, j] = await Promise.all([
      getTasks(),
      ensureHabitsForToday(),
      getGoals("month"),
      getFinance(),
      getMealsToday(),
      getHealthToday(),
      getLatestJournal(),
    ]);
    setTasks(t);
    setHabits(h);
    setGoals(g);
    setFinance(f);
    setMeals(m);
    setHealth(hl);
    setJournal(j);
  }

  /* ----------------------------- tasks ----------------------------- */

  async function onAddTask(e: React.FormEvent) {
    e.preventDefault();
    const content = newTask.trim();
    if (!content) return;
    setNewTask("");
    await addTask(content, { starred: true, view: "today" });
    setTasks(await getTasks());
  }

  async function onCompleteTask(id: string) {
    await completeTask(id);
    setTasks(await getTasks());
  }

  /* ----------------------------- habits ---------------------------- */

  async function onToggleHabit(h: HabitRow) {
    // optimistic
    setHabits((rows) =>
      rows.map((r) => (r.id === h.id ? { ...r, completed: !r.completed } : r))
    );
    await toggleHabit(h.id, !h.completed);
  }

  async function onAddHabitItem(parentId: string) {
    const name = (habitDraft[parentId] ?? "").trim();
    if (!name) return;
    setHabitDraft((d) => ({ ...d, [parentId]: "" }));
    await addHabitItem(parentId, name);
    setHabits(await ensureHabitsForToday());
  }

  async function onAddGroup(e: React.FormEvent) {
    e.preventDefault();
    const name = newGroup.trim();
    if (!name) return;
    setNewGroup("");
    await addHabitGroup(name);
    setHabits(await ensureHabitsForToday());
  }

  /* ------------------------------ goals ---------------------------- */

  async function onAddGoal(e: React.FormEvent) {
    e.preventDefault();
    const content = newGoal.trim();
    if (!content) return;
    setNewGoal("");
    await addGoal(content, "month");
    setGoals(await getGoals("month"));
  }

  async function onDeleteGoal(id: string) {
    await deleteGoal(id);
    setGoals(await getGoals("month"));
  }

  /* ---------------------------- nutrition -------------------------- */

  async function onLogMeal() {
    const meal = window.prompt("Meal description?");
    if (!meal || !meal.trim()) return;
    const kcal = Number(window.prompt("Calories? (kcal)", "0")) || 0;
    const protein = Number(window.prompt("Protein? (g)", "0")) || 0;
    await addMeal(meal.trim(), kcal, protein);
    setMeals(await getMealsToday());
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  /* --------------------------- derived data ------------------------ */

  const keyTasks = tasks.filter((t) => t.starred && t.status === "active");

  const kanban = useMemo(() => {
    const active = tasks.filter((t) => t.status === "active");
    return {
      today: active.filter((t) => t.view === "today"),
      week: active.filter((t) => t.view === "week"),
      month: active.filter((t) => t.view === "month"),
    };
  }, [tasks]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of tasks) {
      if (t.status !== "active" || !t.category) continue;
      counts[t.category] = (counts[t.category] ?? 0) + 1;
    }
    return counts;
  }, [tasks]);

  const habitGroups = useMemo(() => {
    const parents = habits
      .filter((h) => h.parent_id === null)
      .sort((a, b) => a.name.localeCompare(b.name));
    return parents.map((p) => ({
      group: p,
      items: habits.filter((h) => h.parent_id === p.id),
    }));
  }, [habits]);

  const leafHabits = habits.filter((h) => h.parent_id !== null);
  const habitPct =
    leafHabits.length === 0
      ? 0
      : Math.round(
          (leafHabits.filter((h) => h.completed).length / leafHabits.length) * 100
        );

  const financeBy = (needle: string) =>
    finance.find((f) => f.label.toLowerCase().includes(needle))?.amount ?? 0;
  const netWorth = financeBy("net");
  const monthGain = financeBy("month");
  const dayGain = financeBy("day");

  const consumedCals = meals.reduce((s, m) => s + (m.calories ?? 0), 0);
  const consumedProtein = meals.reduce((s, m) => s + (m.protein ?? 0), 0);
  const calTarget = health?.total_calories ?? DEFAULT_CAL_TARGET;
  const calsLeft = Math.max(calTarget - consumedCals, 0);

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
                <span className="text-acidDim">Month +{money(monthGain)}</span>
                <span className="text-acidDim">Today +{money(dayGain)}</span>
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
                onChange={() => onCompleteTask(t.id)}
                label={t.content}
                meta={t.category ?? undefined}
              />
            ))}
            <form onSubmit={onAddTask} className="mt-2 flex gap-2">
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
                        onChange={() => onToggleHabit(item)}
                        label={item.name}
                      />
                    ))}
                    <input
                      value={habitDraft[group.id] ?? ""}
                      onChange={(e) =>
                        setHabitDraft((d) => ({ ...d, [group.id]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          onAddHabitItem(group.id);
                        }
                      }}
                      placeholder={`+ add to ${group.name}`}
                      className="mt-1 w-full rounded border border-line bg-panel2 px-2 py-1 text-[11px] text-ghost outline-none placeholder:text-muted focus:border-acid/50"
                    />
                  </div>
                );
              })}
            </div>
            <form onSubmit={onAddGroup} className="mt-3 flex gap-2">
              <input
                value={newGroup}
                onChange={(e) => setNewGroup(e.target.value)}
                placeholder="+ new habit group"
                className="flex-1 rounded border border-line bg-panel2 px-2 py-1 text-[11px] text-ghost outline-none placeholder:text-muted focus:border-acid/50"
              />
              <button className="chip hover:text-acid">Add</button>
            </form>
          </section>
        </div>

        {/* CENTER COLUMN */}
        <div className="space-y-3 lg:col-span-5">
          {/* Kanban — LIVE from Supabase (tasks grouped by view) */}
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
                    {kanban[col].map((c) => (
                      <div key={c.id} className="rounded border border-line bg-panel p-2 text-[12px] text-ghost">
                        {c.content}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Brain — life categories (counts derived from live tasks) */}
          <section className="panel">
            <PanelTitle>Brain · Life Categories</PanelTitle>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORY_KEYS.map((key) => {
                const count = categoryCounts[key] ?? 0;
                const warn = key === "opsec" && count === 0;
                return (
                  <div
                    key={key}
                    className={`rounded border bg-panel2 p-3 ${
                      warn ? "border-acid/40" : "border-line"
                    }`}
                  >
                    <div className={`text-[12px] uppercase tracking-wider ${warn ? "text-acid" : "text-ghost"}`}>
                      {key}
                    </div>
                    <div className="mt-1 text-[11px] text-muted">
                      {count} {count === 1 ? "task" : "tasks"}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Journal — LIVE from Supabase (latest entry) */}
          <section className="panel">
            <PanelTitle>Journal</PanelTitle>
            <button className="mb-3 flex w-full items-center justify-center gap-2 rounded border border-acid/40 bg-acid/5 py-2 text-[12px] text-acid hover:bg-acid/10">
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
                  Record your first voice note — AI summaries arrive in Phase 3.
                </>
              )}
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-3 lg:col-span-4">
          {/* Calendar — no table in schema yet (placeholder) */}
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
                    onClick={() => onDeleteGoal(g.id)}
                    className="text-[11px] text-muted opacity-0 transition hover:text-acid group-hover:opacity-100"
                    aria-label="Delete goal"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ol>
            <form onSubmit={onAddGoal} className="mt-3 flex gap-2">
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
            <PanelTitle right={<button onClick={onLogMeal} className="chip hover:text-acid">+ Log</button>}>
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
              <Stat n={consumedCals} label="kcal" />
              <Stat n={consumedProtein} label="protein g" />
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
