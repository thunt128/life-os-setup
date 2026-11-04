"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type TaskRow = {
  id: string;
  content: string;
  category: string | null;
  priority: number;
  starred: boolean;
  status: "active" | "done" | "archived";
  view: "today" | "week" | "month";
};

type MealRow = {
  id: string;
  meal: string;
  calories: number | null;
  protein: number | null;
};

type JournalRow = {
  id: string;
  date: string;
  raw_transcript: string | null;
  ai_summary: string | null;
};

/* ------------------------------------------------------------------ */
/*  MOCK DATA                                                          */
/*  Panels below belong to later phases and still use sample data.    */
/*  Tasks, Journal and Nutrition are now live + AI-powered (Phase 3). */
/* ------------------------------------------------------------------ */

const FINANCE = { netWorth: 2481300, month: 184000, day: 56210 };

const FINANCE_BARS = [
  8, 10, 7, 12, 9, 14, 11, 16, 13, 18, 15, 20, 17, 22, 19, 24, 21, 26, 23, 28,
];

const HABIT_GROUPS = [
  { name: "Morning", items: ["Warm-up", "Lift", "Stretch"] },
  { name: "Supplements", items: ["Creatine", "Omega-3", "Vit D", "Magnesium"] },
  { name: "Deep work", items: ["Scroll X", "Market research", "Ideate"] },
  { name: "Comms", items: ["Reply DMs", "Engage comments"] },
  { name: "Build", items: ["Portfolio", "Risk scan", "Dashboard"] },
];

const KANBAN = {
  today: ["Send investment proposal to client", "Review Q3 portfolio for risk exposure"],
  week: ["Draft 3 X threads on AI agents", "Renew company compliance filing"],
  month: ["Set up cold-storage wallet backup", "Outline follow-on finance video"],
};

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

const GOALS = [
  "Ship the OS mobile PWA",
  "Publish 20 videos",
  "Gym every day",
  "Close 2 enterprise deals",
];

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

/* ------------------------------------------------------------------ */
/*  PAGE                                                               */
/* ------------------------------------------------------------------ */

export default function Dashboard() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [newTask, setNewTask] = useState("");
  const [adding, setAdding] = useState(false);
  const [revealMoney, setRevealMoney] = useState(false);
  const [done, setDone] = useState<Record<string, boolean>>({});

  // Ask bar (AI)
  const [ask, setAsk] = useState("");
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState("");

  // Journal (AI)
  const [journal, setJournal] = useState<JournalRow | null>(null);
  const [journalText, setJournalText] = useState("");
  const [savingJournal, setSavingJournal] = useState(false);

  // Nutrition (AI)
  const [meals, setMeals] = useState<MealRow[]>([]);
  const [mealInput, setMealInput] = useState("");
  const [loggingMeal, setLoggingMeal] = useState(false);
  const [showMealForm, setShowMealForm] = useState(false);

  // --- Auth gate: redirect to /login if not signed in ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace("/login");
      } else {
        setAuthed(true);
        loadTasks();
        loadJournal();
        loadMeals();
      }
    });
  }, [router]);

  async function loadTasks() {
    const { data } = await supabase
      .from("tasks")
      .select("*")
      .order("priority", { ascending: false });
    if (data) setTasks(data as TaskRow[]);
  }

  async function loadJournal() {
    const { data } = await supabase
      .from("journal")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1);
    if (data && data.length) setJournal(data[0] as JournalRow);
  }

  async function loadMeals() {
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await supabase
      .from("nutrition")
      .select("*")
      .gte("eaten_at", `${today}T00:00:00`)
      .order("eaten_at", { ascending: false });
    if (data) setMeals(data as MealRow[]);
  }

  // --- Tasks: classify with Claude, then save ---
  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    const content = newTask.trim();
    if (!content || adding) return;
    setAdding(true);
    setNewTask("");

    let category: string | null = null;
    let priority = 1;
    try {
      const res = await fetch("/api/classify-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        const data = await res.json();
        category = data.category ?? null;
        if (typeof data.priority === "number") priority = data.priority;
      }
    } catch {
      // If classification fails we still save the task (uncategorized).
    }

    await supabase
      .from("tasks")
      .insert({ content, category, priority, starred: true, view: "today" });
    await loadTasks();
    setAdding(false);
  }

  async function completeTask(id: string) {
    await supabase.from("tasks").update({ status: "done" }).eq("id", id);
    loadTasks();
  }

  // --- Ask bar: Claude answers from live task rows ---
  async function runAsk(e: React.FormEvent) {
    e.preventDefault();
    if (asking) return;
    const question = ask.trim();
    setAsking(true);
    setAnswer("");
    try {
      const active = tasks
        .filter((t) => t.status === "active")
        .map((t) => ({
          content: t.content,
          category: t.category,
          priority: t.priority,
          starred: t.starred,
          view: t.view,
        }));
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, tasks: active }),
      });
      const data = await res.json();
      setAnswer(res.ok ? data.answer : `Error: ${data.error ?? "Ask failed."}`);
    } catch (err) {
      setAnswer(err instanceof Error ? `Error: ${err.message}` : "Ask failed.");
    }
    setAsking(false);
  }

  // --- Journal: Claude summarizes the day's brain-dump, then save ---
  async function saveJournal() {
    const transcript = journalText.trim();
    if (!transcript || savingJournal) return;
    setSavingJournal(true);
    let summary: string | null = null;
    try {
      const res = await fetch("/api/summarize-journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });
      if (res.ok) summary = (await res.json()).summary ?? null;
    } catch {
      // Save the raw entry even if summarization fails.
    }
    await supabase
      .from("journal")
      .insert({ raw_transcript: transcript, ai_summary: summary });
    setJournalText("");
    await loadJournal();
    setSavingJournal(false);
  }

  // --- Nutrition: Claude estimates calories/protein, then save ---
  async function logMeal(e: React.FormEvent) {
    e.preventDefault();
    const description = mealInput.trim();
    if (!description || loggingMeal) return;
    setLoggingMeal(true);
    let meal = description;
    let calories: number | null = null;
    let protein: number | null = null;
    try {
      const res = await fetch("/api/estimate-meal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });
      if (res.ok) {
        const data = await res.json();
        meal = data.meal ?? description;
        calories = data.calories ?? null;
        protein = data.protein ?? null;
      }
    } catch {
      // Save the meal even if estimation fails.
    }
    await supabase.from("nutrition").insert({ meal, calories, protein });
    setMealInput("");
    setShowMealForm(false);
    await loadMeals();
    setLoggingMeal(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  const keyTasks = tasks.filter((t) => t.starred && t.status === "active");

  const toggle = (key: string) =>
    setDone((d) => ({ ...d, [key]: !d[key] }));

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

  const totalCalories = meals.reduce((s, m) => s + (m.calories ?? 0), 0);
  const totalProtein = meals.reduce((s, m) => s + (m.protein ?? 0), 0);
  const caloriesLeft = Math.max(0, CALORIE_TARGET - totalCalories);

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
          {/* Finance Pulse */}
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
              <div className="text-3xl font-semibold text-acid">{money(FINANCE.netWorth)}</div>
              <div className="mt-1 flex gap-4 text-[12px]">
                <span className="text-acidDim">Month +{money(FINANCE.month)}</span>
                <span className="text-acidDim">Today +{money(FINANCE.day)}</span>
              </div>
            </div>
            <div className="mt-3 flex h-12 items-end gap-1">
              {FINANCE_BARS.map((h, i) => (
                <div key={i} className="flex-1 rounded-sm bg-acid/60" style={{ height: `${h * 3}%` }} />
              ))}
            </div>
          </section>

          {/* Key Tasks — LIVE from Supabase, AI-categorized */}
          <section className="panel">
            <PanelTitle right={<span className="text-[10px] text-acidDim">live · ai</span>}>
              Key Tasks · Today
            </PanelTitle>
            {keyTasks.length === 0 && !adding && (
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
            {adding && (
              <p className="py-1 text-[11px] text-acidDim">Classifying with Claude…</p>
            )}
            <form onSubmit={addTask} className="mt-2 flex gap-2">
              <input
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                placeholder="+ add a key task"
                className="flex-1 rounded border border-line bg-panel2 px-2 py-1 text-[12px] text-ghost outline-none placeholder:text-muted focus:border-acid/50"
              />
              <button disabled={adding} className="chip hover:text-acid disabled:opacity-50">
                {adding ? "…" : "Add"}
              </button>
            </form>
          </section>

          {/* Daily Habits */}
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
                        <Check key={k} checked={!!done[k]} onChange={() => toggle(k)} label={item} />
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
          {/* Kanban */}
          <section className="panel">
            <PanelTitle>CRM · Kanban</PanelTitle>
            <div className="grid grid-cols-3 gap-2">
              {(["today", "week", "month"] as const).map((col) => (
                <div key={col} className="rounded border border-line bg-panel2 p-2">
                  <div className="mb-2 text-[10px] uppercase tracking-wider text-muted">
                    {col === "today" ? "Today" : col === "week" ? "This week" : "This month"}
                  </div>
                  <div className="space-y-2">
                    {KANBAN[col].map((c, i) => (
                      <div key={i} className="rounded border border-line bg-panel p-2 text-[12px] text-ghost">
                        {c}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Brain — life categories */}
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
                  <div className={`text-[12px] uppercase tracking-wider ${c.warn ? "text-acid" : "text-ghost"}`}>
                    {c.key}
                  </div>
                  <div className="mt-1 text-[11px] text-muted">{c.note}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Journal — LIVE + AI summary */}
          <section className="panel">
            <PanelTitle right={<span className="text-[10px] text-acidDim">live · ai</span>}>
              Journal
            </PanelTitle>
            <textarea
              value={journalText}
              onChange={(e) => setJournalText(e.target.value)}
              placeholder="Brain-dump your day — Claude will summarize it…"
              rows={3}
              className="mb-2 w-full resize-none rounded border border-line bg-panel2 px-2 py-2 text-[12px] text-ghost outline-none placeholder:text-muted focus:border-acid/50"
            />
            <button
              onClick={saveJournal}
              disabled={savingJournal || !journalText.trim()}
              className="mb-3 flex w-full items-center justify-center gap-2 rounded border border-acid/40 bg-acid/5 py-2 text-[12px] text-acid hover:bg-acid/10 disabled:opacity-50"
            >
              <span className="h-2 w-2 rounded-full bg-acid" />
              {savingJournal ? "Summarizing…" : "Summarize & save"}
            </button>
            {journal?.ai_summary ? (
              <div className="text-[11px] text-muted">
                <div className="mb-1 uppercase tracking-wider">
                  Last entry · {journal.date}
                </div>
                {journal.ai_summary}
              </div>
            ) : (
              <p className="text-[11px] text-muted">No journal entries yet.</p>
            )}
          </section>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-3 lg:col-span-4">
          {/* Calendar */}
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

          {/* Goals */}
          <section className="panel">
            <PanelTitle>Goals · This Month</PanelTitle>
            <ol className="space-y-1.5">
              {GOALS.map((g, i) => (
                <li key={i} className="flex gap-2 text-[13px] text-ghost">
                  <span className="text-acidDim">{i + 1}</span>
                  {g}
                </li>
              ))}
            </ol>
          </section>

          {/* Nutrition — LIVE + AI estimate */}
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
              <form onSubmit={logMeal} className="mb-2 flex gap-2">
                <input
                  value={mealInput}
                  onChange={(e) => setMealInput(e.target.value)}
                  placeholder="e.g. chicken burrito bowl"
                  className="flex-1 rounded border border-line bg-panel2 px-2 py-1 text-[12px] text-ghost outline-none placeholder:text-muted focus:border-acid/50"
                />
                <button disabled={loggingMeal} className="chip hover:text-acid disabled:opacity-50">
                  {loggingMeal ? "…" : "Est."}
                </button>
              </form>
            )}
            {loggingMeal && (
              <p className="mb-2 text-[11px] text-acidDim">Estimating with Claude…</p>
            )}
            <div className="space-y-1">
              {meals.length === 0 && !loggingMeal && (
                <p className="text-[12px] text-muted">No meals logged today.</p>
              )}
              {meals.map((m) => (
                <div key={m.id} className="flex items-center justify-between rounded border border-line bg-panel2 px-2 py-1.5 text-[12px]">
                  <span className="text-ghost">{m.meal}</span>
                  <span className="text-muted">{m.calories ?? "?"} kcal · {m.protein ?? "?"}p</span>
                </div>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <Stat n={totalCalories} label="kcal" />
              <Stat n={totalProtein} label="protein g" />
              <Stat n={caloriesLeft} label="kcal left" />
            </div>
          </section>
        </div>
      </div>

      {/* ASK BAR — AI (Phase 3) */}
      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-ink/95 px-3 py-3 backdrop-blur md:px-5">
        <div className="mx-auto max-w-5xl">
          {(answer || asking) && (
            <div className="mb-2 max-h-40 overflow-y-auto whitespace-pre-wrap rounded border border-line bg-panel px-3 py-2 text-[12px] text-ghost">
              {asking ? (
                <span className="text-acidDim">Thinking…</span>
              ) : (
                <>
                  <span className="float-right cursor-pointer pl-2 text-muted hover:text-acid" onClick={() => setAnswer("")}>
                    ✕
                  </span>
                  {answer}
                </>
              )}
            </div>
          )}
          <form onSubmit={runAsk} className="flex gap-2">
            <input
              value={ask}
              onChange={(e) => setAsk(e.target.value)}
              placeholder="Ask your OS:  what are the top 3 things I should do right now?"
              className="flex-1 rounded border border-line bg-panel px-3 py-2 text-[13px] text-ghost outline-none placeholder:text-muted focus:border-acid/50"
            />
            <button disabled={asking} className="rounded bg-acid px-5 py-2 text-[13px] font-semibold text-ink hover:bg-acid/90 disabled:opacity-50">
              {asking ? "…" : "Ask"}
            </button>
          </form>
        </div>
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
