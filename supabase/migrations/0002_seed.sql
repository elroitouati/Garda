-- טואטי בגארדה — נתוני פתיחה (seed)
-- קואורדינטות אומתו מול OpenStreetMap/Nominatim ב-26.9.2026. אפשר לאמת שוב מול Mapbox: npm run geocode

insert into public.households (id, name, sort) values
  ('tuati', 'יתיר ושרון', 0), ('efi', 'אפי ויפית', 1), ('eyal', 'אייל ויערה', 2), ('gil', 'גיל, אווה וליאל', 3);

insert into public.members (id, name, color, household_id, is_admin, sort) values
  ('yatir',  'יתיר',    '#C2573A', 'tuati', true,  1),
  ('sharon', 'שרון',    '#B8467A', 'tuati', false, 2),
  ('shiilo', 'שיילו',   '#2F6FB0', 'tuati', false, 3),
  ('elroi',  'אלרואי',  '#1F8A8A', 'tuati', true,  4),
  ('etel',   'אתאל',    '#9A6B12', 'tuati', false, 5),
  ('shanel', 'שנאל',    '#9C3D3D', 'tuati', false, 6),
  ('efi',    'אפי',     '#3F5FA8', 'efi',   false, 7),
  ('yafit',  'יפית',    '#476E7A', 'efi',   false, 8),
  ('lia',    'ליה',     '#6B6FB0', 'efi',   false, 9),
  ('eyal',   'אייל',    '#B7791F', 'eyal',  false, 10),
  ('yaara',  'יערה',    '#8E3B8E', 'eyal',  false, 11),
  ('gil',    'סבא גיל', '#5B6F2E', 'gil',   false, 12),
  ('eva',    'אווה',    '#A0522D', 'gil',   false, 13),
  ('liel',   'ליאל',    '#C04A6A', 'gil',   false, 14);
update public.members set initials = 'סג' where id = 'gil';
update public.members set initials = 'לל' where id = 'liel';
update public.members set initials = 'לה' where id = 'lia';

insert into public.places (id, name, name_he, kind, lat, lng, address, rain_plan, main, sort) values
  ('hotel',        'Il Gabbiano Park Residence', 'המלון',               'hotel',       45.5361752, 10.5357189, 'Via Don Carlo Nalini 12, 25080 Moniga del Garda BS', false, true, 1),
  ('port_moniga',  'Porto di Moniga',            'נמל מוניגה',          'port',        45.5210840, 10.5386576, 'Via del Porto, Moniga del Garda', false, true, 2),
  ('vista_lago',   'Vista Lago Moniga',          'קפה Vista Lago',      'cafe',        45.5221316, 10.5396616, 'Via del Porto, Moniga del Garda', false, true, 3),
  ('chiosco',      'Chiosco al Castello',        'קיוסק הטירה',         'cafe',        45.5258160, 10.5327799, 'Via Castello Secondo, Moniga del Garda', false, false, 4),
  ('castle_moniga','Castello di Moniga',         'טירת מוניגה',         'castle',      45.5262683, 10.5330461, 'Via Castello Primo, Moniga del Garda', false, true, 5),
  ('italmark',     'Italmark Moniga',            'Italmark',            'supermarket', 45.5245161, 10.5291977, 'Via San Giovanni, Moniga del Garda', false, true, 6),
  ('koshergarda',  'KosherGarda',                'KosherGarda',         'food',        45.5240524, 10.5385843, 'Via del Porto 21/23, Moniga del Garda', false, true, 7),
  ('kart_indoor',  'International Kart Indoor',  'קארטינג מקורה',       'karting',     45.5304795, 10.5304994, 'Via Pergola, Loc. Levada, Moniga del Garda', true, true, 8),
  ('sirmione',     'Sirmione · Rocca Scaligera', 'סירמיונה',            'castle',      45.4923026, 10.6085148, 'Piazza Castello, Sirmione', false, true, 9),
  ('movieland',    'Movieland Studios',          'Movieland',           'park',        45.4771229, 10.7234159, 'Via Fossalta 58, Lazise', false, true, 10),
  ('gardaland',    'Gardaland Resort',           'גארדלנד',             'park',        45.4560807, 10.7133350, 'Via Derna 4, Castelnuovo del Garda', false, true, 11),
  ('villa_cedri',  'Parco Termale Villa dei Cedri','Villa dei Cedri',   'water',       45.4742832, 10.7441178, 'Piazza di Sopra 4, Colà di Lazise', true, true, 12),
  ('bike_center',  'Garda Bike Center',          'השכרת אופניים',       'bike',        45.5392996, 10.5321561, 'Via Trevisago, Manerba del Garda', false, true, 13),
  ('varone',       'Parco Grotta Cascata Varone','מפלי ורונה',          'water',       45.9113712, 10.8338622, 'Via Cascata 12, Tenno', false, true, 14),
  ('tenno',        'Lago di Tenno',              'אגם טנו',             'water',       45.9384562, 10.8158212, 'Tenno TN', false, true, 15),
  ('south_karting','South Garda Karting',        'South Garda Karting', 'karting',     45.4250199, 10.5060644, 'Via Corte Ferrarini, Lonato del Garda', false, true, 16),
  ('aldi',         'ALDI Desenzano',             'ALDI דזנצאנו',        'supermarket', 45.4737902, 10.5276449, 'Via San Massimiliano Kolbe, Desenzano del Garda', false, true, 17),
  ('outlet',       'Franciacorta Outlet Village','אאוטלט Franciacorta', 'mall',        45.5770639, 10.1194684, 'Piazza Cascina Moie 1, Rodengo Saiano', false, true, 18),
  ('malpensa',     'Malpensa Terminal 1',        'מלפנסה טרמינל 1',     'airport',     45.6301642,  8.7038960, 'Aeroporto di Milano Malpensa, Terminal 1', false, true, 19),
  ('sealife',      'Gardaland SEA LIFE',         'Sea Life Aquarium',   'water',       45.4548182, 10.7200012, 'Castelnuovo del Garda', true, false, 20),
  ('il_leone',     'Il Leone Shopping Center',   'קניון Il Leone',      'mall',        45.4316149, 10.5140129, 'Via Mantova 36, Lonato del Garda', true, false, 21),
  ('nicolis',      'Museo Nicolis',              'Museo Nicolis',       'museum',      45.3681669, 10.8666861, 'Viale Postumia 71, Villafranca di Verona', true, false, 22),
  ('aquardens',    'Aquardens',                  'Aquardens',           'water',       45.5065936, 10.8259970, 'Via Valpolicella 63, Pescantina', true, false, 23);

insert into public.days (date, title, subtitle, center_place_id, is_shabbat) values
  ('2026-09-27', 'הגעה',            'טסים, אאוטלט, צ''ק-אין וקארטינג', 'hotel',       false),
  ('2026-09-28', 'סירמיונה',        'שייט לעיר העתיקה',              'sirmione',    false),
  ('2026-09-29', 'Movieland',       'פארק סרטים ובריכה',             'movieland',   false),
  ('2026-09-30', 'גארדלנד',         'יום מלא בפארק',                 'gardaland',   false),
  ('2026-10-01', 'יום לבחירה',      'אופניים או מפלים',              'hotel',       false),
  ('2026-10-02', 'ערב שבת',         'בוקר לבחירה והכנות לשבת',        'port_moniga', false),
  ('2026-10-03', 'שבת',             'שבת שלום',                      'castle_moniga', true),
  ('2026-10-04', 'חזרה',            'החזרת הוואן וטיסה',             'malpensa',    false);

-- כל השעות לפי שעון איטליה (Europe/Rome). ישראל מקדימה בשעה.
insert into public.activities (day, start_time, end_time, title, place_id, option_group, notes, sort) values
  ('2026-09-27', '09:50', '14:05', 'טיסה W4 6406 נתב"ג ← מלפנסה', 'malpensa', null, 'המראה 10:50 שעון ישראל · נחיתה 14:05 שעון איטליה', 1),
  ('2026-09-27', '14:30', '15:00', 'איסוף הוואן · AVIS טרמינל 1', 'malpensa', null, null, 2),
  ('2026-09-27', '15:15', '16:45', 'אאוטלט Franciacorta', 'outlet', null, null, 3),
  ('2026-09-27', '17:00', '17:45', 'צ''ק-אין במלון', 'hotel', null, 'Il Gabbiano Park Residence', 4),
  ('2026-09-27', '18:00', '19:00', 'קניות ב-Italmark', 'italmark', null, null, 5),
  ('2026-09-27', '19:30', '21:00', 'קארטינג מקורה', 'kart_indoor', null, 'International Kart Indoor', 6),

  ('2026-09-28', '06:50', '07:45', 'קפה זריחה', 'vista_lago', null, 'Vista Lago בנמל או Chiosco al Castello', 1),
  ('2026-09-28', '09:45', '10:45', 'שייט Navigarda לסירמיונה', 'port_moniga', null, 'מנמל מוניגה', 2),
  ('2026-09-28', '10:45', '15:00', 'העיר העתיקה, Rocca Scaligera, גלידה וצהריים', 'sirmione', null, null, 3),
  ('2026-09-28', '15:30', '17:00', 'שייט חזור ומנוחה', 'port_moniga', null, null, 4),

  ('2026-09-29', '10:00', '15:00', 'Movieland Studios', 'movieland', null, null, 1),
  ('2026-09-29', '15:30', '18:00', 'בריכה וג''קוזי', 'hotel', null, null, 2),
  ('2026-09-29', '18:30', '21:00', 'ערב על האש', 'hotel', null, 'בשר מ-KosherGarda', 3),

  ('2026-09-30', '10:00', '19:00', 'Gardaland Resort, יום מלא', 'gardaland', null, null, 1),
  ('2026-09-30', '20:00', '21:30', 'ערב ג''קוזי', 'hotel', null, null, 2),

  ('2026-10-01', '08:30', '12:30', 'אופניים חשמליים', 'bike_center', 'A', 'Garda Bike Center', 1),
  ('2026-10-01', '13:30', '17:30', 'Villa dei Cedri', 'villa_cedri', 'A', 'מעיינות חמים', 2),
  ('2026-10-01', '09:00', '11:30', 'מפלי ורונה', 'varone', 'B', 'Parco Grotta Cascata Varone', 3),
  ('2026-10-01', '12:30', '14:30', 'אגם טנו', 'tenno', 'B', null, 4),
  ('2026-10-01', '15:30', '16:30', 'חזרה למלון', 'hotel', 'B', null, 5),

  ('2026-10-02', '09:30', '12:00', 'סירה בלי רישיון', 'port_moniga', 'A', 'מנמל מוניגה', 1),
  ('2026-10-02', '10:00', '12:00', 'South Garda Karting', 'south_karting', 'B', 'לונאטו', 2),
  ('2026-10-02', '12:30', '14:00', 'KosherGarda וסופר', 'koshergarda', null, null, 3),
  ('2026-10-02', '15:30', '18:30', 'הכנות לשבת', 'hotel', null, null, 4),

  ('2026-10-03', '09:00', '11:30', 'תפילה', 'hotel', null, null, 1),
  ('2026-10-03', '12:00', '14:00', 'סעודת שבת', 'hotel', null, null, 2),
  ('2026-10-03', '16:30', '18:00', 'הליכה לטירה', 'castle_moniga', null, null, 3),

  ('2026-10-04', '07:00', '09:30', 'יציאה מהמלון', 'hotel', null, 'צ''ק-אאוט עד 10:00', 1),
  ('2026-10-04', '10:00', '10:45', 'החזרת הוואן · טרמינל 1', 'malpensa', null, null, 2),
  ('2026-10-04', '13:05', '17:00', 'טיסה W4 6403 מלפנסה ← נתב"ג', 'malpensa', null, 'נחיתה 18:00 שעון ישראל', 3);

-- מידע חיוני של משפחת טואטי. קודי הזמנה ומספרי פוליסה: למלא ב-SQL Editor (ראה README).
insert into public.essentials (household_id, kind, title, subtitle, fields, address, lat, lng, sort) values
  ('tuati', 'flight', 'טיסה הלוך · W4 6406', 'א׳ 27.9 · 10:50 נתב"ג ← 14:05 מלפנסה',
    '[{"label":"מספר טיסה","value":"W4 6406","copy":true},{"label":"קוד הזמנה","value":"","copy":true}]', 'Aeroporto di Milano Malpensa, Terminal 1', 45.6301642, 8.7038960, 1),
  ('tuati', 'flight', 'טיסה חזור · W4 6403', 'א׳ 4.10 · 13:05 מלפנסה ← 18:00 נתב"ג',
    '[{"label":"מספר טיסה","value":"W4 6403","copy":true},{"label":"קוד הזמנה","value":"","copy":true}]', 'Aeroporto di Milano Malpensa, Terminal 1', 45.6301642, 8.7038960, 2),
  ('tuati', 'car', 'ואן 9 מקומות · AVIS', 'דרך Argus · איסוף והחזרה במלפנסה טרמינל 1',
    '[{"label":"מספר הזמנה","value":"","copy":true},{"label":"מספר פוליסה","value":"","copy":true}]', 'Malpensa Terminal 1, AVIS', 45.6301642, 8.7038960, 3),
  ('tuati', 'hotel', 'Il Gabbiano Park Residence', 'צ׳ק-אין 27.9 · צ׳ק-אאוט 4.10 עד 10:00',
    '[{"label":"כתובת","value":"Via Don Carlo Nalini 12, 25080 Moniga del Garda","copy":true},{"label":"קוד הזמנה","value":"","copy":true}]', 'Via Don Carlo Nalini 12, 25080 Moniga del Garda', 45.5361752, 10.5357189, 4);

insert into public.emergency_contacts (household_id, name, name_latin, role, phone, sort) values
  ('tuati', 'יתיר', 'Yatir', null, '', 1),
  ('tuati', 'שרון', 'Sharon', null, '', 2);
