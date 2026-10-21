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
  created_at: string;
};

/* ------------------------------------------------------------------ */
/*  MOCK DATA                                                          */
/*  Finance, habits, kanban, categories, calendar and goals are still */
/*  hard-coded — they become live in later phases. Tasks, journal and */
/*  nutrition below are now real (Supabase + Claude).                 */
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

const KCAL_TARGET = 2040;

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
  const [askAnswer, setAskAnswer] = useState("");

  // Journal (AI)
  const [journal, setJournal] = useState<JournalRow[]>([]);
  const [transcript, setTranscript] = useState("");
  const [summarizing, setSummarizing] = useState(false);

  // Nutrition (AI)
  const [meals, setMeals] = useState<NutritionRow[]>([]);
  const [logging, setLogging] = useState(false);

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
      .limit(5);
    if (data) setJournal(data as JournalRow[]);
  }

  async function loadMeals() {
    // Today's meals, newest first.
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const { data } = await supabase
      .from("nutrition")
      .select("*")
      .gte("eaten_at", startOfDay.toISOString())
      .order("eaten_at", { ascending: false });
    if (data) setMeals(data as NutritionRow[]);
  }

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    const content = newTask.trim();
    if (!content || adding) return;
    setAdding(true);
    setNewTask("");

    // Ask Claude to classify the task into a category + priority. If the AI
    // call fails (or no key is set) we still save the task with defaults.
    let category: string | null = null;
    let priority = 0;
    try {
      const res = await fetch("/api/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        const data = await res.json();
        category = data.category ?? null;
        priority = typeof data.priority === "number" ? data.priority : 0;
      }
    } catch {
      /* save with defaults */
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

  async function askOS(e: React.FormEvent) {
    e.preventDefault();
    const question = ask.trim();
    if (!question || asking) return;
    setAsking(true);
    setAskAnswer("");
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          tasks: tasks
            .filter((t) => t.status === "active")
            .map((t) => ({
              content: t.content,
              category: t.category,
              priority: t.priority,
              starred: t.starred,
              view: t.view,
            })),
        }),
      });
      const data = await res.json();
      setAskAnswer(res.ok ? data.answer : data.error ?? "Something went wrong.");
    } catch {
      setAskAnswer("Could not reach your OS brain right now.");
    }
    setAsking(false);
  }

  async function summarizeJournal() {
    const text = transcript.trim();
    if (!text || summarizing) return;
    setSummarizing(true);
    try {
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: text }),
      });
      const data = await res.json();
      if (res.ok) {
        await supabase
          .from("journal")
          .insert({ raw_transcript: text, ai_summary: data.summary });
        setTranscript("");
        await loadJournal();
      } else {
        alert(data.error ?? "Could not summarize.");
      }
    } catch {
      alert("Could not summarize right now.");
    }
    setSummarizing(false);
  }

  async function logMeal() {
    if (logging) return;
    const meal = window.prompt("Describe the meal (e.g. “chicken burrito bowl”):");
    if (!meal || !meal.trim()) return;
    setLogging(true);
    try {
      const res = await fetch("/api/nutrition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meal: meal.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        await supabase.from("nutrition").insert({
          meal: meal.trim(),
          calories: data.calories,
          protein: data.protein,
        });
        await loadMeals();
      } else {
        alert(data.error ?? "Could not estimate nutrition.");
      }
    } catch {
      alert("Could not estimate nutrition right now.");
    }
    setLogging(false);
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

  const eatenCalories = meals.reduce((s, m) => s + (m.calories ?? 0), 0);
  const eatenProtein = meals.reduce((s, m) => s + (m.protein ?? 0), 0);
  const kcalLeft = Math.max(0, KCAL_TARGET - eatenCalories);

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

          {/* Key Tasks — LIVE from Supabase, auto-classified by Claude */}
          <section className="panel">
            <PanelTitle right={<span className="text-[10px] text-acidDim">live · AI</span>}>
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

          {/* Journal — transcript → Claude summary → saved */}
          <section className="panel">
            <PanelTitle right={<span className="text-[10px] text-acidDim">AI</span>}>
              Journal
            </PanelTitle>
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Type or paste today's notes, then summarize…"
              rows={3}
              className="w-full resize-none rounded border border-line bg-panel2 px-2 py-1.5 text-[12px] text-ghost outline-none placeholder:text-muted focus:border-acid/50"
            />
            <button
              onClick={summarizeJournal}
              disabled={summarizing || !transcript.trim()}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded border border-acid/40 bg-acid/5 py-2 text-[12px] text-acid hover:bg-acid/10 disabled:opacity-50"
            >
              <span className="h-2 w-2 rounded-full bg-acid" />
              {summarizing ? "Summarizing…" : "Summarize with AI & save"}
            </button>

            <div className="mt-3 space-y-3 text-[11px]">
              {journal.length === 0 && (
                <div className="text-muted">No entries yet — write your first above.</div>
              )}
              {journal.map((j) => (
                <div key={j.id}>
                  <div className="mb-1 uppercase tracking-wider text-muted">
                    {new Date(j.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </div>
                  <div className="text-ghost">{j.ai_summary ?? j.raw_transcript}</div>
                </div>
              ))}
            </div>
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

          {/* Nutrition — Claude estimates calories + protein */}
          <section className="panel">
            <PanelTitle
              right={
                <button
                  onClick={logMeal}
                  disabled={logging}
                  className="chip hover:text-acid disabled:opacity-50"
                >
                  {logging ? "…" : "+ Log"}
                </button>
              }
            >
              Nutrition
            </PanelTitle>
            <div className="space-y-1">
              {meals.length === 0 && (
                <div className="rounded border border-line bg-panel2 px-2 py-1.5 text-[12px] text-muted">
                  Nothing logged today — tap “+ Log”.
                </div>
              )}
              {meals.map((m) => (
                <div key={m.id} className="flex items-center justify-between rounded border border-line bg-panel2 px-2 py-1.5 text-[12px]">
                  <span className="text-ghost">{m.meal}</span>
                  <span className="text-muted">{m.calories ?? 0} kcal · {m.protein ?? 0}p</span>
                </div>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <Stat n={eatenCalories} label="kcal" />
              <Stat n={eatenProtein} label="protein g" />
              <Stat n={kcalLeft} label="kcal left" />
            </div>
          </section>
        </div>
      </div>

      {/* ASK BAR — live AI over your task rows */}
      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-ink/95 px-3 py-3 backdrop-blur md:px-5">
        <div className="mx-auto max-w-5xl">
          {(asking || askAnswer) && (
            <div className="mb-2 max-h-48 overflow-y-auto rounded border border-line bg-panel px-3 py-2 text-[13px] text-ghost">
              {asking ? (
                <span className="text-muted">Thinking…</span>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div className="whitespace-pre-wrap">{askAnswer}</div>
                  <button
                    onClick={() => setAskAnswer("")}
                    className="shrink-0 text-[11px] text-muted hover:text-acid"
                  >
                    clear
                  </button>
                </div>
              )}
            </div>
          )}
          <form onSubmit={askOS} className="flex gap-2">
            <input
              value={ask}
              onChange={(e) => setAsk(e.target.value)}
              placeholder="Ask your OS:  what are the top 3 things I should do right now?"
              className="flex-1 rounded border border-line bg-panel px-3 py-2 text-[13px] text-ghost outline-none placeholder:text-muted focus:border-acid/50"
            />
            <button
              disabled={asking}
              className="rounded bg-acid px-5 py-2 text-[13px] font-semibold text-ink hover:bg-acid/90 disabled:opacity-50"
            >
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
