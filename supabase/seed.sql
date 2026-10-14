-- ============================================================
--  Life OS — optional sample data
--  Run this AFTER schema.sql if you want the dashboard to show
--  live rows immediately (instead of empty panels) while you try
--  it out. Everything here matches the shapes in schema.sql.
--
--  Safe to re-run: it clears the sample rows first. Delete this
--  file (or just don't run it) once you're entering real data.
-- ============================================================

-- Start clean so re-running doesn't pile up duplicates.
truncate tasks, habits, journal, nutrition, health, goals, finance;

-- TASKS — `starred` + view='today' feeds the Key Tasks panel;
-- `view` buckets feed the Kanban columns; `category` feeds Brain counts.
insert into tasks (content, category, priority, starred, view) values
  ('Send investment proposal to client',      'business', 9, true,  'today'),
  ('Review Q3 portfolio for risk exposure',   'finance',  8, true,  'today'),
  ('Ship dashboard v1.1 nutrition fix',       'products', 6, false, 'today'),
  ('Draft 3 X threads on AI agents',          'content',  5, false, 'week'),
  ('Renew company compliance filing',         'legal',    7, false, 'week'),
  ('Set up cold-storage wallet backup',       'opsec',    4, false, 'month'),
  ('Outline follow-on finance video',         'content',  3, false, 'month');

-- HABITS — parent rows are groups (parent_id null), child rows are the
-- checkable habits. `date` defaults to today, so re-running seeds "today".
with g as (
  insert into habits (name, parent_id) values
    ('Morning',     null),
    ('Supplements', null),
    ('Deep work',   null),
    ('Comms',       null),
    ('Build',       null)
  returning id, name
)
insert into habits (name, parent_id, completed)
select item, g.id, false
from g
join (values
  ('Morning',     'Warm-up'),
  ('Morning',     'Lift'),
  ('Morning',     'Stretch'),
  ('Supplements', 'Creatine'),
  ('Supplements', 'Omega-3'),
  ('Supplements', 'Vit D'),
  ('Supplements', 'Magnesium'),
  ('Deep work',   'Scroll X'),
  ('Deep work',   'Market research'),
  ('Deep work',   'Ideate'),
  ('Comms',       'Reply DMs'),
  ('Comms',       'Engage comments'),
  ('Build',       'Portfolio'),
  ('Build',       'Risk scan'),
  ('Build',       'Dashboard')
) as items(grp, item) on items.grp = g.name;

-- JOURNAL — latest entry shows in the Journal panel.
insert into journal (date, raw_transcript, ai_summary) values
  (current_date - 1,
   'Strong creative output in the morning; closed the client call well. Energy dipped after a late lunch.',
   'Strong creative output in the morning; closed the client call well. Energy dipped after a late lunch — note the carb crash pattern.');

-- NUTRITION — today's meals feed the list and the totals tiles.
insert into nutrition (meal, calories, protein) values
  ('Chicken & rice',          550, 46),
  ('Greek yogurt + berries',  210, 18);

-- GOALS — period='month' feeds the Goals panel.
insert into goals (content, period) values
  ('Ship the OS mobile PWA', 'month'),
  ('Publish 20 videos',      'month'),
  ('Gym every day',          'month'),
  ('Close 2 enterprise deals','month');

-- FINANCE — the dashboard reads latest `net_worth`, `month`, `day` by
-- label, and draws the sparkline from the `net_worth` history.
insert into finance (label, amount, as_of) values
  ('net_worth', 2300000, now() - interval '9 days'),
  ('net_worth', 2355000, now() - interval '7 days'),
  ('net_worth', 2402000, now() - interval '5 days'),
  ('net_worth', 2441000, now() - interval '3 days'),
  ('net_worth', 2481300, now()),
  ('month',      184000, now()),
  ('day',         56210, now());
