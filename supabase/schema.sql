-- ============================================================
--  Life OS — Supabase schema
--  Run this in Supabase Studio → SQL Editor → New query → Run.
--  Single-user, password-protected. Row Level Security is ON;
--  every table only allows access to logged-in (authenticated) users.
-- ============================================================

-- TASKS ------------------------------------------------------
create table if not exists tasks (
  id         uuid primary key default gen_random_uuid(),
  content    text not null,
  category   text,                                  -- legal | finance | content | products | opsec | business
  priority   int  default 0,
  starred    boolean default false,
  status     text default 'active' check (status in ('active','done','archived')),
  view       text default 'today'  check (view in ('today','week','month')),
  created_at timestamptz default now()
);

-- HABITS (nested via parent_id) ------------------------------
create table if not exists habits (
  id        uuid primary key default gen_random_uuid(),
  name      text not null,
  parent_id uuid references habits(id) on delete cascade,
  date      date not null default current_date,
  completed boolean default false
);

-- JOURNAL ----------------------------------------------------
create table if not exists journal (
  id             uuid primary key default gen_random_uuid(),
  date           date not null default current_date,
  raw_transcript text,
  ai_summary     text,
  created_at     timestamptz default now()
);

-- NUTRITION --------------------------------------------------
create table if not exists nutrition (
  id       uuid primary key default gen_random_uuid(),
  meal     text not null,
  calories int,
  protein  int,
  eaten_at timestamptz default now()
);

-- HEALTH (daily totals) --------------------------------------
create table if not exists health (
  id              uuid primary key default gen_random_uuid(),
  date            date not null default current_date,
  total_calories  int,
  total_protein   int
);

-- GOALS ------------------------------------------------------
create table if not exists goals (
  id         uuid primary key default gen_random_uuid(),
  content    text not null,
  period     text check (period in ('week','month')),
  created_at timestamptz default now()
);

-- FINANCE ----------------------------------------------------
create table if not exists finance (
  id     uuid primary key default gen_random_uuid(),
  label  text not null,
  amount numeric,
  as_of  timestamptz default now()
);

-- ============================================================
--  ROW LEVEL SECURITY
--  Turn RLS on for every table, then allow any authenticated
--  user full access. Because this is a single-user app, that
--  one user is you.
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array['tasks','habits','journal','nutrition','health','goals','finance']
  loop
    execute format('alter table %I enable row level security;', t);
    execute format($f$
      create policy "authenticated_all_%1$s" on %1$I
        for all
        to authenticated
        using (true)
        with check (true);
    $f$, t);
  end loop;
end $$;
