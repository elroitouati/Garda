export function SetupNeeded() {
  return (
    <main className="mx-auto max-w-md p-6 pt-safe">
      <h1 className="mt-10 text-2xl">האפליקציה עוד לא מחוברת</h1>
      <p className="mt-2 text-muted">חסרים משתני הסביבה של Supabase. צריך להגדיר את <code dir="ltr">VITE_SUPABASE_URL</code> ואת <code dir="ltr">VITE_SUPABASE_ANON_KEY</code> ב-Vercel ולפרוס מחדש.</p>
    </main>
  )
}
