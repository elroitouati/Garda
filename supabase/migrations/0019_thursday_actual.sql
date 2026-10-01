-- חמישי 1.10 כפי שהיה בפועל: הפלגה, גלידות, ערב דגים ואזכרה למילן
update public.days set title = 'הפלגה ואזכרה למילן', subtitle = 'הפלגה, גלידות וערב דגים', center_place_id = 'port_moniga' where date = '2026-10-01';
delete from public.activities where day = '2026-10-01';
insert into public.activities (day, start_time, end_time, title, place_id, notes, sort) values
  ('2026-10-01', '13:30', '16:30', 'הפלגה', 'port_moniga', null, 1),
  ('2026-10-01', '16:30', '17:30', 'גלידות', null, null, 2),
  ('2026-10-01', '19:30', '22:00', 'ערב דגים ואזכרה למילן', null, null, 3);
