-- ============================================================
--  Life OS — optional starter data
--  Run this AFTER schema.sql if you want the dashboard to show
--  something on first load. Everything here is safe to edit or
--  delete later from the app itself.
--  Supabase Studio → SQL Editor → New query → paste → Run.
-- ============================================================

-- FINANCE PULSE ---------------------------------------------
-- The dashboard reads three labelled rows. Edit the amounts to
-- your real numbers (or just leave them — they only show when
-- you press "Reveal").
insert into finance (label, amount) values
  ('net_worth', 0),
  ('month',     0),
  ('day',       0);

-- GOALS (this month) ----------------------------------------
insert into goals (content, period) values
  ('Ship the OS mobile PWA', 'month'),
  ('Publish 20 videos',      'month'),
  ('Gym every day',          'month');

-- A couple of starter tasks so the Key Tasks + Kanban panels
-- aren't empty. `starred` tasks show in Key Tasks; `view`
-- places them in the Kanban columns.
insert into tasks (content, category, priority, starred, view) values
  ('Send investment proposal to client', 'business', 3, true,  'today'),
  ('Review Q3 portfolio for risk',       'finance',  2, false, 'week'),
  ('Set up cold-storage wallet backup',  'opsec',    1, false, 'month');
