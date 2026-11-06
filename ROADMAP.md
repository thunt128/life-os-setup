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
1. Create a free Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL editor.
3. ✅ Password-protected login (Supabase Auth) — `app/login/page.tsx`.
4. ✅ Mock data in `app/page.tsx` replaced with live Supabase queries
   (tasks, habits, goals, nutrition, finance, journal).
5. ✅ Tasks/habits/goals/meals save when you check or add them.

> **Panels now backed by live tables:** Key Tasks, Daily Habits, CRM Kanban,
> Brain categories, Journal, Goals, Nutrition, Finance Pulse.
> **Still sample data:** the Calendar panel (no table in the schema yet) and
> the Finance sparkline shape. The **Ask** bar stays a stub until Phase 3.
>
> **Getting data in:**
> - Habits auto-seed from a default template the first time you open the app
>   each day, so checking them persists to the `habits` table.
> - Add key tasks and goals straight from the dashboard; log meals with **+ Log**.
> - The Finance Pulse reads `finance` rows labelled `net_worth`, `month` and
>   `day`. Optional starter data lives in `supabase/seed.sql`.

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
