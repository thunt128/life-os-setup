-- ============================================================
--  Life OS — optional seed data
--  Run this AFTER schema.sql, in Supabase Studio → SQL Editor.
--  It fills every panel with starter rows so the dashboard looks
--  alive on first login. Safe to edit or delete any of it later.
--  Run it once (re-running will duplicate rows).
-- ============================================================

-- TASKS ------------------------------------------------------
-- `starred` + status 'active' show in the Key Tasks panel.
-- `view` controls which Kanban column they land in.
-- `category` feeds the Brain · Life Categories counts.
insert into tasks (content, category, priority, starred, view) values
  ('Send investment proposal to client',      'business',  9, true,  'today'),
  ('Review Q3 portfolio for risk exposure',   'finance',   8, true,  'today'),
  ('Ship dashboard v1.1 nutrition fix',        'products',  7, true,  'today'),
  ('Draft 3 X threads on AI agents',           'content',   5, false, 'week'),
  ('Renew company compliance filing',          'legal',     6, false, 'week'),
  ('Set up cold-storage wallet backup',        'opsec',     4, false, 'month'),
  ('Outline follow-on finance video',          'content',   3, false, 'month');

-- HABITS -----------------------------------------------------
-- Parents (parent_id null) are groups; children are checkable items.
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
select v.item, g.id, false
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
) as v(grp, item) on v.grp = g.name;

-- GOALS ------------------------------------------------------
insert into goals (content, period) values
  ('Ship the OS mobile PWA', 'month'),
  ('Publish 20 videos',      'month'),
  ('Gym every day',          'month'),
  ('Close 2 enterprise deals', 'month');

-- FINANCE ----------------------------------------------------
-- The row whose label matches /net|worth|total/ becomes the headline.
insert into finance (label, amount) values
  ('Net worth', 2481300),
  ('Month',     184000),
  ('Today',     56210);

-- NUTRITION --------------------------------------------------
insert into nutrition (meal, calories, protein) values
  ('Chicken & rice',         550, 46),
  ('Greek yogurt + berries', 210, 18);

-- JOURNAL ----------------------------------------------------
insert into journal (raw_transcript, ai_summary) values
  ('Felt strong this morning, good creative output, closed the client call well. Energy dipped after a late lunch.',
   'Strong creative output in the morning; closed the client call well. Energy dipped after a late lunch — note the carb crash pattern.');
