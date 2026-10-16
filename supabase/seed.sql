-- ============================================================
--  Life OS — optional seed data
--  Run this AFTER schema.sql, in Supabase Studio → SQL Editor,
--  to populate the dashboard with starter rows so every panel
--  shows live data instead of empty states.
--  Safe to edit or delete any of these rows afterwards.
-- ============================================================

-- TASKS — a few starred "key tasks" plus items across the kanban views.
insert into tasks (content, category, priority, starred, view) values
  ('Send investment proposal to client', 'business', 3, true,  'today'),
  ('Review Q3 portfolio for risk exposure', 'finance', 2, true, 'today'),
  ('Ship dashboard v1.1 nutrition fix', 'products', 1, true,   'today'),
  ('Draft 3 X threads on AI agents', 'content', 0, false,      'week'),
  ('Renew company compliance filing', 'legal', 0, false,       'week'),
  ('Set up cold-storage wallet backup', 'opsec', 0, false,     'month'),
  ('Outline follow-on finance video', 'content', 0, false,     'month');

-- HABITS — parent groups (parent_id null) with child items.
-- Children carry the `completed` flag the dashboard toggles.
do $$
declare
  g_morning uuid;
  g_supp    uuid;
  g_deep    uuid;
  g_comms   uuid;
  g_build   uuid;
begin
  insert into habits (name) values ('Morning')     returning id into g_morning;
  insert into habits (name) values ('Supplements') returning id into g_supp;
  insert into habits (name) values ('Deep work')   returning id into g_deep;
  insert into habits (name) values ('Comms')       returning id into g_comms;
  insert into habits (name) values ('Build')       returning id into g_build;

  insert into habits (name, parent_id) values
    ('Warm-up', g_morning), ('Lift', g_morning), ('Stretch', g_morning),
    ('Creatine', g_supp), ('Omega-3', g_supp), ('Vit D', g_supp), ('Magnesium', g_supp),
    ('Scroll X', g_deep), ('Market research', g_deep), ('Ideate', g_deep),
    ('Reply DMs', g_comms), ('Engage comments', g_comms),
    ('Portfolio', g_build), ('Risk scan', g_build), ('Dashboard', g_build);
end $$;

-- GOALS — this month's goals.
insert into goals (content, period) values
  ('Ship the OS mobile PWA', 'month'),
  ('Publish 20 videos', 'month'),
  ('Gym every day', 'month'),
  ('Close 2 enterprise deals', 'month');

-- NUTRITION — a couple of meals logged today.
insert into nutrition (meal, calories, protein) values
  ('Chicken & rice', 550, 46),
  ('Greek yogurt + berries', 210, 18);

-- FINANCE — the three labelled figures the Finance Pulse panel reads.
insert into finance (label, amount) values
  ('net_worth', 2481300),
  ('month_change', 184000),
  ('day_change', 56210);

-- JOURNAL — yesterday's entry.
insert into journal (date, raw_transcript, ai_summary) values
  (current_date - 1,
   'Strong creative output in the morning; closed the client call well. Energy dipped after a late lunch.',
   'Strong creative output in the morning; closed the client call well. Energy dipped after a late lunch — note the carb crash pattern.');
