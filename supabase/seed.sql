-- ============================================================
--  Life OS — optional seed data (Phase 2)
--  Run this AFTER schema.sql if you want the dashboard populated
--  with sample rows the moment you log in. Everything here is
--  safe to delete later. Run it in Supabase Studio → SQL Editor.
-- ============================================================

-- FINANCE PULSE ----------------------------------------------
-- The dashboard reads these three labels: net_worth, month, day.
insert into finance (label, amount) values
  ('net_worth', 2481300),
  ('month',      184000),
  ('day',         56210);

-- GOALS (this month) -----------------------------------------
insert into goals (content, period) values
  ('Ship the OS mobile PWA',   'month'),
  ('Publish 20 videos',        'month'),
  ('Gym every day',            'month'),
  ('Close 2 enterprise deals', 'month');

-- TASKS (feed Key Tasks, Kanban, and Brain category counts) --
insert into tasks (content, category, priority, starred, status, view) values
  ('Send investment proposal to client',     'business', 9, true,  'active', 'today'),
  ('Review Q3 portfolio for risk exposure',  'finance',  8, true,  'active', 'today'),
  ('Ship dashboard v1.1 nutrition fix',      'products', 7, true,  'active', 'today'),
  ('Draft 3 X threads on AI agents',         'content',  5, false, 'active', 'week'),
  ('Renew company compliance filing',        'legal',    6, false, 'active', 'week'),
  ('Set up cold-storage wallet backup',      'opsec',    4, false, 'active', 'month'),
  ('Outline follow-on finance video',        'content',  3, false, 'active', 'month');

-- HABITS (parent groups + nested items) ----------------------
-- Parents have parent_id = null; items reference their parent.
do $$
declare
  gid uuid;
  grp record;
  item text;
begin
  for grp in
    select * from (values
      ('Morning',     array['Warm-up','Lift','Stretch']),
      ('Supplements', array['Creatine','Omega-3','Vit D','Magnesium']),
      ('Deep work',   array['Scroll X','Market research','Ideate']),
      ('Comms',       array['Reply DMs','Engage comments']),
      ('Build',       array['Portfolio','Risk scan','Dashboard'])
    ) as g(name, items)
  loop
    insert into habits (name) values (grp.name) returning id into gid;
    foreach item in array grp.items loop
      insert into habits (name, parent_id, completed) values (item, gid, false);
    end loop;
  end loop;
end $$;

-- NUTRITION (today's meals) ----------------------------------
insert into nutrition (meal, calories, protein) values
  ('Chicken & rice',          550, 46),
  ('Greek yogurt + berries',  210, 18);

-- JOURNAL (latest entry shown on the dashboard) --------------
insert into journal (raw_transcript) values
  ('Strong creative output in the morning; closed the client call well. Energy dipped after a late lunch — note the carb crash pattern.');
