"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
/*  Panels that aren't live yet still use hard-coded sample data. In   */
/*  Phase 3 the Journal, Nutrition and the Ask bar became real; the    */
/*  rest below are placeholders until their phase lands.               */
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

const CALORIE_TARGET = 2040; // daily kcal target (not tracked in the DB yet)

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

/** POST JSON to a same-origin API route and return the parsed body. */
async function postJSON<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data as T;
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

  // Ask bar (Phase 3 · AI)
  const [ask, setAsk] = useState("");
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState("");
  const [askErr, setAskErr] = useState("");

  // Nutrition (Phase 3 · AI estimate + live save)
  const [meals, setMeals] = useState<MealRow[]>([]);
  const [logOpen, setLogOpen] = useState(false);
  const [mealText, setMealText] = useState("");
  const [logging, setLogging] = useState(false);
  const [nutErr, setNutErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Journal (Phase 3 · AI summarize + live save)
  const [transcript, setTranscript] = useState("");
  const [summarizing, setSummarizing] = useState(false);
  const [journalErr, setJournalErr] = useState("");
  const [lastJournal, setLastJournal] = useState<JournalRow | null>(null);

  // --- Auth gate: redirect to /login if not signed in ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace("/login");
      } else {
        setAuthed(true);
        loadTasks();
        loadMeals();
        loadJournal();
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

  async function loadMeals() {
    const { data } = await supabase
      .from("nutrition")
      .select("id, meal, calories, protein")
      .order("eaten_at", { ascending: false })
      .limit(20);
    if (data) setMeals(data as MealRow[]);
  }

  async function loadJournal() {
    const { data } = await supabase
      .from("journal")
      .select("id, date, raw_transcript, ai_summary")
      .order("created_at", { ascending: false })
      .limit(1);
    if (data && data.length) setLastJournal(data[0] as JournalRow);
  }

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    const content = newTask.trim();
    if (!content || adding) return;
    setAdding(true);
    setNewTask("");

    // Ask Claude to classify the task; fall back to an unclassified insert.
    let category: string | null = null;
    let priority = 0;
    try {
      const c = await postJSON<{ category: string; priority: number }>(
        "/api/classify",
        { content }
      );
      category = c.category;
      priority = c.priority;
    } catch {
      /* classification is best-effort — still save the task */
    }

    await supabase
      .from("tasks")
      .insert({ content, starred: true, view: "today", category, priority });
    await loadTasks();
    setAdding(false);
  }

  async function completeTask(id: string) {
    await supabase.from("tasks").update({ status: "done" }).eq("id", id);
    loadTasks();
  }

  async function askOS(e: React.FormEvent) {
    e.preventDefault();
    if (asking) return;
    setAsking(true);
    setAskErr("");
    setAnswer("");
    const active = tasks
      .filter((t) => t.status === "active")
      .map((t) => ({
        content: t.content,
        category: t.category,
        priority: t.priority,
        starred: t.starred,
        view: t.view,
      }));
    try {
      const { answer } = await postJSON<{ answer: string }>("/api/ask", {
        question: ask,
        tasks: active,
      });
      setAnswer(answer);
    } catch (err) {
      setAskErr(err instanceof Error ? err.message : "Ask failed.");
    } finally {
      setAsking(false);
    }
  }

  function readFileAsDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Could not read image."));
      reader.readAsDataURL(file);
    });
  }

  async function logMeal(e: React.FormEvent) {
    e.preventDefault();
    if (logging) return;
    const file = fileRef.current?.files?.[0];
    if (!mealText.trim() && !file) return;
    setLogging(true);
    setNutErr("");
    try {
      const image = file ? await readFileAsDataURL(file) : undefined;
      const est = await postJSON<{ meal: string; calories: number; protein: number }>(
        "/api/nutrition/estimate",
        { meal: mealText.trim(), image }
      );
      await supabase.from("nutrition").insert({
        meal: est.meal,
        calories: est.calories,
        protein: est.protein,
      });
      setMealText("");
      if (fileRef.current) fileRef.current.value = "";
      setLogOpen(false);
      await loadMeals();
    } catch (err) {
      setNutErr(err instanceof Error ? err.message : "Could not log meal.");
    } finally {
      setLogging(false);
    }
  }

  async function summarizeJournal(e: React.FormEvent) {
    e.preventDefault();
    const text = transcript.trim();
    if (!text || summarizing) return;
    setSummarizing(true);
    setJournalErr("");
    try {
      const { summary } = await postJSON<{ summary: string }>(
        "/api/journal/summarize",
        { transcript: text }
      );
      await supabase
        .from("journal")
        .insert({ raw_transcript: text, ai_summary: summary });
      setTranscript("");
      await loadJournal();
    } catch (err) {
      setJournalErr(err instanceof Error ? err.message : "Could not summarize.");
    } finally {
      setSummarizing(false);
    }
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

  const caloriesToday = meals.reduce((s, m) => s + (m.calories ?? 0), 0);
  const proteinToday = meals.reduce((s, m) => s + (m.protein ?? 0), 0);
  const caloriesLeft = Math.max(0, CALORIE_TARGET - caloriesToday);

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

          {/* Journal — LIVE: type a day, Claude summarizes, saved to Supabase */}
          <section className="panel">
            <PanelTitle right={<span className="text-[10px] text-acidDim">live · AI</span>}>
              Journal
            </PanelTitle>
            <form onSubmit={summarizeJournal} className="mb-3">
              <textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                rows={3}
                placeholder="How did today go? Dump your thoughts — Claude writes the summary."
                className="w-full resize-none rounded border border-line bg-panel2 px-2 py-2 text-[12px] text-ghost outline-none placeholder:text-muted focus:border-acid/50"
              />
              <div className="mt-2 flex items-center justify-between">
                {journalErr ? (
                  <span className="text-[11px] text-red-400">{journalErr}</span>
                ) : (
                  <span className="text-[11px] text-muted">Voice capture arrives in Phase 4.</span>
                )}
                <button
                  disabled={summarizing || !transcript.trim()}
                  className="chip hover:text-acid disabled:opacity-50"
                >
                  {summarizing ? "Summarizing…" : "Summarize & save"}
                </button>
              </div>
            </form>
            {lastJournal ? (
              <div className="text-[11px] text-muted">
                <div className="mb-1 uppercase tracking-wider">{lastJournal.date}</div>
                {lastJournal.ai_summary || lastJournal.raw_transcript}
              </div>
            ) : (
              <div className="text-[11px] text-muted">No entries yet.</div>
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

          {/* Nutrition — LIVE: Claude estimates kcal/protein from text or a photo */}
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
              <form onSubmit={logMeal} className="mb-3 space-y-2 rounded border border-line bg-panel2 p-2">
                <input
                  value={mealText}
                  onChange={(e) => setMealText(e.target.value)}
                  placeholder="Describe a meal (e.g. chicken burrito bowl)"
                  className="w-full rounded border border-line bg-panel px-2 py-1 text-[12px] text-ghost outline-none placeholder:text-muted focus:border-acid/50"
                />
                <div className="flex items-center justify-between gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="text-[10px] text-muted file:mr-2 file:rounded file:border file:border-line file:bg-panel file:px-2 file:py-1 file:text-[10px] file:text-ghost"
                  />
                  <button
                    disabled={logging}
                    className="chip hover:text-acid disabled:opacity-50"
                  >
                    {logging ? "Estimating…" : "Estimate & log"}
                  </button>
                </div>
                {nutErr && <p className="text-[11px] text-red-400">{nutErr}</p>}
              </form>
            )}

            <div className="space-y-1">
              {meals.length === 0 && (
                <p className="py-1 text-[12px] text-muted">No meals logged yet.</p>
              )}
              {meals.map((m) => (
                <div key={m.id} className="flex items-center justify-between rounded border border-line bg-panel2 px-2 py-1.5 text-[12px]">
                  <span className="text-ghost">{m.meal}</span>
                  <span className="text-muted">{m.calories ?? 0} kcal · {m.protein ?? 0}p</span>
                </div>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <Stat n={caloriesToday} label="kcal" />
              <Stat n={proteinToday} label="protein g" />
              <Stat n={caloriesLeft} label="kcal left" />
            </div>
          </section>
        </div>
      </div>

      {/* ASK BAR — Phase 3: asks Claude using your live task data */}
      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-ink/95 px-3 py-3 backdrop-blur md:px-5">
        <div className="mx-auto max-w-5xl">
          {(answer || askErr) && (
            <div className="mb-2 rounded border border-line bg-panel px-3 py-2 text-[13px]">
              <div className="mb-1 flex items-center justify-between">
                <span className="panel-title">OS · answer</span>
                <button
                  onClick={() => {
                    setAnswer("");
                    setAskErr("");
                  }}
                  className="chip hover:text-acid"
                >
                  Dismiss
                </button>
              </div>
              {askErr ? (
                <p className="text-red-400">{askErr}</p>
              ) : (
                <p className="whitespace-pre-wrap text-ghost">{answer}</p>
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
              {asking ? "Thinking…" : "Ask"}
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
