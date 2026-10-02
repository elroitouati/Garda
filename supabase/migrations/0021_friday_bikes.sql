-- שישי 2.10: מסלול אופניים משפחתי ממוניגה לכיוון מנרבה ועצירת פיצה, ואז קניות והכנות לשבת
insert into public.places (id, name, name_he, kind, lat, lng, address, rain_plan, main, notes, sort) values
  ('mondo_ebike', 'Mondo-ebike', 'השכרת אופניים מוניגה', 'bike', 45.5270293, 10.5286486, 'Via dei Canestrelli 9, Moniga del Garda', false, true, 'אופניים רגילים, אופני ילדים ואופניים חשמליים עם מושבי ילדים', 40),
  ('manerba_rocca', 'Riserva della Rocca e del Sasso', 'שמורת מנרבה', 'park', 45.5575704, 10.5720948, 'Manerba del Garda', false, true, 'תצפית על צוק Rocca di Manerba', 41),
  ('antica_corte', 'Pizzeria Ristorante Antica Corte', 'פיצה אנטיקה קורטה', 'food', 45.5280106, 10.5363583, 'מרכז מוניגה', false, true, 'פיצה מחמצת דקה וקריספית בחצר כפרית', 42),
  ('la_pergola', 'La Pergola', 'פיצה לה פרגולה', 'food', 45.5237576, 10.5284404, 'בדרך לנמל מוניגה', false, true, 'מרפסת עם נוף לאגם', 43)
on conflict (id) do update set name = excluded.name, name_he = excluded.name_he, kind = excluded.kind, lat = excluded.lat, lng = excluded.lng, address = excluded.address, notes = excluded.notes;

update public.days set title = 'אופניים ופיצה', subtitle = 'רכיבה לאורך האגם, פיצה והכנות לשבת', center_place_id = 'mondo_ebike' where date = '2026-10-02';
delete from public.activities where day = '2026-10-02';
insert into public.activities (day, start_time, end_time, title, place_id, notes, sort) values
  ('2026-10-02', '10:00', '10:30', 'השכרת אופניים ב-Mondo-ebike', 'mondo_ebike', 'רגילים, ילדים או חשמליים עם מושבי ילדים', 1),
  ('2026-10-02', '10:30', '11:00', 'ירידה לנמל מוניגה וטיילת האגם', 'port_moniga', 'יורדים בזהירות ב-Via del Porto', 2),
  ('2026-10-02', '11:00', '12:00', 'שביל החוף לכיוון שמורת מנרבה', 'manerba_rocca', 'כרמים, זיתים ותצפית על צוק Rocca di Manerba', 3),
  ('2026-10-02', '12:00', '13:00', 'עצירת פיצה', 'antica_corte', 'או La Pergola ליד הנמל, עם נוף לאגם', 4),
  ('2026-10-02', '13:30', '14:30', 'KosherGarda וסופר', 'koshergarda', null, 5),
  ('2026-10-02', '15:30', '18:30', 'הכנות לשבת', 'hotel', null, 6);
