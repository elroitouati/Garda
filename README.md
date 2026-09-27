# טואטי בגארדה

אפליקציית ווב (PWA) לטיול המשפחתי לאגם גארדה, 27.9–4.10.2026: מפה, לו"ז, מידע חיוני וכרטיס חירום.
Vite, React, TypeScript, Tailwind, Supabase, Mapbox GL JS v3, Vercel.

## הדרך הקצרה: הקמה אוטומטית

צריך רק שלושה טוקנים כמשתני סביבה. כל השאר נעשה אוטומטית:

| משתנה | מאיפה |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | supabase.com/dashboard/account/tokens → Generate new token |
| `VERCEL_TOKEN` | vercel.com/account/tokens → Create |
| `MAPBOX_TOKEN` | account.mapbox.com → Default public token (מתחיל ב-`pk.`) |

```bash
npm run setup
```

הסקריפט יוצר פרויקט Supabase, מריץ את הסכמה וה-seed, מפעיל כניסה אנונימית, קובע קוד משפחתי ומדפיס אותו, בונה ופורס ל-Vercel, ומדפיס את הקישור. אפשר להריץ אותו שוב בכל עדכון, והוא לא יוצר כפילויות.

## צ'ק-ליסט ידני (אם לא משתמשים בסקריפט)

| # | שירות | מה לעשות | לאן זה הולך |
|---|---|---|---|
| 1 | **Supabase** | פרויקט חדש (אזור `eu-central-1` / Frankfurt). ב-**Authentication → Sign In / Providers** להפעיל **Allow anonymous sign-ins**. | `VITE_SUPABASE_URL` ו-`VITE_SUPABASE_ANON_KEY` מ-**Project Settings → API** |
| 2 | **Mapbox** | חשבון, ואז **Access tokens → Create token** עם ה-scopes הציבוריים בלבד. ב-URL restrictions להוסיף את הדומיין של Vercel (ו-`localhost` לפיתוח). | `VITE_MAPBOX_TOKEN` (מתחיל ב-`pk.`) |
| 3 | **Vercel** | Import לריפו הזה מ-GitHub. Framework: Vite. להגדיר את שלושת המשתנים ב-**Settings → Environment Variables**. | משתני סביבה ב-Vercel |
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
npm run geocode    # אימות קואורדינטות ה-seed מול Mapbox Geocoding
```

**שעון בדיקה:** מוסיפים לכתובת `?now=2026-09-28T11:20` כדי לראות איך האפליקציה נראית ברגע מסוים בטיול (שעון איטליה). `?now=real` מחזיר לשעון האמיתי.

## החלטות שכדאי להכיר

- **כל השעות לפי שעון איטליה.** לכן הטיסה הלוך רשומה ב-09:50 (10:50 שעון ישראל), והנחיתה בחזור ב-17:00 (18:00 שעון ישראל). ההערות בלו"ז מציינות את זה.
- **אבטחה:** הקוד נבדק רק בשרת (`check_pin` / `join_family`), עם הגבלה של 8 ניסיונות שגויים לטלפון ו-60 בסך הכול לכל רבע שעה. בלי שורה בטבלת `devices` אי אפשר לקרוא אף טבלה. מידע חיוני מוצג רק למשפחה שלו, גם למנהלים.
- **אופליין:** כל הנתונים נשמרים בטלפון אחרי כל טעינה. הלו"ז, המידע החיוני וכרטיס החירום עובדים בלי קליטה. המפה עצמה צריכה רשת.
- **קואורדינטות:** אומתו מול OpenStreetMap. `International Kart Indoor` נמצא בפועל במוניגה (Via Pergola, Loc. Levada) ולא בדזנצאנו. המלון ממוקם לפי הסימון של Park Residence Il Gabbiano ב-OSM.
