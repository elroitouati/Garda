// אלבום הטיול בקישור נפרד מהאפליקציה: צפייה בכל התמונות והוספת תמונות.
// הגישה רק עם המפתח שבקישור (ALBUM_KEY). התמונות נשמרות באותו אלבום של האפליקציה.
import { createClient } from 'npm:@supabase/supabase-js@2'

const env = (k: string) => Deno.env.get(k) ?? ''
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' }
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const HOTEL = { lat: 45.5361752, lng: 10.5357189 }
const VIDEO_EXT: Record<string, string> = { 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm' }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  const url = new URL(req.url)
  const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {}
  const key = url.searchParams.get('k') ?? body.k
  if (!env('ALBUM_KEY') || key !== env('ALBUM_KEY')) return json({ error: 'forbidden' }, 403)
  const sb = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'))
  const action = url.searchParams.get('a') ?? body.a

  if (action === 'list') {
    const [{ data: members }, { data: photos }, { data: days }] = await Promise.all([
      sb.from('members').select('id,name,color,sort,household_id').eq('active', true).order('sort'),
      sb.from('photos').select('id,member_id,kind,taken_at,width,height,duration,path,thumb_path').order('taken_at'),
      sb.from('days').select('date,title').order('date'),
    ])
    const list = photos ?? []
    const sign = async (paths: string[], download = false) => {
      const out: (string | null)[] = []
      for (let i = 0; i < paths.length; i += 200) {
        const { data } = await sb.storage.from('photos').createSignedUrls(paths.slice(i, i + 200), 6 * 3600, download ? { download: true } : undefined)
        out.push(...(data ?? []).map((d) => d.signedUrl ?? null))
      }
      return out
    }
    const [thumbs, fulls, downs] = await Promise.all([sign(list.map((p) => p.thumb_path)), sign(list.map((p) => p.path)), sign(list.map((p) => p.path), true)])
    return json({
      days: days ?? [],
      members: (members ?? []).map(({ id, name, color }) => ({ id, name, color })),
      photos: list.map((p, i) => ({ id: p.id, member_id: p.member_id, kind: p.kind, taken_at: p.taken_at, w: p.width, h: p.height, duration: p.duration, thumb: thumbs[i], full: fulls[i], download: downs[i] })),
    })
  }

  if (action === 'start') {
    // כתובות העלאה חתומות: התמונה המלאה והתמונה הקטנה
    const { member_id, type } = body
    const { data: m } = await sb.from('members').select('id').eq('id', member_id).eq('active', true).maybeSingle()
    if (!m) return json({ error: 'member' }, 400)
    const video = String(type ?? '').startsWith('video/')
    if (video && !VIDEO_EXT[type]) return json({ error: 'type' }, 400)
    const id = crypto.randomUUID()
    const path = `${member_id}/${id}.${video ? VIDEO_EXT[type] : 'jpg'}`
    const thumb_path = `${member_id}/${id}_t.jpg`
    const [a, b] = await Promise.all([sb.storage.from('photos').createSignedUploadUrl(path), sb.storage.from('photos').createSignedUploadUrl(thumb_path)])
    if (a.error || b.error) return json({ error: 'sign' }, 500)
    return json({ id, path, thumb_path, full: a.data.signedUrl, thumb: b.data.signedUrl })
  }

  if (action === 'commit') {
    const { id, member_id, kind, taken_at, lat, lng, width, height, duration } = body
    const video = kind === 'video'
    const { data: files } = await sb.storage.from('photos').list(member_id, { search: id })
    const names = (files ?? []).map((f) => f.name)
    const full = names.find((n) => n.startsWith(`${id}.`)), thumb = names.find((n) => n === `${id}_t.jpg`)
    if (!full || !thumb) return json({ error: 'missing' }, 400)
    const gps = typeof lat === 'number' && typeof lng === 'number' && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
    const t = taken_at && !isNaN(Date.parse(taken_at)) ? new Date(taken_at).toISOString() : new Date().toISOString()
    const { error } = await sb.from('photos').insert({
      id, member_id, path: `${member_id}/${full}`, thumb_path: `${member_id}/${thumb}`, kind: video ? 'video' : 'photo',
      lat: gps ? lat : HOTEL.lat, lng: gps ? lng : HOTEL.lng, loc_source: gps ? 'exif' : 'manual', taken_at: t,
      width: width ?? null, height: height ?? null, duration: video ? (duration ?? null) : null,
    })
    if (error) return json({ error: error.message }, 400)
    return json({ ok: true })
  }
  return json({ error: 'action' }, 400)
})
