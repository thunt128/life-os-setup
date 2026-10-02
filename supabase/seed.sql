-- ============================================================
--  Life OS — optional starter data
--  Run AFTER schema.sql, in Supabase Studio → SQL Editor.
--  Everything here is optional; the app works with empty tables.
--  It just gives the dashboard something to show on first load.
-- ============================================================

-- FINANCE ----------------------------------------------------
-- The Finance Pulse panel reads three rows by `label`:
--   net_worth    → the big number
--   month_change → "Month +…"
--   day_change   → "Today +…"
-- Edit the amounts to your real figures (or leave them out —
-- missing labels simply render as $0).
insert into finance (label, amount) values
  ('net_worth',    2481300),
  ('month_change',  184000),
  ('day_change',     56210);

-- GOALS ------------------------------------------------------
-- The "Goals · This Month" panel reads rows where period = 'month'.
insert into goals (content, period) values
  ('Ship the OS mobile PWA',   'month'),
  ('Publish 20 videos',        'month'),
  ('Gym every day',            'month'),
  ('Close 2 enterprise deals', 'month');

-- TASKS ------------------------------------------------------
-- `starred` tasks surface in the Key Tasks panel; every active task
-- shows in its Kanban column (by `view`) and feeds the Brain counts
-- (by `category`).
insert into tasks (content, category, priority, starred, view) values
  ('Send investment proposal to client',   'business', 3, true,  'today'),
  ('Review Q3 portfolio for risk exposure','finance',  2, true,  'today'),
  ('Ship dashboard v1.1 nutrition fix',    'products', 1, true,  'today'),
  ('Draft 3 X threads on AI agents',       'content',  0, false, 'week'),
  ('Renew company compliance filing',      'legal',    0, false, 'week'),
  ('Set up cold-storage wallet backup',    'opsec',    0, false, 'month');
