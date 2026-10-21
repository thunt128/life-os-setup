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
1. Create a free Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL editor.
3. Add a password-protected login (Supabase Auth).
4. Replace the mock data in `app/page.tsx` with live queries.
5. Make tasks/habits/goals actually save when you check or add them.

### ✅ Phase 3 — AI features (Claude) (DONE)
All four features run server-side through route handlers in `app/api/*`, so the
`ANTHROPIC_API_KEY` stays on the server and is never shipped to the browser.
Set `ANTHROPIC_API_KEY` in `.env.local` to turn them on.

- **Classify a new task** into a category + priority — `POST /api/classify`.
  Runs automatically when you add a Key Task; falls back to saving the task
  uncategorized if the AI call fails or no key is set.
- **Summarize a journal transcript** — `POST /api/summarize`. Type notes in the
  Journal panel, hit "Summarize with AI & save"; the summary is stored in the
  `journal` table and shown in the recent-entries list.
- **Estimate calories/protein** from a meal description (and/or a base64 photo)
  — `POST /api/nutrition`. The Nutrition panel's "+ Log" button estimates and
  saves to the `nutrition` table; today's totals update live.
- **Answer "what should I do right now?"** from your task rows — `POST /api/ask`.
  The bottom **Ask** bar (previously a stub) now sends your live, active tasks
  to Claude and shows the answer inline.

> Model: `claude-opus-5-5`, configured in one place (`lib/anthropic.ts`).

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
