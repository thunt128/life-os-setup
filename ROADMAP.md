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
1. ✅ Create a free Supabase project.
2. ✅ Run `supabase/schema.sql` in the Supabase SQL editor.
3. ✅ Password-protected login (Supabase Auth) — see `app/login/page.tsx`.
4. ✅ Mock data in `app/page.tsx` replaced with live queries:
   - **Finance Pulse** reads the `finance` table (labels `net_worth`,
     `month_change`, `day_change`).
   - **Key Tasks** / **Kanban** / **Brain categories** all read the `tasks`
     table (Kanban splits by the `view` column, Brain counts by `category`).
   - **Daily Habits**, **Goals**, and **Nutrition** read `habits`, `goals`,
     and `nutrition`.
5. ✅ Tasks, habits, goals, and meals now save:
   - Add / complete a task; add / remove a goal; log a meal.
   - Checking a habit persists for the day in the `habits` table.

> Want to see it populated fast? After running `schema.sql`, also run
> `supabase/seed.sql` for example data. The **Calendar** panel stays
> illustrative until a future phase adds an events table.

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
