-- יום שלישי 29.9: אייל ויערה עולים לצפון האגם (מפלי ורונה וריבה), השאר ב-Movieland.
-- פעילות משותפת יכולה עכשיו להיות מוסתרת ממשפחות מסוימות.
alter table public.activities add column if not exists hidden_for text[] not null default '{}';

insert into public.places (id, name, name_he, kind, lat, lng, address, rain_plan, main, sort, notes) values
  ('foci_rita', 'Ristorante alle Foci da Rita', 'מסעדת Foci da Rita', 'food', 45.9120449, 10.8365826, 'Località Le Foci, Tenno TN', false, false, 24,
   'שתי דקות מהמפלים. המטבח נסגר ב-14:30.'),
  ('riva', 'Riva del Garda · Piazza III Novembre', 'ריבה דל גארדה', 'city', 45.8848727, 10.8396781, 'Piazza III Novembre, Riva del Garda', false, false, 25,
   'מרכז שטוח ונוח לעגלות. חניה: Parcheggio Terme Romane.'),
  ('sabbioni', 'Spiaggia dei Sabbioni', 'פארק Sabbioni', 'park', 45.8810296, 10.8495024, 'Spiaggia dei Sabbioni, Riva del Garda', false, false, 26,
   'פארק על האגם: דשא, מתקנים וברבורים.'),
  ('gelateria_flora', 'Gelateria Flora', 'גלידה Flora', 'cafe', 45.8813581, 10.8546579, 'Viale Rovereto 54, Riva del Garda', false, false, 27, null)
on conflict (id) do update set name = excluded.name, name_he = excluded.name_he, kind = excluded.kind, lat = excluded.lat, lng = excluded.lng,
  address = excluded.address, notes = excluded.notes;

update public.days set subtitle = 'פארק סרטים · אייל ויערה בצפון האגם' where date = '2026-09-29';

-- Movieland והבריכה לא רלוונטיים למשפחה של אייל ביום הזה; הערב על האש נשאר לכולם
update public.activities set hidden_for = array['eyal']
where day = '2026-09-29' and place_id in ('movieland', 'hotel') and start_time < '18:00';

delete from public.activities where day = '2026-09-29' and household_id = 'eyal';
insert into public.activities (day, start_time, end_time, title, place_id, household_id, notes, sort) values
  ('2026-09-29', '11:30', '13:00', 'נסיעה צפונה', 'foci_rita', 'eyal',
   'כשעה וחצי עם תנועה. כוונו את ה-GPS ישר למסעדה, לא למפלים.', 11),
  ('2026-09-29', '13:00', '14:15', 'צהריים ב-Foci da Rita', 'foci_rita', 'eyal',
   'לאכול לפני המפלים. אחרי 14:30 המטבחים באיטליה נסגרים.', 12),
  ('2026-09-29', '14:30', '15:45', 'מפלי ורונה', 'varone', 'eyal',
   'יש מדרגות: מנשא לתינוק עדיף על עגלה. לקחת קפוצ''ונים, בפנים רטוב וקריר.', 13),
  ('2026-09-29', '16:00', '17:15', 'מרכז ריבה וגלידה', 'riva', 'eyal',
   'Piazza III Novembre, גלידה ב-Gelateria Flora. חניה: Parcheggio Terme Romane.', 14),
  ('2026-09-29', '17:15', '18:30', 'פארק Sabbioni', 'sabbioni', 'eyal',
   'דשא ומתקנים על שפת האגם.', 15),
  ('2026-09-29', '18:30', '20:00', 'חזרה למוניגה', 'hotel', 'eyal',
   'כשעה וחצי. מגיעים לסוף הערב על האש.', 16);
