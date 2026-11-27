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
1. Create a free Supabase project. *(you do this)*
2. Run `supabase/schema.sql` in the Supabase SQL editor. *(you do this)*
3. ✅ Password-protected login (Supabase Auth) — `app/login/page.tsx`.
4. ✅ Mock data in `app/page.tsx` replaced with live queries for every
   data-backed panel: Finance Pulse, Key Tasks, Daily Habits, the CRM
   Kanban (grouped by `tasks.view`), the Brain category counts, Journal,
   Goals, and Nutrition.
5. ✅ Writes persist to Supabase: add/complete tasks, toggle & seed habits,
   add/delete goals, log meals.

> **Before live data shows up** you still need to do steps 1–2 above, then
> copy `.env.local.example` → `.env.local` and fill in your Supabase URL +
> anon key. The build and login flow work without them; the dashboard just
> shows empty states until the env is wired and you've added some rows.
>
> The Calendar panel stays illustrative — there's no events table in the
> schema yet. Finance values read from the `finance` table by label
> (`net_worth`, `month_change`, `day_change`).

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
