-- ============================================================
--  Life OS — optional seed data
--  Run AFTER schema.sql, in Supabase Studio → SQL Editor.
--  This populates the live panels (Finance, Habits, Goals,
--  Kanban tasks, Nutrition, Journal) so you can see the
--  dashboard filled in. Everything here is safe to delete.
-- ============================================================

-- FINANCE — the Finance Pulse panel reads these three labels.
insert into finance (label, amount) values
  ('net_worth', 2481300),
  ('month',      184000),
  ('day',         56210);

-- GOALS — the Goals panel shows period = 'month'.
insert into goals (content, period) values
  ('Ship the OS mobile PWA', 'month'),
  ('Publish 20 videos',      'month'),
  ('Gym every day',          'month'),
  ('Close 2 enterprise deals', 'month');

-- TASKS — Key Tasks (starred) + Kanban columns (view).
insert into tasks (content, category, priority, starred, view) values
  ('Send investment proposal to client', 'business', 3, true,  'today'),
  ('Review Q3 portfolio for risk exposure', 'finance', 2, true, 'today'),
  ('Ship dashboard v1.1 nutrition fix', 'products', 1, true,  'today'),
  ('Draft 3 X threads on AI agents', 'content', 0, false, 'week'),
  ('Renew company compliance filing', 'legal', 0, false, 'week'),
  ('Set up cold-storage wallet backup', 'opsec', 0, false, 'month'),
  ('Outline follow-on finance video', 'content', 0, false, 'month');

-- HABITS — parent rows are groups, children are the checkable items.
-- All dated today so they show up in the Daily Habits panel.
do $$
declare
  gid uuid;
begin
  -- Morning
  insert into habits (name, date) values ('Morning', current_date) returning id into gid;
  insert into habits (name, parent_id, date) values
    ('Warm-up', gid, current_date),
    ('Lift', gid, current_date),
    ('Stretch', gid, current_date);

  -- Supplements
  insert into habits (name, date) values ('Supplements', current_date) returning id into gid;
  insert into habits (name, parent_id, date) values
    ('Creatine', gid, current_date),
    ('Omega-3', gid, current_date),
    ('Vit D', gid, current_date),
    ('Magnesium', gid, current_date);

  -- Deep work
  insert into habits (name, date) values ('Deep work', current_date) returning id into gid;
  insert into habits (name, parent_id, date) values
    ('Market research', gid, current_date),
    ('Ideate', gid, current_date);
end $$;

-- NUTRITION — today's meals (Nutrition panel sums these for totals).
insert into nutrition (meal, calories, protein) values
  ('Chicken & rice', 550, 46),
  ('Greek yogurt + berries', 210, 18);

-- JOURNAL — latest entry shows in the Journal panel.
insert into journal (raw_transcript, ai_summary) values
  ('Long day. Strong creative output in the morning; closed the client call well. Energy dipped after a late lunch.',
   'Strong morning output; closed the client call. Watch the post-lunch carb crash pattern.');
