-- ============================================================
--  Life OS — sample data (optional)
--  Run this AFTER schema.sql, in Supabase Studio → SQL Editor,
--  to populate the dashboard with the same sample rows the mock
--  UI used to show. Everything here is real, editable data.
--
--  Note: this inserts fresh rows each time it runs. To start
--  clean, uncomment the delete block below before running again.
-- ============================================================

-- delete from habits;
-- delete from tasks;
-- delete from goals;
-- delete from nutrition;
-- delete from journal;
-- delete from finance;

-- FINANCE — looked up by label in app/page.tsx ----------------
insert into finance (label, amount) values
  ('net_worth',    2481300),
  ('month_change',  184000),
  ('day_change',     56210);

-- GOALS ------------------------------------------------------
insert into goals (content, period) values
  ('Ship the OS mobile PWA', 'month'),
  ('Publish 20 videos',      'month'),
  ('Gym every day',          'month'),
  ('Close 2 enterprise deals','month');

-- TASKS — drive Key Tasks, Kanban (by view) and Brain counts -
insert into tasks (content, category, priority, starred, status, view) values
  ('Send investment proposal to client',   'business', 9, true,  'active', 'today'),
  ('Review Q3 portfolio for risk exposure','finance',  8, true,  'active', 'today'),
  ('Ship dashboard v1.1 nutrition fix',    'products', 7, true,  'active', 'today'),
  ('Draft 3 X threads on AI agents',       'content',  5, false, 'active', 'week'),
  ('Renew company compliance filing',      'legal',    6, false, 'active', 'week'),
  ('Set up cold-storage wallet backup',    'opsec',    4, false, 'active', 'month'),
  ('Outline follow-on finance video',      'content',  3, false, 'active', 'month');

-- NUTRITION (today) ------------------------------------------
insert into nutrition (meal, calories, protein) values
  ('Chicken & rice',          550, 46),
  ('Greek yogurt + berries',  210, 18);

-- JOURNAL ----------------------------------------------------
insert into journal (raw_transcript, ai_summary) values
  ('Strong creative output in the morning; closed the client call well. Energy dipped after a late lunch — note the carb crash pattern.',
   'Strong creative output in the morning; closed the client call well. Energy dipped after a late lunch — note the carb crash pattern.');

-- HABITS for today (group header rows + their items) ---------
-- `date` defaults to current_date, so these are today's habits.
with g as (
  insert into habits (name, parent_id, completed) values
    ('Morning',     null, false),
    ('Supplements', null, false),
    ('Deep work',   null, false),
    ('Comms',       null, false),
    ('Build',       null, false)
  returning id, name
)
insert into habits (name, parent_id, completed)
select i.name, g.id, false
from g
join (values
  ('Morning','Warm-up'), ('Morning','Lift'), ('Morning','Stretch'),
  ('Supplements','Creatine'), ('Supplements','Omega-3'), ('Supplements','Vit D'), ('Supplements','Magnesium'),
  ('Deep work','Scroll X'), ('Deep work','Market research'), ('Deep work','Ideate'),
  ('Comms','Reply DMs'), ('Comms','Engage comments'),
  ('Build','Portfolio'), ('Build','Risk scan'), ('Build','Dashboard')
) as i(group_name, name) on i.group_name = g.name;
