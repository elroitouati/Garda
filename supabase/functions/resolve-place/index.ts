// מקבל קישור של Google Maps (גם קצר: maps.app.goo.gl) ומחזיר קואורדינטות ושם המקום.
// רק קישורים של גוגל, כדי שהפונקציה לא תשמש כפרוקסי כללי.
const ALLOWED = /^(maps\.app\.goo\.gl|goo\.gl|g\.co|(www\.|maps\.)?google\.[a-z.]+|consent\.google\.[a-z.]+)$/i
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type' }

type Hit = { lat: number; lng: number; name: string | null }

function fromUrl(u: string): Hit | null {
  let s = u
  try { s = decodeURIComponent(u) } catch { /* ignore */ }
  const name = (() => {
    const m = s.match(/\/place\/([^/@?]+)/)
    return m ? m[1].replace(/\+/g, ' ').trim() : null
  })()
  const precise = s.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/)
  if (precise) return { lat: +precise[1], lng: +precise[2], name }
  const q = s.match(/[?&](?:q|query|ll|center|destination|daddr)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/)
  if (q) return { lat: +q[1], lng: +q[2], name }
  const search = s.match(/\/(?:search|dir\/[^/]*)\/(-?\d+\.\d+),\s*(-?\d+\.\d+)/)
  if (search) return { lat: +search[1], lng: +search[2], name }
  const at = s.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
  if (at) return { lat: +at[1], lng: +at[2], name }
  return null
}

function nameOf(u: string): string | null {
  let s = u
  try { s = decodeURIComponent(u) } catch { /* ignore */ }
  const m = s.match(/\/place\/([^/@?]+)/) ?? s.match(/[?&](?:q|query)=([^&]+)/)
  return m ? m[1].replace(/\+/g, ' ').trim() : null
}

async function geocode(q: string): Promise<Hit | null> {
  // Photon (עדיפות לאזור האגם), ואם לא – Nominatim
  try {
    const r = await fetch(`https://photon.komoot.io/api/?limit=1&lat=45.6&lon=10.65&q=${encodeURIComponent(q)}`)
    const f = (await r.json())?.features?.[0]
    if (f) return { lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0], name: q }
  } catch { /* ignore */ }
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&viewbox=10.3,46.1,11.1,45.3&q=${encodeURIComponent(q)}`, { headers: { 'User-Agent': 'tuati-garda/1.0 (family trip app)' } })
    const j = await r.json()
    if (j?.[0]) return { lat: +j[0].lat, lng: +j[0].lon, name: q }
  } catch { /* ignore */ }
  return null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
  const input = new URL(req.url).searchParams.get('url') ?? ''
  let cur: URL
  try { cur = new URL(input) } catch { return json({ error: 'bad_url' }, 400) }

  const seen: string[] = []
  for (let i = 0; i < 8; i++) {
    if (!ALLOWED.test(cur.hostname)) return json({ error: 'not_google' }, 400)
    seen.push(cur.href)
    const hit = fromUrl(cur.href)
    if (hit) return json(hit)
    // דף ההסכמה של גוגל (מאירופה) מחזיק את הקישור האמיתי ב-continue
    const cont = cur.searchParams.get('continue')
    if (cont) { try { cur = new URL(cont); continue } catch { /* ignore */ } }
    const r = await fetch(cur.href, { redirect: 'manual', headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36' } })
    const loc = r.headers.get('location')
    if (loc) { cur = new URL(loc, cur); continue }
    // בלי הפניה: מחפשים קואורדינטות בתוך הדף
    const html = await r.text()
    const m = html.match(/@(-?\d+\.\d{4,}),(-?\d+\.\d{4,})/) ?? html.match(/\[null,null,(-?\d+\.\d{4,}),(-?\d+\.\d{4,})\]/)
    if (m) return json({ lat: +m[1], lng: +m[2], name: nameOf(cur.href) })
    break
  }
  const name = seen.map(nameOf).find(Boolean)
  if (name) { const g = await geocode(name); if (g) return json(g) }
  return json({ error: 'no_coords' }, 404)
})
