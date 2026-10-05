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

### Phase 2 — Database + Auth (live data)
1. Create a free Supabase project. *(your step — manual)*
2. Run `supabase/schema.sql` in the Supabase SQL editor. *(your step — manual)*
3. ✅ Password-protected login (Supabase Auth) — `app/login/page.tsx`.
4. ✅ Mock data in `app/page.tsx` replaced with live queries.
5. ✅ Tasks, habits, goals, and meals now save to Supabase.

**What's live now:** Finance Pulse, Key Tasks, Daily Habits, CRM Kanban,
Goals, Nutrition, and the Journal entry all read from (and where it makes
sense, write to) the tables in `supabase/schema.sql`.

- **Daily Habits** seed themselves from a template the first time you open
  the app each day (parent "group" rows + nested item rows), then every
  check persists.
- **Finance Pulse** reads the latest row per label from the `finance`
  table. Seed it with three labels so the numbers show up:
  ```sql
  insert into finance (label, amount) values
    ('net_worth',    2481300),
    ('month_change', 184000),
    ('day_change',   56210);
  ```
  (Insert a new row with the same label to update a value — the newest
  `as_of` wins.)
- **Nutrition** totals (kcal / protein / kcal-left) are computed from the
  meals you log today; the daily calorie target is still a constant in
  `app/page.tsx`.

> Still on sample data (no table in the schema yet): the **Calendar** and
> the **Brain · Life Categories** grid.

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
