-- ============================================================
--  Life OS — optional seed data
--  Run this AFTER schema.sql if you want the dashboard to show
--  example rows instead of empty panels. Safe to skip.
--  Supabase Studio → SQL Editor → New query → Run.
-- ============================================================

-- TASKS ------------------------------------------------------
-- starred + view drive the "Key Tasks" and "Kanban" panels.
insert into tasks (content, category, priority, starred, view) values
  ('Send investment proposal to client',   'business', 3, true,  'today'),
  ('Review Q3 portfolio for risk exposure','finance',  2, true,  'today'),
  ('Ship dashboard v1.1 nutrition fix',    'products', 1, true,  'today'),
  ('Draft 3 X threads on AI agents',       'content',  1, false, 'week'),
  ('Renew company compliance filing',      'legal',    1, false, 'week'),
  ('Set up cold-storage wallet backup',    'opsec',    1, false, 'month');

-- HABITS -----------------------------------------------------
-- Parent rows are groups; children (parent_id set) are the checkable items.
-- `date` defaults to current_date, which is what the dashboard loads.
with grp as (
  insert into habits (name) values
    ('Morning'), ('Supplements'), ('Deep work'), ('Comms'), ('Build')
  returning id, name
)
insert into habits (name, parent_id)
select i.name, g.id
from grp g
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
) as i(group_name, name) on i.group_name = g.name;

-- GOALS ------------------------------------------------------
insert into goals (content, period) values
  ('Ship the OS mobile PWA',   'month'),
  ('Publish 20 videos',        'month'),
  ('Gym every day',            'month'),
  ('Close 2 enterprise deals', 'month');

-- NUTRITION --------------------------------------------------
insert into nutrition (meal, calories, protein) values
  ('Chicken & rice',          550, 46),
  ('Greek yogurt + berries',  210, 18);

-- FINANCE ----------------------------------------------------
-- The dashboard reads these three labels exactly: net_worth, month, day.
insert into finance (label, amount) values
  ('net_worth', 2481300),
  ('month',      184000),
  ('day',         56210);

-- JOURNAL ----------------------------------------------------
insert into journal (raw_transcript, ai_summary) values
  ('Strong creative output in the morning; closed the client call well. Energy dipped after a late lunch.',
   'Strong creative output in the morning; closed the client call well. Energy dipped after a late lunch — note the carb crash pattern.');
