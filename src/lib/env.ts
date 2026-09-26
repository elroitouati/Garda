export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
export const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined
/** מצב הדגמה מקומי לפיתוח בלבד (VITE_DEMO=1). בבילד רגיל הקוד הזה נמחק. */
export const DEMO = import.meta.env.VITE_DEMO === '1'
export const CONFIGURED = DEMO || Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)
