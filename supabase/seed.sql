-- ============================================================
--  Life OS — OPTIONAL sample data
--  Run this AFTER schema.sql if you want the dashboard to light
--  up with example rows while you try Phase 2. Everything here is
--  safe to delete later. Run it in Supabase Studio → SQL Editor.
-- ============================================================

-- Key tasks (starred = shown in the Key Tasks panel) + Kanban (by view)
insert into tasks (content, category, priority, starred, view) values
  ('Send investment proposal to client', 'business', 9, true,  'today'),
  ('Review Q3 portfolio for risk exposure', 'finance', 8, true,  'today'),
  ('Ship dashboard v1.1 nutrition fix', 'products', 7, true,  'today'),
  ('Draft 3 X threads on AI agents', 'content', 5, false, 'week'),
  ('Renew company compliance filing', 'legal', 6, false, 'week'),
  ('Set up cold-storage wallet backup', 'opsec', 4, false, 'month'),
  ('Outline follow-on finance video', 'content', 3, false, 'month');

-- Habits for today: group headers (parent_id null) + their items.
with g as (
  insert into habits (name, date) values
    ('Morning',     current_date),
    ('Supplements', current_date),
    ('Deep work',   current_date)
  returning id, name
)
insert into habits (name, parent_id, date)
select item, g.id, current_date
from g
join (values
  ('Morning',     'Warm-up'),
  ('Morning',     'Lift'),
  ('Morning',     'Stretch'),
  ('Supplements', 'Creatine'),
  ('Supplements', 'Omega-3'),
  ('Supplements', 'Vit D'),
  ('Deep work',   'Market research'),
  ('Deep work',   'Ideate')
) as x(parent, item) on x.parent = g.name;

-- Goals for the month
insert into goals (content, period) values
  ('Ship the OS mobile PWA', 'month'),
  ('Publish 20 videos', 'month'),
  ('Gym every day', 'month'),
  ('Close 2 enterprise deals', 'month');

-- Finance pulse (looked up by label: net_worth / month / today)
insert into finance (label, amount) values
  ('net_worth', 2481300),
  ('month',      184000),
  ('today',       56210);

-- Nutrition logged today
insert into nutrition (meal, calories, protein) values
  ('Chicken & rice', 550, 46),
  ('Greek yogurt + berries', 210, 18);

-- A journal entry
insert into journal (date, raw_transcript, ai_summary) values
  (current_date,
   'Strong creative output in the morning; closed the client call well. Energy dipped after a late lunch.',
   'Strong creative output in the morning; closed the client call well. Energy dipped after a late lunch — note the carb crash pattern.');
