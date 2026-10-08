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

### ✅ Phase 2 — Database + Auth (live data)
1. Create a free Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL editor.
3. Add a password-protected login (Supabase Auth). *(done — `app/login`)*
4. Replace the mock data in `app/page.tsx` with live queries. *(tasks done; more as each panel goes live)*
5. Make tasks/habits/goals actually save when you check or add them. *(tasks save)*

### ✅ Phase 3 — AI features (Claude)
All four features are wired as server-side API routes under `app/api/*` (your
`ANTHROPIC_API_KEY` stays on the server). Set the key in `.env.local`.
- **Classify a new task** into a category + priority — runs when you add a Key
  Task. (`app/api/classify-task`)
- **Summarize a journal transcript** — type an entry in the Journal panel and
  Claude summarises and saves it. (`app/api/summarize-journal`)
- **Estimate calories/protein** from a meal description *or photo* — the
  Nutrition panel's **+ Log**. (`app/api/estimate-meal`)
- **Answer "top 3 things to do right now"** from your live task rows — the
  bottom **Ask** bar (no longer a stub). (`app/api/ask`)

> Model defaults to `claude-opus-5-5`; override with `ANTHROPIC_MODEL`.

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
