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

### Phase 2 — Database + Auth (live data) — code DONE
The app code for this phase is finished; steps 1–2 are the one-time setup
you do in your own Supabase project.
1. Create a free Supabase project. *(your setup step)*
2. Run `supabase/schema.sql`, then optionally `supabase/seed.sql`, in the
   Supabase SQL editor. *(your setup step)*
3. ✅ Password-protected login (Supabase Auth) — `app/login/page.tsx`.
4. ✅ Every panel in `app/page.tsx` now reads live from Supabase via
   `lib/db.ts`: Finance, Key Tasks, Habits, Kanban (by task `view`),
   Brain category counts, Journal, Goals, Nutrition. Empty tables show calm
   empty states. *(Calendar stays a sample — no events table yet.)*
5. ✅ Writes persist: add/complete tasks, check habits, add goals, log meals.

> Copy `.env.local.example` to `.env.local` and fill in your Supabase URL +
> anon key, then `npm run dev`. Run `supabase/seed.sql` to populate the
> dashboard with sample rows, or just start adding your own.

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
│   ├── login/page.tsx   # Supabase password login
│   └── page.tsx         # the Operator dashboard (live Supabase data)
├── lib/
│   ├── supabaseClient.ts # shared browser Supabase client
│   └── db.ts            # typed row shapes + loaders/mutators
├── supabase/
│   ├── schema.sql       # database tables + row-level security
│   └── seed.sql         # optional sample rows
├── .env.local.example   # copy to .env.local and add your keys
├── tailwind.config.ts
└── package.json
```
