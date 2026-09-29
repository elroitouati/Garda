// מקום מ-Google Maps: קישור ששותף או הודבק הופך לנקודה על המפה
export type SharedPlace = { lat: number; lng: number; name: string | null }

const URL_RE = /https?:\/\/[^\s]+/g
const GOOGLE_RE = /^https?:\/\/(maps\.app\.goo\.gl|goo\.gl|g\.co|(www\.|maps\.)?google\.[a-z.]+)\//i

export function findMapsUrl(text: string): string | null {
  return (text.match(URL_RE) ?? []).find((u) => GOOGLE_RE.test(u)) ?? null
}
export const looksLikeMaps = (text: string) => !!findMapsUrl(text)

function parse(u: string): SharedPlace | null {
  let s = u
  try { s = decodeURIComponent(u) } catch { /* ignore */ }
  const place = s.match(/\/place\/([^/@?]+)/)
  const name = place ? place[1].replace(/\+/g, ' ').trim() : null
  const m = s.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/)
    ?? s.match(/[?&](?:q|query|ll|center|destination|daddr)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/)
    ?? s.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
  return m ? { lat: +m[1], lng: +m[2], name } : null
}

/** השורה הראשונה בטקסט ששותף מגוגל מפות היא בדרך כלל שם המקום */
function nameFromText(text: string, url: string) {
  const first = text.replace(url, '').split('\n').map((l) => l.trim()).find(Boolean)
  return first && !/^https?:/.test(first) && first.length <= 60 ? first : null
}

export async function resolvePlace(text: string): Promise<SharedPlace | null> {
  const url = findMapsUrl(text)
  if (!url) return null
  const extra = nameFromText(text, url)
  const local = parse(url)
  if (local) return { ...local, name: extra ?? local.name }
  const base = import.meta.env.VITE_SUPABASE_URL as string | undefined
  if (!base) return null
  try {
    const r = await fetch(`${base}/functions/v1/resolve-place?url=${encodeURIComponent(url)}`)
    if (!r.ok) return null
    const j = await r.json()
    return typeof j.lat === 'number' ? { lat: j.lat, lng: j.lng, name: extra ?? j.name ?? null } : null
  } catch { return null }
}

// שיתוף מאפליקציית גוגל מפות ישר לאפליקציה (אנדרואיד): הטקסט מגיע בכתובת
const KEY = 'garda-shared-place'
export function captureShare() {
  const sp = new URLSearchParams(location.search)
  const text = ['title', 'text', 'url'].map((k) => sp.get(k)).filter(Boolean).join('\n')
  if (!text) return
  try { sessionStorage.setItem(KEY, text) } catch { /* ignore */ }
  history.replaceState(null, '', location.pathname)
}
export function takeShare(): string | null {
  try { const t = sessionStorage.getItem(KEY); sessionStorage.removeItem(KEY); return t } catch { return null }
}
