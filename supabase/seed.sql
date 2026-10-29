-- ============================================================
--  Life OS — optional seed data
--  Run AFTER schema.sql (Supabase Studio → SQL Editor → Run) to
--  see the dashboard populated. Everything here is example data —
--  edit or delete freely.
-- ============================================================

-- FINANCE ----------------------------------------------------
-- The Finance Pulse panel reads these three labels by name.
-- Keep the labels exactly as below; change the amounts to yours.
insert into finance (label, amount) values
  ('net_worth',    2481300),
  ('month_change',  184000),
  ('day_change',     56210);

-- TASKS ------------------------------------------------------
-- `starred` tasks show in the Key Tasks panel. `view` places a
-- task in the Kanban column (today / week / month). `category`
-- feeds the Brain · Life Categories counts.
insert into tasks (content, category, priority, starred, view) values
  ('Send investment proposal to client',    'business', 10, true,  'today'),
  ('Review Q3 portfolio for risk exposure', 'finance',   8, true,  'today'),
  ('Ship dashboard v1.1 nutrition fix',     'products',  6, true,  'today'),
  ('Draft 3 X threads on AI agents',        'content',   4, false, 'week'),
  ('Renew company compliance filing',       'legal',     3, false, 'week'),
  ('Set up cold-storage wallet backup',     'opsec',     2, false, 'month'),
  ('Outline follow-on finance video',       'content',   1, false, 'month');

-- GOALS ------------------------------------------------------
insert into goals (content, period) values
  ('Ship the OS mobile PWA',   'month'),
  ('Publish 20 videos',        'month'),
  ('Gym every day',            'month'),
  ('Close 2 enterprise deals', 'month');

-- NUTRITION --------------------------------------------------
-- Logged for "today" (eaten_at defaults to now()).
insert into nutrition (meal, calories, protein) values
  ('Chicken & rice',          550, 46),
  ('Greek yogurt + berries',  210, 18);
