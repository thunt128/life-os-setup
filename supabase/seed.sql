-- ============================================================
--  Life OS — optional starter data
--  Run this AFTER schema.sql if you want the dashboard to show
--  real numbers immediately instead of empty panels. Everything
--  here is editable later from the app or from Supabase Studio.
--
--  Finance Pulse reads three rows by label: net_worth, month, day.
--  (There is no "add finance" button in the UI yet — set these
--  here or in the Supabase table editor.)
-- ============================================================

insert into finance (label, amount) values
  ('net_worth', 2481300),
  ('month',      184000),
  ('day',         56210);

-- A couple of monthly goals to start with.
insert into goals (content, period) values
  ('Ship the OS mobile PWA', 'month'),
  ('Publish 20 videos',       'month'),
  ('Gym every day',           'month'),
  ('Close 2 enterprise deals','month');

-- A couple of starred key tasks + a few kanban items.
insert into tasks (content, category, starred, view, priority) values
  ('Send investment proposal to client',      'business', true,  'today', 3),
  ('Review Q3 portfolio for risk exposure',   'finance',  true,  'today', 2),
  ('Ship dashboard v1.1 nutrition fix',       'products', true,  'today', 1),
  ('Draft 3 X threads on AI agents',          'content',  false, 'week',  0),
  ('Renew company compliance filing',         'legal',    false, 'week',  0),
  ('Set up cold-storage wallet backup',       'opsec',    false, 'month', 0),
  ('Outline follow-on finance video',         'content',  false, 'month', 0);
