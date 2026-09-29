-- התוכנית של אייל לצפון האגם עוברת ליום רביעי 30.9, במקום גארדלנד. שלישי הפך ליום במלון.
update public.days set title = 'בריכה וקארטינג', subtitle = 'יום רגוע במוניגה', center_place_id = 'hotel' where date = '2026-09-29';
update public.days set title = 'מפלי ורונה וריבה', subtitle = 'צפון האגם', center_place_id = 'varone' where date = '2026-09-30';

delete from public.activities where day = '2026-09-30';
insert into public.activities (day, start_time, end_time, title, place_id, notes, sort) values
  ('2026-09-30', '11:30', '13:00', 'נסיעה צפונה', 'foci_rita',
   'כשעה וחצי עם תנועה. כוונו את ה-GPS ישר למסעדה, לא למפלים.', 1),
  ('2026-09-30', '13:00', '14:15', 'צהריים ב-Foci da Rita', 'foci_rita',
   'לאכול לפני המפלים. אחרי 14:30 המטבחים באיטליה נסגרים.', 2),
  ('2026-09-30', '14:30', '15:45', 'מפלי ורונה', 'varone',
   'יש מדרגות: מנשא לתינוק עדיף על עגלה. לקחת קפוצ''ונים, בפנים רטוב וקריר.', 3),
  ('2026-09-30', '16:00', '17:15', 'מרכז ריבה וגלידה', 'riva',
   'Piazza III Novembre, גלידה ב-Gelateria Flora. חניה: Parcheggio Terme Romane.', 4),
  ('2026-09-30', '17:15', '18:30', 'פארק Sabbioni', 'sabbioni',
   'דשא ומתקנים על שפת האגם.', 5),
  ('2026-09-30', '18:30', '20:00', 'חזרה למוניגה', 'hotel',
   'כשעה וחצי נסיעה.', 6);
