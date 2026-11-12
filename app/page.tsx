"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  addGoal,
  addHabitItem,
  addJournalNote,
  addMeal,
  addTask,
  completeTask,
  deleteGoal,
  loadFinance,
  loadGoals,
  loadHabitsForToday,
  loadLatestJournal,
  loadMealsToday,
  loadTasks,
  toggleHabit,
  type FinanceRow,
  type GoalRow,
  type HabitRow,
  type JournalRow,
  type MealRow,
  type TaskRow,
} from "@/lib/db";

/* ------------------------------------------------------------------ */
/*  CONSTANTS                                                          */
/* ------------------------------------------------------------------ */

// Daily calorie target used to compute "kcal left" from logged meals.
const DAILY_KCAL_TARGET = 2040;

// Life categories. These have no table of their own — the notes are
// derived live from the task rows filed under each category.
const CATEGORY_KEYS = ["legal", "finance", "content", "products", "opsec", "business"];

// Calendar has no table in the schema yet (planned for a later phase),
// so it stays as a static placeholder rather than fake "live" data.
const CALENDAR = [
  { time: "09:30", label: "Standup w/ team" },
  { time: "11:30", label: "Investor call — fund II" },
  { time: "14:00", label: "Record finance video" },
  { time: "16:30", label: "1:1 with editor" },
];

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

const money = (n: number) =>
  "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });

/* ------------------------------------------------------------------ */
/*  PAGE                                                               */
/* ------------------------------------------------------------------ */

export default function Dashboard() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [err, setErr] = useState("");

  // Live data
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [habits, setHabits] = useState<HabitRow[]>([]);
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [meals, setMeals] = useState<MealRow[]>([]);
  const [journal, setJournal] = useState<JournalRow | null>(null);
  const [finance, setFinance] = useState<FinanceRow[]>([]);

  // Input state
  const [newTask, setNewTask] = useState("");
  const [kanbanDraft, setKanbanDraft] = useState<Record<string, string>>({});
  const [habitGroupId, setHabitGroupId] = useState("");
  const [newHabit, setNewHabit] = useState("");
  const [newGoal, setNewGoal] = useState("");
  const [showMealForm, setShowMealForm] = useState(false);
  const [mealDraft, setMealDraft] = useState({ meal: "", calories: "", protein: "" });
  const [showJournalForm, setShowJournalForm] = useState(false);
  const [journalDraft, setJournalDraft] = useState("");
  const [revealMoney, setRevealMoney] = useState(false);
  const [ask, setAsk] = useState("");

  /* ---- Loaders ---- */

  const refreshTasks = useCallback(async () => setTasks(await loadTasks()), []);
  const refreshHabits = useCallback(async () => setHabits(await loadHabitsForToday()), []);
  const refreshGoals = useCallback(async () => setGoals(await loadGoals("month")), []);
  const refreshMeals = useCallback(async () => setMeals(await loadMealsToday()), []);
  const refreshJournal = useCallback(async () => setJournal(await loadLatestJournal()), []);
  const refreshFinance = useCallback(async () => setFinance(await loadFinance()), []);

  const loadAll = useCallback(async () => {
    try {
      await Promise.all([
        refreshTasks(),
        refreshHabits(),
        refreshGoals(),
        refreshMeals(),
        refreshJournal(),
        refreshFinance(),
      ]);
      setErr("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load data");
    }
  }, [refreshTasks, refreshHabits, refreshGoals, refreshMeals, refreshJournal, refreshFinance]);

  // Auth gate: redirect to /login if not signed in, otherwise load data.
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

  /* ---- Action wrapper (persists, then refreshes) ---- */
  async function run(fn: () => Promise<void>) {
    try {
      await fn();
      setErr("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong saving");
    }
  }

  /* ---- Derived values ---- */

  const activeTasks = useMemo(() => tasks.filter((t) => t.status === "active"), [tasks]);
  const keyTasks = useMemo(
    () => activeTasks.filter((t) => t.starred),
    [activeTasks]
  );

  const kanban = useMemo(
    () => ({
      today: activeTasks.filter((t) => t.view === "today"),
      week: activeTasks.filter((t) => t.view === "week"),
      month: activeTasks.filter((t) => t.view === "month"),
    }),
    [activeTasks]
  );

  const categories = useMemo(
    () =>
      CATEGORY_KEYS.map((key) => {
        const n = activeTasks.filter((t) => t.category === key).length;
        return { key, note: n ? `${n} open` : "clear" };
      }),
    [activeTasks]
  );

  const habitGroups = useMemo(() => {
    const parents = habits.filter((h) => !h.parent_id);
    return parents.map((g) => ({
      group: g,
      items: habits.filter((i) => i.parent_id === g.id),
    }));
  }, [habits]);

  const habitItems = useMemo(() => habits.filter((h) => h.parent_id), [habits]);
  const habitPct = habitItems.length
    ? Math.round((habitItems.filter((h) => h.completed).length / habitItems.length) * 100)
    : 0;

  const totalCalories = meals.reduce((s, m) => s + (m.calories ?? 0), 0);
  const totalProtein = meals.reduce((s, m) => s + (m.protein ?? 0), 0);
  const kcalLeft = Math.max(0, DAILY_KCAL_TARGET - totalCalories);

  const netWorth = finance.reduce((s, f) => s + (f.amount ?? 0), 0);
  const financeMax = Math.max(1, ...finance.map((f) => Math.abs(f.amount ?? 0)));

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  /* ---- Handlers ---- */

  async function onAddKeyTask(e: React.FormEvent) {
    e.preventDefault();
    const content = newTask.trim();
    if (!content) return;
    setNewTask("");
    await run(async () => {
      await addTask(content, { starred: true, view: "today" });
      await refreshTasks();
    });
  }

  async function onAddKanban(col: TaskRow["view"]) {
    const content = (kanbanDraft[col] ?? "").trim();
    if (!content) return;
    setKanbanDraft((d) => ({ ...d, [col]: "" }));
    await run(async () => {
      await addTask(content, { view: col });
      await refreshTasks();
    });
  }

  async function onCompleteTask(id: string) {
    await run(async () => {
      await completeTask(id);
      await refreshTasks();
    });
  }

  async function onToggleHabit(h: HabitRow) {
    await run(async () => {
      await toggleHabit(h.id, !h.completed);
      await refreshHabits();
    });
  }

  async function onAddHabit(e: React.FormEvent) {
    e.preventDefault();
    const name = newHabit.trim();
    const groupId = habitGroupId || habitGroups[0]?.group.id;
    if (!name || !groupId) return;
    setNewHabit("");
    await run(async () => {
      await addHabitItem(groupId, name);
      await refreshHabits();
    });
  }

  async function onAddGoal(e: React.FormEvent) {
    e.preventDefault();
    const content = newGoal.trim();
    if (!content) return;
    setNewGoal("");
    await run(async () => {
      await addGoal(content, "month");
      await refreshGoals();
    });
  }

  async function onDeleteGoal(id: string) {
    await run(async () => {
      await deleteGoal(id);
      await refreshGoals();
    });
  }

  async function onAddMeal(e: React.FormEvent) {
    e.preventDefault();
    const meal = mealDraft.meal.trim();
    if (!meal) return;
    const calories = mealDraft.calories ? parseInt(mealDraft.calories, 10) : null;
    const protein = mealDraft.protein ? parseInt(mealDraft.protein, 10) : null;
    setMealDraft({ meal: "", calories: "", protein: "" });
    setShowMealForm(false);
    await run(async () => {
      await addMeal(meal, calories, protein);
      await refreshMeals();
    });
  }

  async function onAddJournal(e: React.FormEvent) {
    e.preventDefault();
    const text = journalDraft.trim();
    if (!text) return;
    setJournalDraft("");
    setShowJournalForm(false);
    await run(async () => {
      await addJournalNote(text);
      await refreshJournal();
    });
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

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

      {err && (
        <div className="mb-3 rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-[12px] text-red-300">
          {err}
        </div>
      )}

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
            {finance.length === 0 ? (
              <p className="py-1 text-[12px] text-muted">
                No finance rows yet — add balances to the <code>finance</code> table.
              </p>
            ) : (
              <>
                <div className={revealMoney ? "" : "select-none blur-md"}>
                  <div className="text-3xl font-semibold text-acid">{money(netWorth)}</div>
                  <div className="mt-1 text-[12px] text-acidDim">Net across {finance.length} accounts</div>
                </div>
                <div className={`mt-3 space-y-1 ${revealMoney ? "" : "select-none blur-md"}`}>
                  {finance.slice(0, 6).map((f) => (
                    <div key={f.id} className="text-[11px]">
                      <div className="mb-0.5 flex justify-between">
                        <span className="text-ghost">{f.label}</span>
                        <span className="text-muted">{money(f.amount ?? 0)}</span>
                      </div>
                      <div className="h-1 w-full overflow-hidden rounded bg-line">
                        <div
                          className="h-full bg-acid/60"
                          style={{ width: `${(Math.abs(f.amount ?? 0) / financeMax) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>

          {/* Key Tasks — LIVE from tasks (starred + active) */}
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
            <form onSubmit={onAddKeyTask} className="mt-2 flex gap-2">
              <input
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                placeholder="+ add a key task"
                className="flex-1 rounded border border-line bg-panel2 px-2 py-1 text-[12px] text-ghost outline-none placeholder:text-muted focus:border-acid/50"
              />
              <button className="chip hover:text-acid">Add</button>
            </form>
          </section>

          {/* Daily Habits — LIVE from habits (today, grouped by parent) */}
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
                        onChange={() => onToggleHabit(item)}
                        label={item.name}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
            {habitGroups.length > 0 && (
              <form onSubmit={onAddHabit} className="mt-3 flex gap-2">
                <select
                  value={habitGroupId || habitGroups[0]?.group.id}
                  onChange={(e) => setHabitGroupId(e.target.value)}
                  className="rounded border border-line bg-panel2 px-1 py-1 text-[11px] text-ghost outline-none focus:border-acid/50"
                >
                  {habitGroups.map(({ group }) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
                <input
                  value={newHabit}
                  onChange={(e) => setNewHabit(e.target.value)}
                  placeholder="+ add habit"
                  className="flex-1 rounded border border-line bg-panel2 px-2 py-1 text-[12px] text-ghost outline-none placeholder:text-muted focus:border-acid/50"
                />
                <button className="chip hover:text-acid">Add</button>
              </form>
            )}
          </section>
        </div>

        {/* CENTER COLUMN */}
        <div className="space-y-3 lg:col-span-5">
          {/* Kanban — LIVE from tasks grouped by view */}
          <section className="panel">
            <PanelTitle>CRM · Kanban</PanelTitle>
            <div className="grid grid-cols-3 gap-2">
              {(["today", "week", "month"] as const).map((col) => (
                <div key={col} className="rounded border border-line bg-panel2 p-2">
                  <div className="mb-2 text-[10px] uppercase tracking-wider text-muted">
                    {col === "today" ? "Today" : col === "week" ? "This week" : "This month"}
                  </div>
                  <div className="space-y-2">
                    {kanban[col].map((t) => (
                      <button
                        key={t.id}
                        onClick={() => onCompleteTask(t.id)}
                        title="Mark done"
                        className="w-full rounded border border-line bg-panel p-2 text-left text-[12px] text-ghost hover:border-acid/40 hover:text-acid"
                      >
                        {t.content}
                      </button>
                    ))}
                    {kanban[col].length === 0 && (
                      <p className="text-[11px] text-muted">Nothing here.</p>
                    )}
                  </div>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      onAddKanban(col);
                    }}
                    className="mt-2"
                  >
                    <input
                      value={kanbanDraft[col] ?? ""}
                      onChange={(e) =>
                        setKanbanDraft((d) => ({ ...d, [col]: e.target.value }))
                      }
                      placeholder="+ add"
                      className="w-full rounded border border-line bg-panel px-2 py-1 text-[11px] text-ghost outline-none placeholder:text-muted focus:border-acid/50"
                    />
                  </form>
                </div>
              ))}
            </div>
          </section>

          {/* Brain — life categories (counts derived live from tasks) */}
          <section className="panel">
            <PanelTitle>Brain · Life Categories</PanelTitle>
            <div className="grid grid-cols-2 gap-2">
              {categories.map((c) => (
                <div key={c.key} className="rounded border border-line bg-panel2 p-3">
                  <div className="text-[12px] uppercase tracking-wider text-ghost">{c.key}</div>
                  <div className="mt-1 text-[11px] text-muted">{c.note}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Journal — LIVE latest entry + quick text note */}
          <section className="panel">
            <PanelTitle
              right={
                <button
                  onClick={() => setShowJournalForm((v) => !v)}
                  className="chip hover:text-acid"
                >
                  {showJournalForm ? "Close" : "+ Note"}
                </button>
              }
            >
              Journal
            </PanelTitle>
            <button
              title="Voice capture lands in Phase 4 (Telegram + Whisper)"
              className="mb-3 flex w-full cursor-not-allowed items-center justify-center gap-2 rounded border border-line bg-panel2 py-2 text-[12px] text-muted"
            >
              <span className="h-2 w-2 rounded-full bg-muted" />
              Hold to voice-note your day · Phase 4
            </button>
            {showJournalForm && (
              <form onSubmit={onAddJournal} className="mb-3 space-y-2">
                <textarea
                  value={journalDraft}
                  onChange={(e) => setJournalDraft(e.target.value)}
                  placeholder="How did today go?"
                  rows={3}
                  className="w-full rounded border border-line bg-panel2 px-2 py-1 text-[12px] text-ghost outline-none placeholder:text-muted focus:border-acid/50"
                />
                <button className="chip hover:text-acid">Save note</button>
              </form>
            )}
            <div className="text-[11px] text-muted">
              {journal ? (
                <>
                  <div className="mb-1 uppercase tracking-wider">
                    {journal.date ?? "Latest"}
                  </div>
                  {journal.ai_summary || journal.raw_transcript || "—"}
                </>
              ) : (
                <>No journal entries yet — add a note above.</>
              )}
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-3 lg:col-span-4">
          {/* Calendar — static placeholder (no table yet) */}
          <section className="panel">
            <PanelTitle right={<span className="h-1.5 w-1.5 rounded-full bg-muted" />}>
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

          {/* Goals — LIVE from goals (month) */}
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
                    title="Remove goal"
                    className="text-[12px] text-muted opacity-0 transition-opacity hover:text-acid group-hover:opacity-100"
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

          {/* Nutrition — LIVE from nutrition (today) */}
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
              <form onSubmit={onAddMeal} className="mb-3 space-y-2">
                <input
                  value={mealDraft.meal}
                  onChange={(e) => setMealDraft((m) => ({ ...m, meal: e.target.value }))}
                  placeholder="meal"
                  className="w-full rounded border border-line bg-panel2 px-2 py-1 text-[12px] text-ghost outline-none placeholder:text-muted focus:border-acid/50"
                />
                <div className="flex gap-2">
                  <input
                    value={mealDraft.calories}
                    onChange={(e) =>
                      setMealDraft((m) => ({ ...m, calories: e.target.value }))
                    }
                    placeholder="kcal"
                    inputMode="numeric"
                    className="w-full rounded border border-line bg-panel2 px-2 py-1 text-[12px] text-ghost outline-none placeholder:text-muted focus:border-acid/50"
                  />
                  <input
                    value={mealDraft.protein}
                    onChange={(e) =>
                      setMealDraft((m) => ({ ...m, protein: e.target.value }))
                    }
                    placeholder="protein g"
                    inputMode="numeric"
                    className="w-full rounded border border-line bg-panel2 px-2 py-1 text-[12px] text-ghost outline-none placeholder:text-muted focus:border-acid/50"
                  />
                </div>
                <button className="chip hover:text-acid">Log meal</button>
              </form>
            )}
            <div className="space-y-1">
              {meals.length === 0 && (
                <p className="py-1 text-[12px] text-muted">Nothing logged today.</p>
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
              <Stat n={totalCalories} label="kcal" />
              <Stat n={totalProtein} label="protein g" />
              <Stat n={kcalLeft} label="kcal left" />
            </div>
          </section>
        </div>
      </div>

      {/* ASK BAR — wired in Phase 3 (AI) */}
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
