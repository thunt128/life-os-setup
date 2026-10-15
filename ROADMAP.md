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

### Phase 3 — AI features (Claude) — ✅ built
All four run through server-side route handlers in `app/api/*`, so your
`ANTHROPIC_API_KEY` stays on the server and never reaches the browser.
- **Classify a new task** into a category + priority — runs automatically when
  you add a Key Task (`POST /api/classify`).
- **Summarize a journal transcript** — type your day in the Journal panel and
  Claude writes the summary, saved to the `journal` table (`POST /api/journal/summarize`).
- **Estimate calories/protein** from a meal description or a photo — the
  Nutrition **+ Log** button (`POST /api/nutrition/estimate`).
- **Answer "what are the top 3 things I should do right now?"** from your task
  rows — the bottom **Ask** bar, now wired (`POST /api/ask`).

> Model lives in `lib/anthropic.ts` (`CLAUDE_MODEL`). Add `ANTHROPIC_API_KEY`
> to `.env.local`. Without it, the AI calls return a friendly 503 and the rest
> of the dashboard keeps working.

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
│   ├── api/             # Phase 3 AI route handlers (server-side Claude calls)
│   │   ├── ask/             # "top 3 right now" from your task rows
│   │   ├── classify/        # task → category + priority
│   │   ├── journal/summarize/  # transcript → summary
│   │   └── nutrition/estimate/ # meal text/photo → calories + protein
│   ├── globals.css      # Tailwind + base styles
│   ├── layout.tsx       # root layout, fonts, metadata
│   ├── login/page.tsx   # password login (Supabase Auth)
│   └── page.tsx         # the Operator dashboard
├── lib/
│   ├── anthropic.ts     # server-only Claude client + CLAUDE_MODEL
│   └── supabaseClient.ts
├── supabase/
│   └── schema.sql       # database tables + row-level security
├── .env.local.example   # copy to .env.local and add your keys
├── tailwind.config.ts
└── package.json
```
