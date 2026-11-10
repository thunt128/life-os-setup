"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  addGoal,
  addHabitGroup,
  addHabitItem,
  addJournalEntry,
  addMeal,
  addTask,
  fetchFinance,
  fetchGoals,
  fetchHabits,
  fetchLatestJournal,
  fetchMealsToday,
  fetchTasks,
  setHabitCompleted,
  setTaskStatus,
  type FinanceRow,
  type GoalRow,
  type HabitRow,
  type JournalRow,
  type NutritionRow,
  type TaskRow,
} from "@/lib/db";

/* ------------------------------------------------------------------ */
/*  STATIC DATA                                                        */
/*  Calendar has no table in supabase/schema.sql, so it stays sample   */
/*  data for now. The finance bar chart is a decorative sparkline      */
/*  (there is no time-series table to drive it yet).                   */
/* ------------------------------------------------------------------ */

const FINANCE_BARS = [
  8, 10, 7, 12, 9, 14, 11, 16, 13, 18, 15, 20, 17, 22, 19, 24, 21, 26, 23, 28,
];

const CALENDAR = [
  { time: "09:30", label: "Standup w/ team" },
  { time: "11:30", label: "Investor call — fund II" },
  { time: "14:00", label: "Record finance video" },
  { time: "16:30", label: "1:1 with editor" },
];

// Fixed life categories; the note under each is now a live task count.
const CATEGORY_KEYS = [
  "legal",
  "finance",
  "content",
  "products",
  "opsec",
  "business",
] as const;

const PROTEIN_TARGET_KCAL = 2040;

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

  // --- Live data ---
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [habits, setHabits] = useState<HabitRow[]>([]);
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [meals, setMeals] = useState<NutritionRow[]>([]);
  const [finance, setFinance] = useState<FinanceRow[]>([]);
  const [journal, setJournal] = useState<JournalRow | null>(null);

  // --- Form state ---
  const [newTask, setNewTask] = useState("");
  const [newGroup, setNewGroup] = useState("");
  const [newItem, setNewItem] = useState<Record<string, string>>({});
  const [newGoal, setNewGoal] = useState("");
  const [mealForm, setMealForm] = useState({ meal: "", calories: "", protein: "" });
  const [showMealForm, setShowMealForm] = useState(false);
  const [journalDraft, setJournalDraft] = useState("");
  const [showJournalForm, setShowJournalForm] = useState(false);
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
      fetchTasks(),
      fetchHabits(),
      fetchGoals(),
      fetchMealsToday(),
      fetchFinance(),
      fetchLatestJournal(),
    ]);
    setTasks(t);
    setHabits(h);
    setGoals(g);
    setMeals(m);
    setFinance(f);
    setJournal(j);
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  /* ---- Tasks ---- */
  async function submitTask(e: React.FormEvent) {
    e.preventDefault();
    const content = newTask.trim();
    if (!content) return;
    setNewTask("");
    await addTask(content, { starred: true, view: "today" });
    setTasks(await fetchTasks());
  }

  async function completeTask(id: string) {
    await setTaskStatus(id, "done");
    setTasks(await fetchTasks());
  }

  /* ---- Habits ---- */
  async function toggleHabit(h: HabitRow) {
    await setHabitCompleted(h.id, !h.completed);
    setHabits(await fetchHabits());
  }

  async function submitGroup(e: React.FormEvent) {
    e.preventDefault();
    const name = newGroup.trim();
    if (!name) return;
    setNewGroup("");
    await addHabitGroup(name);
    setHabits(await fetchHabits());
  }

  async function submitItem(e: React.FormEvent, parentId: string) {
    e.preventDefault();
    const name = (newItem[parentId] ?? "").trim();
    if (!name) return;
    setNewItem((s) => ({ ...s, [parentId]: "" }));
    await addHabitItem(name, parentId);
    setHabits(await fetchHabits());
  }

  /* ---- Goals ---- */
  async function submitGoal(e: React.FormEvent) {
    e.preventDefault();
    const content = newGoal.trim();
    if (!content) return;
    setNewGoal("");
    await addGoal(content, "month");
    setGoals(await fetchGoals());
  }

  /* ---- Nutrition ---- */
  async function submitMeal(e: React.FormEvent) {
    e.preventDefault();
    const meal = mealForm.meal.trim();
    if (!meal) return;
    const calories = mealForm.calories ? parseInt(mealForm.calories, 10) : null;
    const protein = mealForm.protein ? parseInt(mealForm.protein, 10) : null;
    setMealForm({ meal: "", calories: "", protein: "" });
    setShowMealForm(false);
    await addMeal(meal, Number.isNaN(calories!) ? null : calories, Number.isNaN(protein!) ? null : protein);
    setMeals(await fetchMealsToday());
  }

  /* ---- Journal ---- */
  async function submitJournal(e: React.FormEvent) {
    e.preventDefault();
    const text = journalDraft.trim();
    if (!text) return;
    setJournalDraft("");
    setShowJournalForm(false);
    await addJournalEntry(text);
    setJournal(await fetchLatestJournal());
  }

  /* ---- Derived values ---- */
  const keyTasks = useMemo(
    () => tasks.filter((t) => t.starred && t.status === "active"),
    [tasks]
  );

  const kanban = useMemo(() => {
    const cols: Record<"today" | "week" | "month", TaskRow[]> = {
      today: [],
      week: [],
      month: [],
    };
    for (const t of tasks) {
      if (t.status === "active") cols[t.view].push(t);
    }
    return cols;
  }, [tasks]);

  const categories = useMemo(() => {
    return CATEGORY_KEYS.map((key) => {
      const n = tasks.filter(
        (t) => t.status === "active" && (t.category ?? "").toLowerCase() === key
      ).length;
      const warn = key === "opsec" && n === 0;
      return {
        key,
        note: n === 0 ? (warn ? "nothing tracked" : "all clear") : `${n} active`,
        warn,
      };
    });
  }, [tasks]);

  const habitGroups = useMemo(() => {
    const parents = habits.filter((h) => h.parent_id === null);
    return parents
      .map((p) => ({
        parent: p,
        items: habits.filter((h) => h.parent_id === p.id),
      }))
      .sort((a, b) => a.parent.name.localeCompare(b.parent.name));
  }, [habits]);

  const habitItems = useMemo(() => habits.filter((h) => h.parent_id !== null), [habits]);
  const habitPct = habitItems.length
    ? Math.round((habitItems.filter((h) => h.completed).length / habitItems.length) * 100)
    : 0;

  const healthTotals = useMemo(() => {
    const calories = meals.reduce((s, m) => s + (m.calories ?? 0), 0);
    const protein = meals.reduce((s, m) => s + (m.protein ?? 0), 0);
    return { calories, protein, left: Math.max(0, PROTEIN_TARGET_KCAL - calories) };
  }, [meals]);

  const money = (n: number) =>
    "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });

  // Finance headline: a row explicitly labeled net worth, else the sum of rows.
  const netWorthRow = finance.find((f) => /net\s*worth/i.test(f.label));
  const financeTotal = netWorthRow
    ? netWorthRow.amount ?? 0
    : finance.reduce((s, f) => s + (f.amount ?? 0), 0);
  const financeDetail = finance.filter((f) => f !== netWorthRow).slice(0, 4);

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
            <div className={revealMoney ? "" : "select-none blur-md"}>
              <div className="text-3xl font-semibold text-acid">{money(financeTotal)}</div>
              {finance.length === 0 ? (
                <div className="mt-1 text-[12px] text-muted">
                  No finance rows yet — add some to the finance table.
                </div>
              ) : (
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
                  {financeDetail.map((f) => (
                    <span key={f.id} className="text-acidDim">
                      {f.label} {money(f.amount ?? 0)}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="mt-3 flex h-12 items-end gap-1">
              {FINANCE_BARS.map((h, i) => (
                <div key={i} className="flex-1 rounded-sm bg-acid/60" style={{ height: `${h * 3}%` }} />
              ))}
            </div>
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
            <form onSubmit={submitTask} className="mt-2 flex gap-2">
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
            {habitGroups.length === 0 && (
              <p className="mb-3 text-[12px] text-muted">
                No habits yet — add a group below (e.g. “Morning”), then add items to it.
              </p>
            )}
            <div className="space-y-3">
              {habitGroups.map(({ parent, items }) => {
                const n = items.filter((i) => i.completed).length;
                return (
                  <div key={parent.id}>
                    <div className="mb-1 flex justify-between text-[11px] text-muted">
                      <span className="uppercase tracking-wider">{parent.name}</span>
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
                    <form onSubmit={(e) => submitItem(e, parent.id)} className="mt-1 flex gap-2">
                      <input
                        value={newItem[parent.id] ?? ""}
                        onChange={(e) =>
                          setNewItem((s) => ({ ...s, [parent.id]: e.target.value }))
                        }
                        placeholder="+ item"
                        className="flex-1 rounded border border-line bg-panel2 px-2 py-1 text-[11px] text-ghost outline-none placeholder:text-muted focus:border-acid/50"
                      />
                      <button className="chip hover:text-acid">Add</button>
                    </form>
                  </div>
                );
              })}
            </div>
            <form onSubmit={submitGroup} className="mt-3 flex gap-2 border-t border-line pt-3">
              <input
                value={newGroup}
                onChange={(e) => setNewGroup(e.target.value)}
                placeholder="+ new habit group"
                className="flex-1 rounded border border-line bg-panel2 px-2 py-1 text-[12px] text-ghost outline-none placeholder:text-muted focus:border-acid/50"
              />
              <button className="chip hover:text-acid">Add</button>
            </form>
          </section>
        </div>

        {/* CENTER COLUMN */}
        <div className="space-y-3 lg:col-span-5">
          {/* Kanban — LIVE (tasks by view) */}
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

          {/* Brain — life categories (live counts from tasks) */}
          <section className="panel">
            <PanelTitle>Brain · Life Categories</PanelTitle>
            <div className="grid grid-cols-2 gap-2">
              {categories.map((c) => (
                <div
                  key={c.key}
                  className={`rounded border bg-panel2 p-3 ${
                    c.warn ? "border-acid/40" : "border-line"
                  }`}
                >
                  <div className={`text-[12px] uppercase tracking-wider ${c.warn ? "text-acid" : "text-ghost"}`}>
                    {c.key}
                  </div>
                  <div className="mt-1 text-[11px] text-muted">{c.note}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Journal — LIVE */}
          <section className="panel">
            <PanelTitle
              right={
                <button
                  onClick={() => setShowJournalForm((v) => !v)}
                  className="chip hover:text-acid"
                >
                  {showJournalForm ? "Cancel" : "+ Entry"}
                </button>
              }
            >
              Journal
            </PanelTitle>
            <button
              className="mb-3 flex w-full items-center justify-center gap-2 rounded border border-acid/40 bg-acid/5 py-2 text-[12px] text-acid hover:bg-acid/10"
              title="Voice capture arrives in Phase 4"
              onClick={() => setShowJournalForm(true)}
            >
              <span className="h-2 w-2 rounded-full bg-acid" />
              Hold to voice-note your day
            </button>
            {showJournalForm && (
              <form onSubmit={submitJournal} className="mb-3 space-y-2">
                <textarea
                  value={journalDraft}
                  onChange={(e) => setJournalDraft(e.target.value)}
                  placeholder="Type today's entry…"
                  rows={3}
                  className="w-full rounded border border-line bg-panel2 px-2 py-1.5 text-[12px] text-ghost outline-none placeholder:text-muted focus:border-acid/50"
                />
                <button className="chip hover:text-acid">Save entry</button>
              </form>
            )}
            <div className="text-[11px] text-muted">
              {journal ? (
                <>
                  <div className="mb-1 uppercase tracking-wider">
                    {new Date(journal.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </div>
                  {journal.ai_summary || journal.raw_transcript}
                </>
              ) : (
                "No entries yet — add one to start your journal."
              )}
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-3 lg:col-span-4">
          {/* Calendar — sample data (no table yet) */}
          <section className="panel">
            <PanelTitle right={<span className="text-[10px] text-muted">sample</span>}>
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
              <p className="mb-2 text-[12px] text-muted">No goals yet — add one below.</p>
            )}
            <ol className="space-y-1.5">
              {goals.map((g, i) => (
                <li key={g.id} className="flex gap-2 text-[13px] text-ghost">
                  <span className="text-acidDim">{i + 1}</span>
                  <span>{g.content}</span>
                  {g.period === "week" && (
                    <span className="ml-auto text-[10px] uppercase text-muted">week</span>
                  )}
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

          {/* Nutrition — LIVE */}
          <section className="panel">
            <PanelTitle
              right={
                <button
                  onClick={() => setShowMealForm((v) => !v)}
                  className="chip hover:text-acid"
                >
                  {showMealForm ? "Cancel" : "+ Log"}
                </button>
              }
            >
              Nutrition
            </PanelTitle>
            {showMealForm && (
              <form onSubmit={submitMeal} className="mb-3 space-y-2">
                <input
                  value={mealForm.meal}
                  onChange={(e) => setMealForm((s) => ({ ...s, meal: e.target.value }))}
                  placeholder="meal"
                  className="w-full rounded border border-line bg-panel2 px-2 py-1 text-[12px] text-ghost outline-none placeholder:text-muted focus:border-acid/50"
                />
                <div className="flex gap-2">
                  <input
                    value={mealForm.calories}
                    onChange={(e) => setMealForm((s) => ({ ...s, calories: e.target.value }))}
                    placeholder="kcal"
                    inputMode="numeric"
                    className="w-full rounded border border-line bg-panel2 px-2 py-1 text-[12px] text-ghost outline-none placeholder:text-muted focus:border-acid/50"
                  />
                  <input
                    value={mealForm.protein}
                    onChange={(e) => setMealForm((s) => ({ ...s, protein: e.target.value }))}
                    placeholder="protein g"
                    inputMode="numeric"
                    className="w-full rounded border border-line bg-panel2 px-2 py-1 text-[12px] text-ghost outline-none placeholder:text-muted focus:border-acid/50"
                  />
                  <button className="chip hover:text-acid">Save</button>
                </div>
              </form>
            )}
            <div className="space-y-1">
              {meals.length === 0 && (
                <div className="text-[12px] text-muted">Nothing logged today.</div>
              )}
              {meals.map((m) => (
                <div key={m.id} className="flex items-center justify-between rounded border border-line bg-panel2 px-2 py-1.5 text-[12px]">
                  <span className="text-ghost">{m.meal}</span>
                  <span className="text-muted">{m.calories ?? 0} kcal · {m.protein ?? 0}p</span>
                </div>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <Stat n={healthTotals.calories} label="kcal" />
              <Stat n={healthTotals.protein} label="protein g" />
              <Stat n={healthTotals.left} label="kcal left" />
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
