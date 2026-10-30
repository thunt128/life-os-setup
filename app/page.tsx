"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

/* ------------------------------------------------------------------ */
/*  ROW TYPES — mirror supabase/schema.sql                            */
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
};

type JournalRow = {
  id: string;
  date: string;
  raw_transcript: string | null;
  ai_summary: string | null;
};

/* ------------------------------------------------------------------ */
/*  STANDING TEMPLATES / CONSTANTS                                     */
/*  These are not mock *data* — they are fixed structure. The daily    */
/*  completion state for habits is stored live in the `habits` table.  */
/*  The Calendar has no backing table in schema.sql yet, so it stays   */
/*  a static placeholder until one exists (not presented as live).     */
/* ------------------------------------------------------------------ */

const HABIT_GROUPS = [
  { name: "Morning", items: ["Warm-up", "Lift", "Stretch"] },
  { name: "Supplements", items: ["Creatine", "Omega-3", "Vit D", "Magnesium"] },
  { name: "Deep work", items: ["Scroll X", "Market research", "Ideate"] },
  { name: "Comms", items: ["Reply DMs", "Engage comments"] },
  { name: "Build", items: ["Portfolio", "Risk scan", "Dashboard"] },
];

// The six life categories from schema.sql's `tasks.category` comment.
const CATEGORY_KEYS = ["legal", "finance", "content", "products", "opsec", "business"];

// Daily calorie target used to derive "kcal left" from live meal totals.
const CALORIE_TARGET = 2040;

// Decorative sparkline for the Finance panel — no time-series table exists yet.
const FINANCE_BARS = [
  8, 10, 7, 12, 9, 14, 11, 16, 13, 18, 15, 20, 17, 22, 19, 24, 21, 26, 23, 28,
];

// Static placeholder — there is no calendar table in schema.sql yet.
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

// Local YYYY-MM-DD (not UTC) so "today" matches the user's day.
function localDate(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/* ------------------------------------------------------------------ */
/*  PAGE                                                               */
/* ------------------------------------------------------------------ */

export default function Dashboard() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);

  // Live data
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [habitsDone, setHabitsDone] = useState<Record<string, string>>({}); // habitKey -> row id
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [meals, setMeals] = useState<NutritionRow[]>([]);
  const [finance, setFinance] = useState<Record<string, number>>({});
  const [journal, setJournal] = useState<JournalRow | null>(null);

  // Local UI state
  const [newTask, setNewTask] = useState("");
  const [newGoal, setNewGoal] = useState("");
  const [revealMoney, setRevealMoney] = useState(false);
  const [showMealForm, setShowMealForm] = useState(false);
  const [mealName, setMealName] = useState("");
  const [mealCal, setMealCal] = useState("");
  const [mealProtein, setMealProtein] = useState("");
  const [journalDraft, setJournalDraft] = useState("");
  const [ask, setAsk] = useState("");

  const today = localDate();

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

  function loadAll() {
    loadTasks();
    loadHabits();
    loadGoals();
    loadMeals();
    loadFinance();
    loadJournal();
  }

  /* ---- Tasks (Key Tasks + Kanban + Brain categories) ---- */
  async function loadTasks() {
    const { data } = await supabase
      .from("tasks")
      .select("*")
      .eq("status", "active")
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

  /* ---- Habits: persist today's completion in the habits table ---- */
  async function loadHabits() {
    const { data } = await supabase
      .from("habits")
      .select("id,name")
      .eq("date", today)
      .eq("completed", true);
    const map: Record<string, string> = {};
    (data ?? []).forEach((h: { id: string; name: string }) => {
      map[h.name] = h.id;
    });
    setHabitsDone(map);
  }

  async function toggleHabit(key: string) {
    const existingId = habitsDone[key];
    if (existingId) {
      // Un-check: remove today's completion row.
      setHabitsDone((m) => {
        const next = { ...m };
        delete next[key];
        return next;
      });
      await supabase.from("habits").delete().eq("id", existingId);
    } else {
      // Check: record completion for today.
      const { data } = await supabase
        .from("habits")
        .insert({ name: key, date: today, completed: true })
        .select("id")
        .single();
      if (data) setHabitsDone((m) => ({ ...m, [key]: (data as { id: string }).id }));
    }
  }

  /* ---- Goals ---- */
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

  async function deleteGoal(id: string) {
    await supabase.from("goals").delete().eq("id", id);
    loadGoals();
  }

  /* ---- Nutrition / Health ---- */
  async function loadMeals() {
    const { data } = await supabase
      .from("nutrition")
      .select("*")
      .gte("eaten_at", `${today}T00:00:00`)
      .order("eaten_at", { ascending: true });
    if (data) setMeals(data as NutritionRow[]);
  }

  async function addMeal(e: React.FormEvent) {
    e.preventDefault();
    const meal = mealName.trim();
    if (!meal) return;
    await supabase.from("nutrition").insert({
      meal,
      calories: mealCal ? Number(mealCal) : null,
      protein: mealProtein ? Number(mealProtein) : null,
    });
    setMealName("");
    setMealCal("");
    setMealProtein("");
    setShowMealForm(false);
    loadMeals();
  }

  /* ---- Finance ---- */
  async function loadFinance() {
    const { data } = await supabase.from("finance").select("*");
    const map: Record<string, number> = {};
    (data as FinanceRow[] | null)?.forEach((r) => {
      map[r.label] = r.amount ?? 0;
    });
    setFinance(map);
  }

  /* ---- Journal ---- */
  async function loadJournal() {
    const { data } = await supabase
      .from("journal")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1);
    setJournal((data?.[0] as JournalRow) ?? null);
  }

  async function saveJournal(e: React.FormEvent) {
    e.preventDefault();
    const text = journalDraft.trim();
    if (!text) return;
    setJournalDraft("");
    await supabase.from("journal").insert({ raw_transcript: text, date: today });
    loadJournal();
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  /* ---- Derived views ---- */
  const keyTasks = tasks.filter((t) => t.starred);

  const kanban = useMemo(() => {
    const cols: Record<"today" | "week" | "month", TaskRow[]> = {
      today: [],
      week: [],
      month: [],
    };
    tasks.forEach((t) => cols[t.view]?.push(t));
    return cols;
  }, [tasks]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    tasks.forEach((t) => {
      if (t.category) counts[t.category] = (counts[t.category] ?? 0) + 1;
    });
    return counts;
  }, [tasks]);

  const allHabits = useMemo(
    () => HABIT_GROUPS.flatMap((g) => g.items.map((i) => `${g.name}:${i}`)),
    []
  );
  const habitPct = Math.round(
    (allHabits.filter((k) => habitsDone[k]).length / allHabits.length) * 100
  );

  const consumedCal = meals.reduce((s, m) => s + (m.calories ?? 0), 0);
  const consumedProtein = meals.reduce((s, m) => s + (m.protein ?? 0), 0);
  const calLeft = Math.max(CALORIE_TARGET - consumedCal, 0);

  const money = (n: number) =>
    "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });

  const dateLabel = new Date().toLocaleDateString("en-US", {
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
            {dateLabel} ·{" "}
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
          {/* Finance Pulse — LIVE from finance table */}
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
                {money(finance["net_worth"] ?? 0)}
              </div>
              <div className="mt-1 flex gap-4 text-[12px]">
                <span className="text-acidDim">Month +{money(finance["month"] ?? 0)}</span>
                <span className="text-acidDim">Today +{money(finance["day"] ?? 0)}</span>
              </div>
            </div>
            {Object.keys(finance).length === 0 && (
              <p className="mt-2 text-[11px] text-muted">
                No finance rows yet — add rows labelled net_worth, month, day.
              </p>
            )}
            <div className="mt-3 flex h-12 items-end gap-1">
              {FINANCE_BARS.map((h, i) => (
                <div key={i} className="flex-1 rounded-sm bg-acid/60" style={{ height: `${h * 3}%` }} />
              ))}
            </div>
          </section>

          {/* Key Tasks — LIVE from tasks table */}
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

          {/* Daily Habits — LIVE completion state in habits table */}
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
                const n = keys.filter((k) => habitsDone[k]).length;
                return (
                  <div key={g.name}>
                    <div className="mb-1 flex justify-between text-[11px] text-muted">
                      <span className="uppercase tracking-wider">{g.name}</span>
                      <span>
                        {n}/{g.items.length}
                      </span>
                    </div>
                    {g.items.map((item) => {
                      const k = `${g.name}:${item}`;
                      return (
                        <Check
                          key={k}
                          checked={!!habitsDone[k]}
                          onChange={() => toggleHabit(k)}
                          label={item}
                        />
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
          {/* Kanban — LIVE from tasks table, grouped by view */}
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

          {/* Brain — life categories, LIVE counts from tasks */}
          <section className="panel">
            <PanelTitle>Brain · Life Categories</PanelTitle>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORY_KEYS.map((key) => {
                const n = categoryCounts[key] ?? 0;
                return (
                  <div key={key} className="rounded border border-line bg-panel2 p-3">
                    <div className="text-[12px] uppercase tracking-wider text-ghost">{key}</div>
                    <div className="mt-1 text-[11px] text-muted">
                      {n} open task{n === 1 ? "" : "s"}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Journal — LIVE latest entry, save a note */}
          <section className="panel">
            <PanelTitle>Journal</PanelTitle>
            <button
              className="mb-3 flex w-full items-center justify-center gap-2 rounded border border-acid/40 bg-acid/5 py-2 text-[12px] text-acid hover:bg-acid/10"
              title="Voice capture ships in Phase 4"
            >
              <span className="h-2 w-2 rounded-full bg-acid" />
              Hold to voice-note your day
            </button>
            <form onSubmit={saveJournal} className="mb-3 flex gap-2">
              <input
                value={journalDraft}
                onChange={(e) => setJournalDraft(e.target.value)}
                placeholder="+ type a quick note"
                className="flex-1 rounded border border-line bg-panel2 px-2 py-1 text-[12px] text-ghost outline-none placeholder:text-muted focus:border-acid/50"
              />
              <button className="chip hover:text-acid">Save</button>
            </form>
            <div className="text-[11px] text-muted">
              <div className="mb-1 uppercase tracking-wider">
                {journal ? `Latest · ${journal.date}` : "No entries yet"}
              </div>
              {journal?.ai_summary ?? journal?.raw_transcript ?? "Your most recent note will show here."}
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-3 lg:col-span-4">
          {/* Calendar — static placeholder (no table in schema yet) */}
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

          {/* Goals — LIVE from goals table, add/delete */}
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
                    onClick={() => deleteGoal(g.id)}
                    className="text-[11px] text-muted opacity-0 transition-opacity hover:text-acid group-hover:opacity-100"
                    aria-label="Delete goal"
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

          {/* Nutrition — LIVE meals + derived health totals */}
          <section className="panel">
            <PanelTitle
              right={
                <button onClick={() => setShowMealForm((v) => !v)} className="chip hover:text-acid">
                  {showMealForm ? "Close" : "+ Log"}
                </button>
              }
            >
              Nutrition
            </PanelTitle>

            {showMealForm && (
              <form onSubmit={addMeal} className="mb-3 space-y-2">
                <input
                  value={mealName}
                  onChange={(e) => setMealName(e.target.value)}
                  placeholder="meal"
                  className="w-full rounded border border-line bg-panel2 px-2 py-1 text-[12px] text-ghost outline-none placeholder:text-muted focus:border-acid/50"
                />
                <div className="flex gap-2">
                  <input
                    value={mealCal}
                    onChange={(e) => setMealCal(e.target.value)}
                    placeholder="kcal"
                    inputMode="numeric"
                    className="w-1/2 rounded border border-line bg-panel2 px-2 py-1 text-[12px] text-ghost outline-none placeholder:text-muted focus:border-acid/50"
                  />
                  <input
                    value={mealProtein}
                    onChange={(e) => setMealProtein(e.target.value)}
                    placeholder="protein g"
                    inputMode="numeric"
                    className="w-1/2 rounded border border-line bg-panel2 px-2 py-1 text-[12px] text-ghost outline-none placeholder:text-muted focus:border-acid/50"
                  />
                </div>
                <button className="w-full rounded bg-acid py-1.5 text-[12px] font-semibold text-ink hover:bg-acid/90">
                  Log meal
                </button>
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
              <Stat n={consumedCal} label="kcal" />
              <Stat n={consumedProtein} label="protein g" />
              <Stat n={calLeft} label="kcal left" />
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
