# Life OS — Build Roadmap

A personal life-operating-system web app. Built incrementally, one section at a
time. **Phase 1 is done** — the rest we build together, checking in before each.

## Stack
- **Next.js (App Router) + TypeScript** — the app
- **Tailwind CSS** — styling
- **Supabase** — database + auth (single-user, password-protected)
- **Anthropic Claude API** — task classification, summaries, "top 3" answers
- **OpenAI Whisper** — voice → text
- **Telegram bot** (Vercel serverless) — capture notes/photos on the go
- **Vercel** — hosting

## Phases

### ✅ Phase 1 — Foundation (DONE)
- Tailwind set up
- The **Operator dashboard shell** with every panel, using mock data
- The **Supabase schema** (`supabase/schema.sql`)
- This roadmap + `.env.local.example`

> Right now the dashboard shows hard-coded sample data so you can see and feel
> the interface. The next phases make it real.

### ✅ Phase 2 — Database + Auth (live data) (DONE)
The app side is wired up. Steps 1–2 are one-time manual setup you run in
Supabase; everything else is live in the code.
1. Create a free Supabase project. *(manual — one-time)*
2. Run `supabase/schema.sql` in the Supabase SQL editor. *(manual — one-time)*
3. ✅ Password-protected login (Supabase Auth) — `app/login/page.tsx`.
4. ✅ Mock data in `app/page.tsx` replaced with live queries:
   - **Key Tasks**, **Kanban** (tasks by `view`), and **Brain** category
     counts all read from the `tasks` table.
   - **Daily Habits** read from `habits` (grouped by `parent_id`); the day's
     rows are seeded from a template on first load.
   - **Goals** read from `goals` (this month).
   - **Nutrition** reads today's meals from `nutrition`; **Health** totals
     are computed from them.
   - **Finance Pulse** reads the `finance` table by label
     (`net_worth`, `month_change`, `day_change`).
5. ✅ Saves work: add/complete tasks, toggle habits, add goals, log meals —
   all persist to Supabase.

> Calendar and the Journal history stay illustrative for now — Calendar has
> no table yet, and Journal fills in with Phases 3–4 (AI + voice).

### Phase 3 — AI features (Claude)
- Classify a new task into a category + priority.
- Summarize a journal transcript.
- Estimate calories/protein from a meal description or photo.
- Answer "what are the top 3 things I should do right now?" from your task rows.
  (This is the bottom **Ask** bar — currently a stub.)

### Phase 4 — Voice capture (Telegram + Whisper)
- A Vercel serverless function as a Telegram bot webhook.
- Voice note → Whisper transcribes → Claude classifies → row saved → bot confirms.
- Also handles text messages and meal photos.

### Phase 5 — Polish + deploy
- Make it a mobile-installable PWA.
- Deploy to Vercel, connect the GitHub repo for auto-deploys.

## Running it locally
```powershell
cd C:\Users\tyler\life-os-setup
npm.cmd install
npm.cmd run dev
```
Then open http://localhost:3000

## Project layout
```
life-os-setup/
├── app/
│   ├── globals.css      # Tailwind + base styles
│   ├── layout.tsx       # root layout, fonts, metadata
│   └── page.tsx         # the Operator dashboard (mock data for now)
├── supabase/
│   └── schema.sql       # database tables + row-level security
├── .env.local.example   # copy to .env.local and add your keys
├── tailwind.config.ts
└── package.json
```
