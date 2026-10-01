// פתיחה מהתראה: ?story=2026-09-29 (הסיפור של היום) או ?wrapped=1
export type OpenRequest = { story: string } | { wrapped: true } | { journey: true }
const KEY = 'garda-open'

function parse(search: string): OpenRequest | null {
  const sp = new URLSearchParams(search)
  const story = sp.get('story')
  if (story && /^\d{4}-\d{2}-\d{2}$/.test(story)) return { story }
  if (sp.has('wrapped')) return { wrapped: true }
  if (sp.has('journey')) return { journey: true }
  return null
}

/** בטעינה: שומרים את הבקשה עד שהמשתמש בפנים, ומנקים את הכתובת */
export function captureOpen() {
  const r = parse(location.search)
  if (!r) return
  try { sessionStorage.setItem(KEY, JSON.stringify(r)) } catch { /* ignore */ }
  history.replaceState(null, '', location.pathname)
}
export function takeOpen(): OpenRequest | null {
  try { const t = sessionStorage.getItem(KEY); sessionStorage.removeItem(KEY); return t ? JSON.parse(t) : null } catch { return null }
}
/** כשהאפליקציה כבר פתוחה, ה-Service Worker שולח את הקישור מההתראה */
export function onOpenMessage(cb: (r: OpenRequest) => void) {
  const h = (e: MessageEvent) => {
    if (e.data?.type !== 'garda-open') return
    try { const r = parse(new URL(e.data.url, location.href).search); if (r) cb(r) } catch { /* ignore */ }
  }
  navigator.serviceWorker?.addEventListener('message', h)
  return () => navigator.serviceWorker?.removeEventListener('message', h)
}
