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

### ✅ Phase 2 — Database + Auth (live data) (CODE DONE)
1. Create a free Supabase project. _(manual — you do this)_
2. Run `supabase/schema.sql` in the Supabase SQL editor. _(manual — you do this)_
3. ✅ Password-protected login (Supabase Auth) — `app/login/page.tsx`.
4. ✅ Mock data in `app/page.tsx` replaced with live queries — every
   schema-backed panel (Key Tasks, Daily Habits, Kanban, Brain categories,
   Finance Pulse, Goals, Nutrition/Health, Journal) now reads from Supabase.
5. ✅ Writes persist: tasks add/complete, habit checks, goal adds, and meal
   logs all save to Supabase.

> **Notes.** The **Calendar** panel stays illustrative — the schema has no
> calendar table yet. The Finance sparkline is a decorative flourish; the
> net-worth / month / today figures read from `finance` rows with labels
> `net_worth`, `month`, and `day`. **Daily Habits** seed from a built-in
> template on the first load of each day, so checks persist and reset
> naturally overnight. The bottom **Ask** bar is still a stub until Phase 3.

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
