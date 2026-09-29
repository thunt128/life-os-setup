-- ============================================================
--  Life OS — optional sample data
--  Run this AFTER schema.sql if you want the dashboard to show
--  live example rows (instead of empty panels) while testing
--  Phase 2. Everything here is safe to delete later.
--  Supabase Studio → SQL Editor → New query → Run.
-- ============================================================

-- TASKS ------------------------------------------------------
-- Starred + active tasks appear in "Key Tasks". The `view`
-- column drives which Kanban column they land in.
insert into tasks (content, category, priority, starred, view) values
  ('Send investment proposal to client', 'business', 30, true,  'today'),
  ('Review Q3 portfolio for risk exposure', 'finance', 20, true,  'today'),
  ('Ship dashboard v1.1 nutrition fix', 'products', 10, true,  'today'),
  ('Draft 3 X threads on AI agents', 'content', 5, false, 'week'),
  ('Renew company compliance filing', 'legal', 5, false, 'week'),
  ('Set up cold-storage wallet backup', 'opsec', 5, false, 'month'),
  ('Outline follow-on finance video', 'content', 5, false, 'month');

-- HABITS (nested: a parent group + its child items for today) --
with g as (
  insert into habits (name, parent_id) values ('Morning', null) returning id
)
insert into habits (name, parent_id)
select v.name, g.id from g, (values ('Warm-up'), ('Lift'), ('Stretch')) as v(name);

with g as (
  insert into habits (name, parent_id) values ('Supplements', null) returning id
)
insert into habits (name, parent_id)
select v.name, g.id from g, (values ('Creatine'), ('Omega-3'), ('Vit D'), ('Magnesium')) as v(name);

with g as (
  insert into habits (name, parent_id) values ('Deep work', null) returning id
)
insert into habits (name, parent_id)
select v.name, g.id from g, (values ('Scroll X'), ('Market research'), ('Ideate')) as v(name);

with g as (
  insert into habits (name, parent_id) values ('Comms', null) returning id
)
insert into habits (name, parent_id)
select v.name, g.id from g, (values ('Reply DMs'), ('Engage comments')) as v(name);

with g as (
  insert into habits (name, parent_id) values ('Build', null) returning id
)
insert into habits (name, parent_id)
select v.name, g.id from g, (values ('Portfolio'), ('Risk scan'), ('Dashboard')) as v(name);

-- GOALS ------------------------------------------------------
insert into goals (content, period) values
  ('Ship the OS mobile PWA', 'month'),
  ('Publish 20 videos', 'month'),
  ('Gym every day', 'month'),
  ('Close 2 enterprise deals', 'month');

-- NUTRITION (today's meals) ----------------------------------
insert into nutrition (meal, calories, protein) values
  ('Chicken & rice', 550, 46),
  ('Greek yogurt + berries', 210, 18);

-- FINANCE (the Finance Pulse panel reads these labels) -------
insert into finance (label, amount) values
  ('net_worth', 2481300),
  ('month', 184000),
  ('day', 56210);

-- JOURNAL ----------------------------------------------------
insert into journal (raw_transcript, ai_summary) values
  ('Strong creative output in the morning; closed the client call well. Energy dipped after a late lunch.',
   'Strong creative output in the morning; closed the client call well. Energy dipped after a late lunch — note the carb crash pattern.');
