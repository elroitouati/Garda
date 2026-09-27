# טואטי בגארדה

אפליקציית ווב (PWA) לטיול המשפחתי לאגם גארדה, 27.9–4.10.2026: מפה, לו"ז, מידע חיוני וכרטיס חירום.
Vite, React, TypeScript, Tailwind, Supabase, MapLibre GL, GitHub Pages.

## הקמה: חשבון אחד בלבד

- **האתר:** https://elroitouati.github.io/Garda/ (GitHub Pages, ענף `gh-pages`).
- **המפה:** MapLibre עם אריחי OpenFreeMap ותבליט מ-AWS Terrain Tiles. חינמי, בלי חשבון ובלי מפתח.
- **זמני נסיעה:** OSRM, גם הוא בלי מפתח.
- **השרת:** Supabase, החשבון היחיד שצריך.

כדי לחבר את השרת צריך רק את `SUPABASE_ACCESS_TOKEN` (מ-supabase.com/dashboard/account/tokens) כמשתנה סביבה, ואז:

```bash
npm run setup
```

הסקריפט:
1. יוצר פרויקט Supabase בפרנקפורט.
2. מריץ את הסכמה וה-seed.
3. מפעיל כניסה אנונימית.
4. קובע קוד משפחתי ומדפיס אותו (או לוקח אותו מ-`GARDA_PIN`).
5. בונה ופורס ל-GitHub Pages.

אפשר להריץ אותו שוב בכל עדכון, והוא לא יוצר כפילויות. לפריסה בלבד: `./scripts/deploy-pages.sh`.

**עד שהשרת מחובר** האתר רץ במצב הדגמה (קוד 1234): לו"ז, מפה, כרטיס חירום ומידע חיוני עובדים. שינויי ניהול ותמונות נשמרים רק בטלפון שבו נעשו.

## הקמה ידנית (אם לא משתמשים בסקריפט)

| # | שירות | מה לעשות | לאן זה הולך |
|---|---|---|---|
| 1 | **Supabase** | פרויקט חדש (אזור `eu-central-1` / Frankfurt). ב-**Authentication → Sign In / Providers** להפעיל **Allow anonymous sign-ins**. | `VITE_SUPABASE_URL` ו-`VITE_SUPABASE_ANON_KEY` מ-**Project Settings → API** |
| 4 | **VAPID** (שלב 3) | `npx web-push generate-vapid-keys` | המפתח הציבורי ב-`VITE_VAPID_PUBLIC_KEY`; הפרטי רק ב-Supabase: `supabase secrets set VAPID_PRIVATE_KEY=...` |

לפיתוח מקומי: להעתיק את `.env.example` ל-`.env` ולמלא. הקובץ `.env` לא נכנס ל-git.

## הקמת מסד הנתונים (פעם אחת)

ב-Supabase → **SQL Editor**, להריץ לפי הסדר:

1. את התוכן של `supabase/migrations/0001_schema.sql` (טבלאות, RLS, RPC, דלי תמונות).
2. את התוכן של `supabase/migrations/0002_seed.sql` (משתתפים, מקומות, לו"ז, מידע חיוני).
3. להגדיר את הקוד המשפחתי. הוא נשמר רק כ-hash:
   ```sql
   select private.set_pin('1234');  -- לשים קוד אמיתי של 4 ספרות
   ```
4. למלא קודי הזמנה ומספר פוליסה. הם נשמרים רק ב-DB, מאחורי RLS, לא בקוד:
   ```sql
   update essentials set fields = jsonb_set(fields, '{1,value}', '"ABC123"') where title like 'טיסה הלוך%';
   update essentials set fields = jsonb_set(fields, '{1,value}', '"ABC123"') where title like 'טיסה חזור%';
   update essentials set fields = jsonb_set(fields, '{0,value}', '"AVIS-XXXX"') where kind = 'car';  -- מספר הזמנה
   update essentials set fields = jsonb_set(fields, '{1,value}', '"POL-XXXX"')  where kind = 'car';  -- מספר פוליסה
   update essentials set fields = jsonb_set(fields, '{1,value}', '"HOTEL-XXXX"') where kind = 'hotel';
   ```
5. טלפונים לכרטיס החירום: אפשר מהאפליקציה (**הגדרות → ניהול הטיול → משפחות**) או ב-SQL:
   ```sql
   update emergency_contacts set phone = '+972 50 000 0000' where name = 'יתיר';
   ```

המנהלים (יתיר ואלרואי) יכולים מהאפליקציה להוסיף משתתפים ומשפחות, לערוך את הלו"ז והמקומות ולהחליף את הקוד.

## פיתוח

```bash
npm install
npm run dev        # מול Supabase אמיתי (לפי .env)
npm run dev:demo   # מצב הדגמה בלי שרת. קוד: 1234. לא נכנס לבילד של production
npm run build
npm run geocode    # אימות קואורדינטות ה-seed מול OpenStreetMap
```

**שעון בדיקה:** מוסיפים לכתובת `?now=2026-09-28T11:20` כדי לראות איך האפליקציה נראית ברגע מסוים בטיול (שעון איטליה). `?now=real` מחזיר לשעון האמיתי.

## החלטות שכדאי להכיר

- **כל השעות לפי שעון איטליה.** לכן הטיסה הלוך רשומה ב-09:50 (10:50 שעון ישראל), והנחיתה בחזור ב-17:00 (18:00 שעון ישראל). ההערות בלו"ז מציינות את זה.
- **אבטחה:** הקוד נבדק רק בשרת (`check_pin` / `join_family`), עם הגבלה של 8 ניסיונות שגויים לטלפון ו-60 בסך הכול לכל רבע שעה. בלי שורה בטבלת `devices` אי אפשר לקרוא אף טבלה. מידע חיוני מוצג רק למשפחה שלו, גם למנהלים.
- **אופליין:** כל הנתונים נשמרים בטלפון אחרי כל טעינה. הלו"ז, המידע החיוני וכרטיס החירום עובדים בלי קליטה. המפה עצמה צריכה רשת.
- **קואורדינטות:** אומתו מול OpenStreetMap. `International Kart Indoor` נמצא בפועל במוניגה (Via Pergola, Loc. Levada) ולא בדזנצאנו. המלון ממוקם לפי הסימון של Park Residence Il Gabbiano ב-OSM.
