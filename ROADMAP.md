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
3. ✅ Password-protected login (Supabase Auth) — `app/login/page.tsx`, with an
   auth gate on the dashboard that redirects you to `/login` when signed out.
4. ✅ The mock data in `app/page.tsx` is replaced by live Supabase queries.
   Every panel backed by a table in `schema.sql` now reads live rows:
   Key Tasks, Kanban (tasks by `view`), Daily Habits, Goals, Nutrition,
   Finance Pulse and the latest Journal entry. The Brain category tiles show
   live counts derived from your task rows.
5. ✅ Tasks, habits, goals and meals save when you add or check them.
   - Add key tasks and per-column Kanban tasks; tap a task to mark it done.
   - Daily Habits seed once per day from a default checklist, then each
     checkbox persists to the `habits` table.
   - Add month goals; log meals (kcal + protein), with totals computed live.

> **One-time setup:** all queries live in `lib/data.ts` and use the browser
> Supabase client (`lib/supabaseClient.ts`). Copy `.env.local.example` to
> `.env.local` and fill in `NEXT_PUBLIC_SUPABASE_URL` and
> `NEXT_PUBLIC_SUPABASE_ANON_KEY`, then create a user in Supabase Auth to log
> in with. Panels with no table yet (Calendar, the finance sparkline) stay as
> placeholder data until a later phase adds them.

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
