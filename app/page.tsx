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
/*  sample data — they belong to later phases. Tasks (Phase 2) and the */
/*  Nutrition / Journal / Ask panels (Phase 3 AI) are now live.        */
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

/** Read a File into a bare base64 string (no data: prefix). */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      resolve(result.includes(",") ? result.split(",")[1] : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ------------------------------------------------------------------ */
/*  PAGE                                                               */
/* ------------------------------------------------------------------ */

export default function Dashboard() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [meals, setMeals] = useState<NutritionRow[]>([]);
  const [journalEntry, setJournalEntry] = useState<JournalRow | null>(null);
  const [newTask, setNewTask] = useState("");
  const [revealMoney, setRevealMoney] = useState(false);
  const [done, setDone] = useState<Record<string, boolean>>({});

  // Ask bar (AI)
  const [ask, setAsk] = useState("");
  const [askAnswer, setAskAnswer] = useState("");
  const [askLoading, setAskLoading] = useState(false);

  // Meal logging (AI)
  const [mealOpen, setMealOpen] = useState(false);
  const [mealDesc, setMealDesc] = useState("");
  const [mealLoading, setMealLoading] = useState(false);
  const [mealErr, setMealErr] = useState("");
  const photoInput = useRef<HTMLInputElement>(null);

  // Journal (AI)
  const [journalText, setJournalText] = useState("");
  const [journalLoading, setJournalLoading] = useState(false);
  const [journalErr, setJournalErr] = useState("");

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
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const { data } = await supabase
      .from("nutrition")
      .select("*")
      .gte("eaten_at", startOfDay.toISOString())
      .order("eaten_at", { ascending: false });
    if (data) setMeals(data as NutritionRow[]);
  }

  async function loadJournal() {
    const { data } = await supabase
      .from("journal")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1);
    if (data && data.length) setJournalEntry(data[0] as JournalRow);
  }

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    const content = newTask.trim();
    if (!content) return;
    setNewTask("");

    // Ask Claude to classify the task into a category + priority (Phase 3).
    // If the AI call fails, we still save the task without a category.
    let category: string | null = null;
    let priority = 0;
    try {
      const res = await fetch("/api/classify-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        const data = await res.json();
        category = data.category ?? null;
        priority = data.priority ?? 0;
      }
    } catch {
      /* offline / no key — fall back to an uncategorised task */
    }

    await supabase
      .from("tasks")
      .insert({ content, starred: true, view: "today", category, priority });
    loadTasks();
  }

  async function completeTask(id: string) {
    await supabase.from("tasks").update({ status: "done" }).eq("id", id);
    loadTasks();
  }

  async function askOS(e: React.FormEvent) {
    e.preventDefault();
    const question = ask.trim();
    if (askLoading) return;
    setAskLoading(true);
    setAskAnswer("");
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, tasks }),
      });
      const data = await res.json();
      setAskAnswer(res.ok ? data.answer : data.error || "Something went wrong.");
    } catch {
      setAskAnswer("Could not reach the AI service.");
    } finally {
      setAskLoading(false);
    }
  }

  async function logMeal(e: React.FormEvent) {
    e.preventDefault();
    if (mealLoading) return;
    const file = photoInput.current?.files?.[0];
    if (!mealDesc.trim() && !file) {
      setMealErr("Describe a meal or attach a photo.");
      return;
    }
    setMealLoading(true);
    setMealErr("");
    try {
      let image: string | undefined;
      let mediaType: string | undefined;
      if (file) {
        image = await fileToBase64(file);
        mediaType = file.type;
      }
      const res = await fetch("/api/estimate-meal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: mealDesc, image, mediaType }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMealErr(data.error || "Estimate failed.");
        return;
      }
      await supabase.from("nutrition").insert({
        meal: data.meal,
        calories: data.calories,
        protein: data.protein,
      });
      setMealDesc("");
      if (photoInput.current) photoInput.current.value = "";
      setMealOpen(false);
      loadMeals();
    } catch {
      setMealErr("Could not reach the AI service.");
    } finally {
      setMealLoading(false);
    }
  }

  async function saveJournal(e: React.FormEvent) {
    e.preventDefault();
    const transcript = journalText.trim();
    if (!transcript || journalLoading) return;
    setJournalLoading(true);
    setJournalErr("");
    try {
      const res = await fetch("/api/summarize-journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });
      const data = await res.json();
      if (!res.ok) {
        setJournalErr(data.error || "Summary failed.");
        return;
      }
      await supabase
        .from("journal")
        .insert({ raw_transcript: transcript, ai_summary: data.summary });
      setJournalText("");
      loadJournal();
    } catch {
      setJournalErr("Could not reach the AI service.");
    } finally {
      setJournalLoading(false);
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

  const caloriesToday = meals.reduce((sum, m) => sum + (m.calories ?? 0), 0);
  const proteinToday = meals.reduce((sum, m) => sum + (m.protein ?? 0), 0);
  const kcalLeft = Math.max(0, CALORIE_TARGET - caloriesToday);

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

          {/* Key Tasks — LIVE from Supabase, auto-categorised by Claude */}
          <section className="panel">
            <PanelTitle right={<span className="text-[10px] text-acidDim">live · ai</span>}>
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

          {/* Journal — write an entry, Claude summarises it (Phase 3) */}
          <section className="panel">
            <PanelTitle right={<span className="text-[10px] text-acidDim">ai summary</span>}>
              Journal
            </PanelTitle>
            <form onSubmit={saveJournal} className="mb-3">
              <textarea
                value={journalText}
                onChange={(e) => setJournalText(e.target.value)}
                placeholder="Type or paste today's reflection — Claude will summarise and save it. (Voice capture arrives in Phase 4.)"
                rows={3}
                className="w-full resize-none rounded border border-line bg-panel2 px-2 py-2 text-[12px] text-ghost outline-none placeholder:text-muted focus:border-acid/50"
              />
              {journalErr && <p className="mt-1 text-[11px] text-red-400">{journalErr}</p>}
              <div className="mt-2 flex justify-end">
                <button
                  disabled={journalLoading || !journalText.trim()}
                  className="rounded bg-acid px-3 py-1 text-[12px] font-semibold text-ink hover:bg-acid/90 disabled:opacity-50"
                >
                  {journalLoading ? "Summarising…" : "Summarise & save"}
                </button>
              </div>
            </form>
            <div className="text-[11px] text-muted">
              <div className="mb-1 uppercase tracking-wider">
                {journalEntry ? "Latest summary" : "No entries yet"}
              </div>
              {journalEntry?.ai_summary && (
                <p className="text-ghost/90">{journalEntry.ai_summary}</p>
              )}
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

          {/* Nutrition — log a meal, Claude estimates calories + protein (Phase 3) */}
          <section className="panel">
            <PanelTitle
              right={
                <button onClick={() => setMealOpen((v) => !v)} className="chip hover:text-acid">
                  {mealOpen ? "Close" : "+ Log"}
                </button>
              }
            >
              Nutrition
            </PanelTitle>

            {mealOpen && (
              <form onSubmit={logMeal} className="mb-3 space-y-2 rounded border border-line bg-panel2 p-2">
                <input
                  value={mealDesc}
                  onChange={(e) => setMealDesc(e.target.value)}
                  placeholder="describe a meal (e.g. chicken burrito bowl)"
                  className="w-full rounded border border-line bg-panel px-2 py-1 text-[12px] text-ghost outline-none placeholder:text-muted focus:border-acid/50"
                />
                <input
                  ref={photoInput}
                  type="file"
                  accept="image/*"
                  className="block w-full text-[11px] text-muted file:mr-2 file:rounded file:border file:border-line file:bg-panel file:px-2 file:py-1 file:text-[11px] file:text-ghost"
                />
                {mealErr && <p className="text-[11px] text-red-400">{mealErr}</p>}
                <div className="flex justify-end">
                  <button
                    disabled={mealLoading}
                    className="rounded bg-acid px-3 py-1 text-[12px] font-semibold text-ink hover:bg-acid/90 disabled:opacity-50"
                  >
                    {mealLoading ? "Estimating…" : "Estimate & log"}
                  </button>
                </div>
              </form>
            )}

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
              <Stat n={caloriesToday} label="kcal" />
              <Stat n={proteinToday} label="protein g" />
              <Stat n={kcalLeft} label="kcal left" />
            </div>
          </section>
        </div>
      </div>

      {/* ASK BAR — wired to Claude over your live task rows (Phase 3) */}
      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-ink/95 px-3 py-3 backdrop-blur md:px-5">
        <div className="mx-auto max-w-5xl">
          {(askLoading || askAnswer) && (
            <div className="mb-2 max-h-40 overflow-y-auto whitespace-pre-wrap rounded border border-line bg-panel px-3 py-2 text-[12px] text-ghost">
              {askLoading ? "Thinking…" : askAnswer}
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
              disabled={askLoading}
              className="rounded bg-acid px-5 py-2 text-[13px] font-semibold text-ink hover:bg-acid/90 disabled:opacity-50"
            >
              {askLoading ? "…" : "Ask"}
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
