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
1. Create a free Supabase project. *(your one-time setup — see below)*
2. Run `supabase/schema.sql` in the Supabase SQL editor. *(your one-time setup)*
3. ✅ Password-protected login (Supabase Auth) at `/login`, with an auth
   gate on the dashboard that redirects signed-out visitors.
4. ✅ Every panel now reads live from Supabase instead of mock data:
   - **Finance Pulse** ← `finance` rows labelled `net worth` / `month` / `day`
   - **Key Tasks** & **CRM · Kanban** ← `tasks` (Kanban grouped by `view`)
   - **Brain · Life Categories** ← live open-task counts per `category`
   - **Daily Habits** ← `habits` (parent/child groups for today)
   - **Journal** ← latest `journal` entry
   - **Goals · This Month** ← `goals` where `period = 'month'`
   - **Nutrition** + totals ← today's `nutrition` rows
   - *(Calendar stays a placeholder — no table in the schema yet.)*
5. ✅ Adding/checking saves to the database:
   - Add a **key task**, **goal**, **meal**, or **journal note**.
   - Check off a **habit** (persists; the day's habits seed from a template
     the first time you open that day).
   - Complete a **key task** (sets `status = 'done'`).

> **First-time Supabase setup (steps 1–2):** create a project, run
> `supabase/schema.sql`, then copy `.env.local.example` to `.env.local` and
> fill in `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
> Create a user in Supabase Auth to sign in with, and (optionally) add three
> `finance` rows labelled `net worth`, `month`, and `day` to light up the
> Finance Pulse panel.

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
