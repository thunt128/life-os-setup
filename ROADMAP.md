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
1. Create a free Supabase project. *(you do this once — see setup below)*
2. Run `supabase/schema.sql` in the Supabase SQL editor.
3. Password-protected login (Supabase Auth) — `app/login/page.tsx`, with the
   dashboard gated behind a session check.
4. Every panel now reads live from Supabase (`lib/db.ts`) instead of mock data:
   Finance, Key Tasks, Habits, Kanban, Life Categories, Journal, Goals, Nutrition.
5. Saves are wired: add/complete tasks, check habits, add goals, log meals.

> **One-time setup:** create a Supabase project, copy `.env.local.example` to
> `.env.local` and fill in `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
> then in the SQL editor run `supabase/schema.sql` and (optionally)
> `supabase/seed.sql` for starter rows so every panel looks alive on first login.
> Create your login user in Supabase → Authentication → Users.
>
> Panels without a data source yet (the Calendar, the finance sparkline, the
> journal voice button) are clearly marked and land in later phases.

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
│   ├── login/page.tsx   # password login (Supabase Auth)
│   └── page.tsx         # the Operator dashboard (live Supabase data)
├── lib/
│   ├── supabaseClient.ts # shared browser Supabase client
│   └── db.ts            # typed row shapes + read/write query helpers
├── supabase/
│   ├── schema.sql       # database tables + row-level security
│   └── seed.sql         # optional starter rows for every panel
├── .env.local.example   # copy to .env.local and add your keys
├── tailwind.config.ts
└── package.json
```
