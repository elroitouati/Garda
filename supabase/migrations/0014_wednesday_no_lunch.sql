-- רביעי 30.9: בלי צהריים ב-Foci da Rita, יוצאים ב-10:00 וכל היום מוקדם יותר
delete from public.activities where day = '2026-09-30' and place_id = 'foci_rita' and title like 'צהריים%';
update public.activities set start_time = '10:00', end_time = '11:30', place_id = 'varone',
  notes = 'כשעה וחצי עם תנועה. לנווט ישר למפלי ורונה.'
  where day = '2026-09-30' and title = 'נסיעה צפונה';
update public.activities set start_time = '11:30', end_time = '12:45' where day = '2026-09-30' and title = 'מפלי ורונה';
update public.activities set start_time = '13:00', end_time = '14:30' where day = '2026-09-30' and title = 'מרכז ריבה וגלידה';
update public.activities set start_time = '14:30', end_time = '16:00' where day = '2026-09-30' and title = 'פארק Sabbioni';
update public.activities set start_time = '16:00', end_time = '17:30' where day = '2026-09-30' and title = 'חזרה למוניגה';
