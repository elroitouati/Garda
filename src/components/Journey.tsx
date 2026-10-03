import * as maplibregl from 'maplibre-gl'
import { Maximize, Minimize, Pause, Play, RotateCcw, Volume2, VolumeX, X } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { distance } from '../lib/geo'
import { musicLevel, musicStart, musicStop, sfx, sfxEnable, sfxUnlock } from '../lib/sfx'
import { useStore } from '../lib/store'
import { shortDate, weekdayLetter } from '../lib/time'
import type { Day, Member, Photo } from '../lib/types'
import { photoDay } from './Album'
import { STYLE } from './MapView'

/** "המסע" נפתח לכולם כשמנהל משחרר אותו (journey.key = 'release'); עד אז רק מנהלים רואים */
export const MASA_EVENT = 'garda-masa-release'
/** מה כולם רואים: open = הסרט פתוח לכולם, end = מסך סיום (סרט ואז אלבום) */
export type MasaState = { open: boolean; end: boolean }
export const readMasa = (d: Record<string, Record<string, unknown>>): MasaState => ({ open: !!d.release?.open, end: !!d.release?.end })

type LngLat = [number, number]
type Img = { id?: string; path?: string } | null
type DayPlan = { day: Day; n: number; path: LngLat[]; media: Photo[]; caption: string }
type Stat =
  | { kind: 'count'; n: number; label: string; eyebrow?: string; }
  | { kind: 'person'; m: Member; n: number; label: string }
  | { kind: 'endless'; label: string; value: string }
type Chapter =
  | { kind: 'intro' }
  | { kind: 'day'; plan: DayPlan }
  | { kind: 'stat'; stat: Stat; first: boolean }
  | { kind: 'faces' }
  | { kind: 'finale' }

// פלטה קבועה: אותו עולם כמו הפתיח המונפש, בלי קשר למצב כהה/בהיר
const P = { ink: '#16263F', paper: '#FAF5EA', white: '#FFFDF7', red: '#D34838', blue: '#1768B0', lemon: '#F2C230' }
const BEARINGS = [-22, 16, -12, 24, -18, 12, -26, 20]
const DROP = 3.3 // מתי נופלת התמונה הראשונה (שניות מתחילת היום)
const GAP = 0.85 // בין תמונה לתמונה
const SPOTS: Record<number, [number, number, number, number][]> = { // x%, y%, סיבוב, רוחב%
  1: [[50, 50, -3, 62]],
  2: [[31, 42, -6, 48], [69, 60, 5, 48]],
  3: [[28, 33, -7, 42], [72, 38, 6, 42], [50, 70, -2, 44]],
  4: [[27, 30, -6, 37], [73, 33, 5, 37], [30, 72, 4, 37], [70, 75, -5, 37]],
  5: [[25, 29, -6, 35], [75, 31, 5, 35], [27, 74, 4, 35], [73, 76, -5, 35], [50, 52, -1, 39]],
}

const dayDur = (plan: DayPlan) => {
  const vid = plan.media.findIndex((p) => p.kind === 'video')
  const vDur = vid >= 0 ? Math.min(12, plan.media[vid].duration ?? 8) : 0
  return Math.max(DROP + plan.media.length * GAP + 2.8, vid >= 0 ? DROP + vid * GAP + vDur + 0.8 : 0, 5.5)
}
const statDur = (s: Stat) => (s.kind === 'endless' ? 5 : 3.4)
const FACES = 5.5, FINALE = 6
const MUSIC = `${import.meta.env.BASE_URL}journey/music.mp3`
const BED = 0.42 // עוצמת המוזיקה מתחת לסרט
const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`

const ll = (p: LngLat) => ({ lng: p[0], lat: p[1] })
const pathLen = (pts: LngLat[]) => pts.reduce((s, p, i) => (i ? s + distance(ll(pts[i - 1]), ll(p)) : 0), 0)
/** החלק הראשון של קו, לפי שבר מהאורך שלו */
function partOf(pts: LngLat[], k: number): LngLat[] {
  if (k >= 1 || pts.length < 2) return pts
  const total = pathLen(pts), want = total * Math.max(0, k)
  const out: LngLat[] = [pts[0]]
  let acc = 0
  for (let i = 1; i < pts.length; i++) {
    const d = distance(ll(pts[i - 1]), ll(pts[i]))
    if (acc + d >= want) { const f = d ? (want - acc) / d : 0; out.push([pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f]); return out }
    acc += d; out.push(pts[i])
  }
  return out
}
const line = (coords: LngLat[]) => ({ type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: coords.length > 1 ? coords : [] } })
const points = (coords: LngLat[]) => ({ type: 'FeatureCollection' as const, features: coords.map((c) => ({ type: 'Feature' as const, properties: {}, geometry: { type: 'Point' as const, coordinates: c } })) })

/** צביעת המפה בצבעי הגלויה, עם תבליט ותלת־ממד של ההרים */
function styleMap(map: maplibregl.Map) {
  const keep = /^(water_name_point_label|label_village|label_town|label_city)$/
  for (const l of map.getStyle()?.layers ?? []) {
    const id = l.id
    try {
      if (l.type === 'background') map.setPaintProperty(id, 'background-color', '#F3E8CF')
      else if (l.type === 'fill' && /^(park|landcover_wood)$/.test(id)) map.setPaintProperty(id, 'fill-color', '#D3E0AE')
      else if (l.type === 'fill' && /^landuse/.test(id)) map.setPaintProperty(id, 'fill-color', '#F3E8CF')
      else if (l.type === 'fill' && id === 'water') map.setPaintProperty(id, 'fill-color', '#4F9FD8')
      else if (l.type === 'line' && id === 'waterway') map.setPaintProperty(id, 'line-color', '#4F9FD8')
      else if (l.type === 'fill' && id === 'building') map.setPaintProperty(id, 'fill-color', '#E4D6B8')
      else if (l.type === 'line' && /casing/.test(id)) map.setPaintProperty(id, 'line-color', '#DCCDAA')
      else if (l.type === 'line' && /^(highway|tunnel|road)/.test(id)) map.setPaintProperty(id, 'line-color', '#FFFDF7')
      else if (l.type === 'symbol' && !keep.test(id)) map.setLayoutProperty(id, 'visibility', 'none')
      else if (l.type === 'symbol') { map.setPaintProperty(id, 'text-color', '#4A5670'); map.setPaintProperty(id, 'text-halo-color', '#F3E8CF') }
    } catch { /* שכבה שלא תומכת בתכונה */ }
  }
  const dem = { type: 'raster-dem' as const, encoding: 'terrarium' as const, tileSize: 256, maxzoom: 13, tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'] }
  if (!map.getSource('j-dem')) map.addSource('j-dem', dem)
  if (!map.getSource('j-shade')) map.addSource('j-shade', dem)
  const below = map.getStyle()?.layers?.find((l) => l.id === 'waterway' || l.id === 'building')?.id
  if (!map.getLayer('j-hills')) map.addLayer({ id: 'j-hills', type: 'hillshade', source: 'j-shade', paint: { 'hillshade-shadow-color': '#8C7A55', 'hillshade-highlight-color': '#FFF8E6', 'hillshade-exaggeration': 0.55 } }, below)
  try { map.setTerrain({ source: 'j-dem', exaggeration: 1.35 }) } catch { /* בלי תלת־ממד */ }
  map.addSource('j-route', { type: 'geojson', data: line([]) })
  map.addSource('j-stops', { type: 'geojson', data: points([]) })
  map.addLayer({ id: 'j-route-case', type: 'line', source: 'j-route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': P.white, 'line-width': 9 } })
  map.addLayer({ id: 'j-route', type: 'line', source: 'j-route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': P.red, 'line-width': 4.5 } })
  map.addLayer({ id: 'j-stops', type: 'circle', source: 'j-stops', paint: { 'circle-radius': 7, 'circle-color': P.red, 'circle-stroke-color': P.white, 'circle-stroke-width': 3 } })
}

export function Journey({ onClose, onFinale, endLabel }: { onClose: () => void; onFinale?: () => void; endLabel?: string }) {
  const { data: trip, live, api, photoUrl, signPhotos, avatarUrl } = useStore()
  const [jd, setJd] = useState<Record<string, Record<string, unknown>> | null>(null)
  useEffect(() => { api?.journeyLoad().then(setJd).catch(() => setJd({})) }, [api])
  const get = useCallback((k: string) => (jd?.[k] ?? {}) as Record<string, unknown>, [jd])

  // ── התוכן: ימים, מסלול, תמונות ומספרים ──
  const reactions = useMemo(() => {
    const m = new Map<string, number>()
    for (const l of live.likes) m.set(l.photo_id, (m.get(l.photo_id) ?? 0) + 1)
    for (const c of live.comments) m.set(c.photo_id, (m.get(c.photo_id) ?? 0) + 0.5)
    return m
  }, [live.likes, live.comments])

  const plans = useMemo<DayPlan[]>(() => {
    if (!trip || !jd) return []
    const place = (id: string | null) => trip.places.find((p) => p.id === id)
    return trip.days.map((day, i) => {
      const x = get(`day:${day.date}`)
      const ofDay = live.photos.filter((p) => photoDay(p) === day.date)
      // התמונות שנבחרו, ואם ביקשו "לפי הלבבות" משלימים מהאהובות ביותר (כולל סרטון אחד)
      const chosen: Photo[] = ((x.photoIds as string[] | undefined) ?? []).map((id) => live.photos.find((p) => p.id === id)).filter((p): p is Photo => !!p)
      const arrival = i === 0 ? (get('general').arrival as Img) : null
      if (arrival?.id) { const a = live.photos.find((p) => p.id === arrival.id); if (a && !chosen.includes(a)) chosen.unshift(a) }
      if (x.byLikes || chosen.length === 0) {
        const ranked = ofDay.filter((p) => !chosen.includes(p)).sort((a, b) => (reactions.get(b.id) ?? 0) - (reactions.get(a.id) ?? 0) || a.taken_at.localeCompare(b.taken_at))
        const vid = ranked.find((p) => p.kind === 'video')
        if (vid && !chosen.some((p) => p.kind === 'video') && chosen.length < 4) chosen.push(vid)
        for (const p of ranked) { if (chosen.length >= 4) break; if (p.kind !== 'video' && !chosen.includes(p)) chosen.push(p) }
      }
      const media = chosen.slice(0, 5).sort((a, b) => a.taken_at.localeCompare(b.taken_at))
      // המסלול האמיתי של היום: המיקומים של התמונות לפי השעה, בלי נקודות צפופות
      const path: LngLat[] = []
      for (const p of [...ofDay].sort((a, b) => a.taken_at.localeCompare(b.taken_at))) {
        if (!p.lat || !p.lng || p.loc_source === 'schedule') continue
        const c: LngLat = [p.lng, p.lat]
        if (!path.length || distance(ll(path[path.length - 1]), ll(c)) > 400) path.push(c)
      }
      if (!path.length) {
        const acts = trip.activities.filter((a) => a.day === day.date && !a.household_id).sort((a, b) => a.start_time.localeCompare(b.start_time))
        for (const a of acts) { const pl = place(a.place_id); if (pl) path.push([pl.lng, pl.lat]) }
      }
      if (!path.length) { const c = place(day.center_place_id); if (c) path.push([c.lng, c.lat]) }
      return { day, n: i + 1, path, media, caption: String(x.caption ?? '') || day.subtitle || '' }
    })
  }, [trip, jd, live.photos, reactions, get])

  const stats = useMemo<Stat[]>(() => {
    if (!trip) return []
    const vids = live.photos.filter((p) => p.kind === 'video').length
    const km = Math.round(plans.reduce((s, p, i) => s + pathLen(i ? [plans[i - 1].path[plans[i - 1].path.length - 1], ...p.path].filter(Boolean) : p.path), 0) / 1000)
    const by = new Map<string, number>()
    for (const p of live.photos) by.set(p.member_id, (by.get(p.member_id) ?? 0) + 1)
    const top = [...by.entries()].sort((a, b) => b[1] - a[1])[0]
    const topM = top && trip.members.find((m) => m.id === top[0])
    const out: Stat[] = [
      { kind: 'count', n: live.photos.length - vids, label: 'תמונות צילמנו ביחד', eyebrow: 'הטיול במספרים' },
    ]
    if (!live.photos.length) out.length = 0
    if (vids) out.push({ kind: 'count', n: vids, label: 'סרטונים' })
    if (live.likes.length) out.push({ kind: 'count', n: live.likes.length, label: `לבבות, ועוד ${live.comments.length} תגובות` })
    if (km > 5) out.push({ kind: 'count', n: km, label: 'קילומטרים על המפה' })
    if (topM) out.push({ kind: 'person', m: topM, n: top[1], label: 'הצלם של הטיול' })
    for (const r of ((get('stats').rows as { label: string; value: string }[] | undefined) ?? [])) {
      if (!r.label?.trim() || !r.value?.trim()) continue
      const n = Number(r.value.replace(/[^\d.]/g, ''))
      if (/^\s*[\d,.]+\s*$/.test(r.value) && n > 0) out.push({ kind: 'count', n, label: r.label })
      else out.push({ kind: 'endless', label: r.label, value: r.value })
    }
    return out
  }, [trip, live, plans, get])

  const chapters = useMemo<Chapter[]>(() => [
    { kind: 'intro' },
    ...plans.map((plan) => ({ kind: 'day' as const, plan })),
    ...stats.map((stat, i) => ({ kind: 'stat' as const, stat, first: i === 0 })),
    { kind: 'faces' },
    { kind: 'finale' },
  ], [plans, stats])

  // חותמים מראש את כל מה שיוצג
  useEffect(() => {
    const paths = plans.flatMap((p) => p.media.flatMap((m) => [m.path, m.thumb_path]))
    JSON.stringify(jd ?? {}, (k, v) => { if (k === 'path' && typeof v === 'string') paths.push(v); return v })
    if (paths.length) signPhotos(paths)
  }, [plans, jd]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── המפה ──
  const mapEl = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const [mapReady, setMapReady] = useState(false)
  useEffect(() => {
    if (!mapEl.current) return
    const m = new maplibregl.Map({ container: mapEl.current, style: STYLE, center: [10.68, 45.66], zoom: 8.7, pitch: 0, interactive: false, attributionControl: false, fadeDuration: 0 })
    map.current = m
    m.on('style.load', () => { styleMap(m); setMapReady(true) })
    return () => { m.remove(); map.current = null }
  }, [])

  // ── השעון: מתקדם רק כשלא בהשהיה, ומפעיל את הרמזים של הפרק ──
  const [idx, setIdx] = useState(0)
  const [paused, setPaused] = useState(false)
  const [sound, setSound] = useState(true)
  const elapsed = useRef(0)
  const fill = useRef<HTMLDivElement>(null)
  const cues = useRef<{ at: number; run: () => void; done?: boolean }[]>([])
  const durRef = useRef(Infinity)
  const pausedRef = useRef(false)
  pausedRef.current = paused
  const introRef = useRef<HTMLVideoElement>(null)
  const videos = useRef(new Map<string, HTMLVideoElement>())
  const ch = chapters[Math.min(idx, chapters.length - 1)]
  const idxRef = useRef(0)
  idxRef.current = idx
  // מאפסים את השעון מיד, כדי שפריים באמצע המעבר לא ידלג פרק נוסף
  const go = useCallback((d: number) => { elapsed.current = 0; durRef.current = Infinity; cues.current = []; const to = Math.max(0, Math.min(chapters.length - 1, idxRef.current + d)); idxRef.current = to; setIdx(to) }, [chapters.length])
  const afterIntro = useCallback(() => { if (idxRef.current === 0) go(1) }, [go])
  const jump = useCallback((to: number) => { elapsed.current = 0; durRef.current = Infinity; cues.current = []; idxRef.current = to; setIdx(to) }, [])

  // ציר זמן אחד לכל הסרט
  const [introDur, setIntroDur] = useState(18.6)
  const lens = useMemo(() => chapters.map((c) => (c.kind === 'intro' ? introDur : c.kind === 'day' ? dayDur(c.plan) : c.kind === 'stat' ? statDur(c.stat) : c.kind === 'faces' ? FACES : FINALE)), [chapters, introDur])
  const starts = useMemo(() => { let acc = 0; return lens.map((l) => { const st = acc; acc += l; return st }) }, [lens])
  const total = lens.reduce((a, b) => a + b, 0)
  const timeLabel = useRef<HTMLSpanElement>(null)
  const seek = (frac: number) => {
    const target = frac * total
    let i = 0
    while (i < chapters.length - 1 && starts[i + 1] <= target) i++
    jump(i)
    if (paused) setPaused(false)
  }

  // הפקדים נעלמים כמו בנגן וידאו, ונגיעה מחזירה אותם
  const [chrome, setChrome] = useState(true)
  const hideT = useRef(0)
  const poke = useCallback(() => { setChrome(true); clearTimeout(hideT.current); hideT.current = window.setTimeout(() => setChrome(false), 2800) }, [])
  useEffect(() => { poke(); return () => clearTimeout(hideT.current) }, [poke])
  useEffect(() => { if (paused) { clearTimeout(hideT.current); setChrome(true) } else poke() }, [paused, poke])

  // מסך מלא (בטלפונים שתומכים)
  const root = useRef<HTMLDivElement>(null)
  const [full, setFull] = useState(false)
  const canFull = typeof document !== 'undefined' && !!document.fullscreenEnabled
  useEffect(() => { const h = () => setFull(!!document.fullscreenElement); document.addEventListener('fullscreenchange', h); return () => document.removeEventListener('fullscreenchange', h) }, [])
  const toggleFull = () => { if (document.fullscreenElement) void document.exitFullscreen().catch(() => {}); else void root.current?.requestFullscreen({ navigationUI: 'hide' }).catch(() => {}) }
  useEffect(() => () => { if (document.fullscreenElement) void document.exitFullscreen().catch(() => {}) }, [])

  useEffect(() => { sfxUnlock(); return () => { musicStop(); sfxEnable(true) } }, [])
  useEffect(() => { sfxEnable(sound); videos.current.forEach((v) => { v.muted = !sound }) }, [sound])

  useEffect(() => {
    let raf = 0, last = performance.now()
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000); last = now
      if (!pausedRef.current) {
        elapsed.current += dt
        for (const c of cues.current) if (!c.done && elapsed.current >= c.at) { c.done = true; c.run() }
        if (elapsed.current >= durRef.current) { durRef.current = Infinity; go(1) }
      }
      const iv = introRef.current
      const i = idxRef.current
      const inCh = ch?.kind === 'intro' ? (iv?.currentTime ?? 0) : Math.min(elapsed.current, lens[i] ?? 0)
      const now2 = Math.min(total, (starts[i] ?? 0) + inCh)
      if (fill.current) fill.current.style.width = `${total ? (now2 / total) * 100 : 0}%`
      if (timeLabel.current) timeLabel.current.textContent = `${clock(now2)} / ${clock(total)}`
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [ch, go, lens, starts, total])

  // מסלול עד היום הזה (בלי אנימציה), למעבר קדימה/אחורה
  const routeUntil = useCallback((n: number): LngLat[] => plans.slice(0, n).flatMap((p) => p.path), [plans])
  const setRoute = (coords: LngLat[], stops: LngLat[]) => {
    const m = map.current; if (!m?.getSource('j-route')) return
    ;(m.getSource('j-route') as maplibregl.GeoJSONSource).setData(line(coords))
    ;(m.getSource('j-stops') as maplibregl.GeoJSONSource).setData(points(stops))
  }

  // ── כל פרק מגדיר משך ורמזים ──
  useLayoutEffect(() => {
    elapsed.current = 0
    videos.current.forEach((v) => v.pause())
    const m = map.current
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let anim = 0
    if (!ch) return
    // המוזיקה נכנסת אחרי הפתיח (שיש לו סאונד משלו) וממשיכה עד הסוף
    if (ch.kind === 'intro') musicLevel(0, 0.6); else if (!pausedRef.current) musicStart(MUSIC, BED)
    if (ch.kind === 'intro') { durRef.current = Infinity; cues.current = [] }
    else if (ch.kind === 'day') {
      const { plan } = ch
      const i = plan.n - 1
      const base = routeUntil(i)
      const seg: LngLat[] = [...(base.length ? [base[base.length - 1]] : []), ...plan.path]
      const stops = plans.slice(0, i).map((p) => p.path[p.path.length - 1]).filter(Boolean)
      durRef.current = dayDur(plan)
      cues.current = [
        { at: 0, run: () => {
          if (!m || !mapReady || !plan.path.length) return
          setRoute(base, stops)
          // רחפן: טיסה אל היום, ואז סיבוב איטי סביבו
          const b = plan.path.reduce((bb, p) => bb.extend(p), new maplibregl.LngLatBounds(plan.path[0], plan.path[0]))
          const H = m.getContainer().clientHeight
          const cam = m.cameraForBounds(b, { padding: { top: Math.round(H * 0.22), bottom: Math.round(H * 0.5), left: 50, right: 50 }, maxZoom: 14.2 })
          const bearing = BEARINGS[i % BEARINGS.length]
          const zoom = Math.min(cam?.zoom ?? 13, plan.path.length === 1 ? 13.6 : 14.2)
          const flight = reduce ? 0 : 3400
          m.flyTo({ center: cam?.center ?? plan.path[0], zoom, pitch: 58, bearing, duration: flight, curve: 1.55, essential: true })
          m.once('moveend', () => { if (!reduce) m.easeTo({ bearing: bearing + 16, zoom: zoom + 0.35, duration: durRef.current * 1000, easing: (t) => t }) })
          // הקו נמתח לאורך הטיסה
          const t0 = performance.now()
          const draw = (now: number) => {
            const k = reduce ? 1 : Math.min(1, (now - t0) / (flight + 600))
            setRoute([...base, ...partOf(seg, 1 - (1 - k) ** 2).slice(base.length ? 1 : 0)], k >= 1 ? [...stops, plan.path[plan.path.length - 1]] : stops)
            if (k < 1) anim = requestAnimationFrame(draw)
          }
          anim = requestAnimationFrame(draw)
        } },
        { at: 0.05, run: () => sfx.whoosh() },
        { at: 1.1, run: () => sfx.pop(true) },
        ...plan.media.map((p, k) => ({ at: DROP + k * GAP, run: () => {
          sfx.pop(k % 2 === 1)
          const v = videos.current.get(p.id)
          if (v) { v.muted = !sound; v.currentTime = 0; if (sound) musicLevel(0.1, 0.6); void v.play().catch(() => { v.muted = true; musicLevel(BED); void v.play().catch(() => {}) }) }
        } })),
      ]
    } else if (ch.kind === 'stat') {
      durRef.current = statDur(ch.stat)
      cues.current = [{ at: 0.15, run: () => (ch.stat.kind === 'person' ? sfx.pop(true) : undefined) }]
    } else if (ch.kind === 'faces') {
      durRef.current = FACES
      cues.current = (trip?.members.filter((x) => x.active) ?? []).map((_, k) => ({ at: 0.5 + k * 0.12, run: () => sfx.pop(k % 2 === 0) }))
    } else {
      durRef.current = Infinity
      cues.current = [{ at: 0.4, run: () => sfx.chime() }]
      onFinale?.()
      if (m) { m.stop(); setRoute(routeUntil(plans.length), plans.map((p) => p.path[p.path.length - 1]).filter(Boolean)) }
    }
    return () => { cancelAnimationFrame(anim); m?.stop() }
  }, [ch, mapReady]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const v = introRef.current
    if (ch?.kind !== 'intro' || !v) return
    v.muted = !sound
    if (paused) v.pause(); else void v.play().catch(() => { v.muted = true; setSound(false); void v.play().catch(afterIntro) })
  }, [ch, paused]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (ch?.kind !== 'day') return
    videos.current.forEach((v) => { if (paused) v.pause(); else if (v.currentTime > 0 && !v.ended) void v.play().catch(() => {}) })
  }, [paused, ch])
  useEffect(() => { if (ch?.kind === 'intro') return; if (paused) musicLevel(0, 0.4); else musicStart(MUSIC, BED) }, [paused]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── שליטה כמו בסרט: נגיעה מציגה/מסתירה פקדים, החצים מדלגים ──
  const tapScreen = () => { if (chrome && !paused) { clearTimeout(hideT.current); setChrome(false) } else poke() }
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'ArrowLeft') go(1); else if (e.key === 'ArrowRight') go(-1); else if (e.key === 'Escape' && !document.fullscreenElement) onClose(); else if (e.key === ' ') setPaused((p) => !p) }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [go, onClose])

  if (!trip) return null
  const img = (x: Img) => (x?.path ? photoUrl(x.path) : x?.id ? (() => { const p = live.photos.find((q) => q.id === x.id); return p ? photoUrl(p.path) ?? photoUrl(p.thumb_path) : null })() : null)
  const face = (mm: Member) => img(get(`person:${mm.id}`).face as Img) ?? avatarUrl(mm)
  const onMap = ch?.kind === 'day' || ch?.kind === 'intro'

  return (
    <div ref={root} className={`journey fixed inset-0 z-[80] select-none overflow-hidden ${paused ? 'j-paused' : ''}`} style={{ background: '#F3E8CF', color: P.ink }} dir="rtl" role="dialog" aria-modal="true" aria-label="המסע">
      <div ref={mapEl} className="absolute inset-0 transition-[filter] duration-700" style={{ filter: onMap ? 'none' : 'saturate(.6) brightness(.85)' }} />
      {ch?.kind === 'day' && <div className="pointer-events-none absolute inset-x-0 top-0 h-56" style={{ background: 'linear-gradient(rgba(22,38,63,.38), transparent)' }} />}

      <div key={idx} className="j-scene absolute inset-0">
        {ch?.kind === 'intro' && (
          <video ref={introRef} src={`${import.meta.env.BASE_URL}journey/intro.mp4`} poster={`${import.meta.env.BASE_URL}journey/intro-poster.jpg`}
            playsInline autoPlay preload="auto" className="absolute inset-0 h-full w-full object-cover" style={{ background: P.paper }}
            onEnded={afterIntro} onError={afterIntro} onLoadedMetadata={(e) => { const d = e.currentTarget.duration; if (isFinite(d) && d > 1) setIntroDur(d) }} />
        )}
        {ch?.kind === 'day' && <DayView plan={ch.plan} url={(p) => (p.kind === 'video' ? photoUrl(p.path) : photoUrl(p.path) ?? photoUrl(p.thumb_path))} poster={(p) => photoUrl(p.thumb_path)} videos={videos.current} />}
        {ch?.kind === 'stat' && <StatView stat={ch.stat} first={ch.first} photo={ch.stat.kind === 'person' ? face(ch.stat.m) : null} paused={paused} />}
        {ch?.kind === 'faces' && <FacesView members={trip.members.filter((x) => x.active).sort((a, b) => a.sort - b.sort)} households={trip.households} face={face} />}
        {ch?.kind === 'finale' && <Finale photo={img(get('general').group as Img)} onAgain={() => jump(0)} onClose={onClose} endLabel={endLabel} />}
      </div>

      {/* נגיעה במסך מציגה או מסתירה את הפקדים (בסיום יש כפתורים במקום) */}
      {ch?.kind !== 'finale' && <div className="absolute inset-0 z-10" onClick={tapScreen} onContextMenu={(e) => e.preventDefault()} />}

      <div className={`absolute inset-0 z-20 transition-opacity duration-300 ${chrome || ch?.kind === 'finale' ? 'opacity-100' : 'pointer-events-none opacity-0'}`} style={{ pointerEvents: 'none' }}>
        <div className="absolute inset-x-0 top-0 h-28" style={{ background: 'linear-gradient(rgba(22,38,63,.45), transparent)' }} />
        <div className="absolute inset-x-0 top-0 flex items-center justify-between px-3 pt-[calc(var(--safe-top)+8px)]">
          <span className="font-display text-[18px]" style={{ color: P.white, textShadow: '0 1px 8px rgba(0,0,0,.4)' }}>המסע ✈️</span>
          <button className={`grid h-11 w-11 place-items-center rounded-full ${chrome || ch?.kind === 'finale' ? 'pointer-events-auto' : ''}`} style={{ background: 'rgba(22,38,63,.55)', color: P.white }} onClick={onClose} aria-label="סגור"><X size={22} /></button>
        </div>
        {ch?.kind !== 'finale' && (
          <>
            <button className={`absolute left-1/2 top-1/2 grid h-[76px] w-[76px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full ${chrome ? 'pointer-events-auto' : ''}`} style={{ background: 'rgba(22,38,63,.6)', color: P.white, backdropFilter: 'blur(6px)' }}
              onClick={() => { sfxUnlock(); setPaused((x) => !x) }} aria-label={paused ? 'המשך' : 'השהיה'}>
              {paused ? <Play size={34} className="ms-1" fill="currentColor" /> : <Pause size={32} fill="currentColor" />}
            </button>
            <div className="absolute inset-x-0 bottom-0 px-4 pb-[calc(var(--safe-bottom)+14px)] pt-14" style={{ background: 'linear-gradient(transparent, rgba(22,38,63,.7))' }}>
              <div dir="ltr" className={`relative -my-3 py-3 ${chrome ? 'pointer-events-auto' : ''}`} onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); seek((e.clientX - r.left) / r.width); poke() }} role="slider" aria-label="ציר הזמן" aria-valuemin={0} aria-valuemax={Math.round(total)} tabIndex={0}>
                <div className="h-[4px] overflow-hidden rounded-full" style={{ background: 'rgba(255,253,247,.3)' }}>
                  <div ref={fill} className="h-full rounded-full" style={{ background: P.lemon, width: '0%' }} />
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2" dir="ltr">
                <span ref={timeLabel} className="tnum flex-1 text-[13px] font-semibold" style={{ color: P.white }}>0:00</span>
                <button className={`grid h-11 w-11 place-items-center rounded-full ${chrome ? 'pointer-events-auto' : ''}`} style={{ color: P.white }} onClick={() => { sfxUnlock(); setSound((x) => !x); poke() }} aria-label={sound ? 'השתק' : 'הפעל סאונד'}>
                  {sound ? <Volume2 size={22} /> : <VolumeX size={22} />}
                </button>
                {canFull && (
                  <button className={`grid h-11 w-11 place-items-center rounded-full ${chrome ? 'pointer-events-auto' : ''}`} style={{ color: P.white }} onClick={() => { toggleFull(); poke() }} aria-label={full ? 'יציאה ממסך מלא' : 'מסך מלא'}>
                    {full ? <Minimize size={22} /> : <Maximize size={22} />}
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/** יום: לוחית כותרת למעלה, ותמונות שנופלות כמו פולרואידים */
function DayView({ plan, url, poster, videos }: { plan: DayPlan; url: (p: Photo) => string | null; poster: (p: Photo) => string | null; videos: Map<string, HTMLVideoElement> }) {
  const spots = SPOTS[Math.max(1, plan.media.length)] ?? SPOTS[5]
  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="j-plate absolute inset-x-4 top-[calc(var(--safe-top)+66px)] mx-auto max-w-[440px] rounded-[22px] px-5 py-4" style={{ background: P.paper, boxShadow: '0 18px 40px -16px rgba(22,38,63,.55)', animationDelay: '1.1s' }}>
        <div className="flex items-center gap-2 text-[14px] font-bold" style={{ color: P.red }}>
          <span>יום {plan.n}</span><span aria-hidden>·</span><span>{weekdayLetter(plan.day.date)}</span><bdi className="tnum">{shortDate(plan.day.date)}</bdi>
        </div>
        <h2 className="mt-0.5 font-display text-[34px] leading-[1.15] [text-wrap:balance]">{plan.day.title}</h2>
        {plan.caption && <p className="mt-1 text-[16px] leading-[1.5]" style={{ color: 'rgba(22,38,63,.72)' }}>{plan.caption}</p>}
      </div>
      <div className="absolute inset-x-0 bottom-[calc(var(--safe-bottom)+18px)] mx-auto h-[50%] max-w-[440px]">
        {plan.media.map((p, k) => {
          const [x, y, r, w] = spots[k] ?? spots[0]
          const u = url(p)
          return (
            <figure key={p.id} className="j-drop absolute m-0" style={{ left: `${x}%`, top: `${y}%`, width: `${w}%`, ['--r' as string]: `${r}deg`, animationDelay: `${DROP + k * GAP}s`, zIndex: k }}>
              <div className="rounded-[6px] p-[6px] pb-[24px]" style={{ background: P.white, boxShadow: '0 22px 44px -14px rgba(0,0,0,.6)' }}>
                <div className="relative aspect-[4/5] overflow-hidden rounded-[3px]" style={{ background: '#E9E1CF' }}>
                  {p.kind === 'video'
                    ? <video ref={(v) => { if (v) videos.set(p.id, v); else videos.delete(p.id) }} src={u ?? undefined} poster={poster(p) ?? undefined} playsInline muted preload="auto" onEnded={() => musicLevel(BED)} className="absolute inset-0 h-full w-full object-cover" />
                    : u && <img src={u} alt="" className="absolute inset-0 h-full w-full object-cover" draggable={false} />}
                </div>
              </div>
            </figure>
          )
        })}
        {plan.media.length === 0 && (
          <div className="j-plate absolute inset-x-8 top-1/3 rounded-2xl px-4 py-3 text-center text-[17px] font-bold" style={{ background: 'rgba(250,245,234,.92)', animationDelay: '2.4s' }}>
            {plan.day.title === 'שבת' ? 'שבת שלום 🕯️' : 'יום בלי מצלמות. רק זיכרונות.'}
          </div>
        )}
      </div>
    </div>
  )
}

/** מספר שעולה, או "בלי סוף" שרץ מהר יותר ויותר עד אינסוף */
function StatView({ stat, first, photo, paused }: { stat: Stat; first: boolean; photo: string | null; paused: boolean }) {
  const [v, setV] = useState(0)
  const [done, setDone] = useState(false)
  const pausedRef = useRef(paused)
  pausedRef.current = paused
  useEffect(() => {
    if (stat.kind === 'person') return
    let raf = 0, e = 0, last = performance.now(), lastTick = 0
    const start = first ? 0.55 : 0.25
    const loop = (now: number) => {
      const dt = (now - last) / 1000; last = now
      if (!pausedRef.current) e += dt
      const t = e - start
      if (t > 0) {
        if (stat.kind === 'count') {
          const k = Math.min(1, t / 1.5), val = Math.round(stat.n * (1 - (1 - k) ** 3))
          setV(val)
          if (k < 1 && now - lastTick > 70) { sfx.tick(); lastTick = now }
          if (k >= 1) { setDone(true); return }
        } else {
          // טה טה טה: הקצב מאיץ, ואז אינסוף
          const val = Math.floor(Math.exp(t * 4.3))
          const gap = Math.max(28, 210 * (1 - t / 2.3))
          if (t < 2.3) { setV(val); if (now - lastTick > gap) { sfx.tick(); lastTick = now } }
          else { setDone(true); sfx.slam(); return }
        }
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [stat, first])

  return (
    <div className={`absolute inset-0 grid place-items-center px-6 ${first ? 'j-paper' : ''}`} style={{ background: P.paper }}>
      <div className="flex w-full max-w-[420px] flex-col items-center text-center">
        <div className="j-rise text-[15px] font-bold" style={{ color: P.red, animationDelay: '.1s' }}>{stat.kind === 'count' && stat.eyebrow ? stat.eyebrow : 'הטיול במספרים'}</div>
        {stat.kind === 'person' ? (
          <>
            <div className="j-pop mt-6 h-40 w-40 overflow-hidden rounded-full" style={{ boxShadow: `0 0 0 6px ${P.white}, 0 0 0 9px ${P.blue}`, background: '#E9E1CF', animationDelay: '.2s' }}>
              {photo ? <img src={photo} alt="" className="h-full w-full object-cover" /> : <span className="grid h-full w-full place-items-center font-display text-[64px]" style={{ background: stat.m.color, color: P.white }}>{stat.m.initials ?? stat.m.name[0]}</span>}
            </div>
            <div className="j-rise mt-6 text-[22px] font-bold" style={{ animationDelay: '.5s' }}>{stat.label}</div>
            <div className="j-rise font-display text-[52px] leading-[1.15]" style={{ color: P.blue, animationDelay: '.7s' }}>{stat.m.name}</div>
            <div className="j-rise tnum mt-1 text-[18px]" style={{ color: 'rgba(22,38,63,.7)', animationDelay: '.9s' }}>{stat.n} תמונות וסרטונים</div>
          </>
        ) : stat.kind === 'count' ? (
          <>
            <bdi className="tnum mt-4 font-display text-[min(30vw,128px)] leading-none" style={{ color: P.blue }}>{v.toLocaleString('he-IL')}</bdi>
            <div className="j-rise mt-4 text-[24px] font-bold leading-[1.3] [text-wrap:balance]" style={{ animationDelay: '.35s' }}>{stat.label}</div>
          </>
        ) : (
          <>
            <div className="j-rise mt-2 text-[26px] font-bold leading-[1.3] [text-wrap:balance]" style={{ animationDelay: '.15s' }}>{stat.label}</div>
            <div className="relative mt-4 grid h-[150px] w-full place-items-center">
              {!done
                ? <bdi className="tnum font-display text-[min(22vw,96px)] leading-none" style={{ color: P.blue }}>{v.toLocaleString('he-IL')}</bdi>
                : <span className="j-slam font-display text-[150px] leading-none" style={{ color: P.red }}>∞</span>}
            </div>
            {done && <div className="j-slam font-display text-[44px] leading-tight" style={{ color: P.red, animationDelay: '.12s' }}>{stat.value}</div>}
            {/גליד/.test(stat.label) && <div className="j-bob mt-3 text-[56px]" aria-hidden>🍦</div>}
          </>
        )}
      </div>
    </div>
  )
}

/** כל הפנים, משפחה אחרי משפחה */
function FacesView({ members, households, face }: { members: Member[]; households: { id: string; name: string; sort: number }[]; face: (m: Member) => string | null }) {
  const fams = [...households].sort((a, b) => a.sort - b.sort).map((h) => ({ h, ms: members.filter((m) => m.household_id === h.id) })).filter((f) => f.ms.length)
  let k = 0
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-5 pb-[calc(var(--safe-bottom)+16px)] pt-[calc(var(--safe-top)+84px)]" style={{ background: P.ink, color: P.paper }}>
      <div className="flex w-full max-w-[420px] flex-col gap-3">
        {fams.map(({ h, ms }) => (
          <div key={h.id} className="flex items-center gap-3">
            <div className="flex flex-1 flex-wrap justify-center gap-2">
              {ms.map((m) => {
                const u = face(m), d = 0.5 + k++ * 0.12
                return (
                  <div key={m.id} className="j-pop flex w-[64px] flex-col items-center gap-1" style={{ animationDelay: `${d}s` }}>
                    <div className="grid h-[54px] w-[54px] place-items-center overflow-hidden rounded-full text-[20px] font-bold" style={{ background: m.color, boxShadow: `0 0 0 3px ${P.paper}` }}>
                      {u ? <img src={u} alt="" className="h-full w-full object-cover" /> : m.initials ?? m.name[0]}
                    </div>
                    <span className="w-full truncate text-center text-[13px] font-semibold opacity-90">{m.name}</span>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="j-rise mt-1 text-center font-display text-[23px] leading-tight [text-wrap:balance]" style={{ animationDelay: `${0.8 + members.length * 0.12}s` }}>
        <bdi className="tnum">{members.length}</bdi> טואטים · <bdi className="tnum">{fams.length}</bdi> משפחות · אגם אחד
      </div>
    </div>
  )
}

function Finale({ photo, onAgain, onClose, endLabel }: { photo: string | null; onAgain: () => void; onClose: () => void; endLabel?: string }) {
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: P.ink }}>
      {photo && <img src={photo} alt="התמונה הקבוצתית" className="j-kenburns absolute inset-0 h-full w-full object-cover" />}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(22,38,63,.92) 0%, rgba(22,38,63,.55) 34%, transparent 62%)' }} />
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center px-6 pb-[calc(var(--safe-bottom)+28px)] text-center" style={{ color: P.paper }}>
        <h2 className="j-rise font-display text-[46px] leading-[1.1]" style={{ animationDelay: '.5s' }}>טואטי <span style={{ color: P.lemon }}>בגארדה</span></h2>
        <bdi className="j-rise tnum mt-1 text-[17px] opacity-85" dir="ltr" style={{ animationDelay: '.75s' }}>27.9 – 4.10.2026</bdi>
        <p className="j-rise mt-3 text-[20px] font-bold" style={{ animationDelay: '1s' }}>עד הטיול הבא ❤️</p>
        <div className="j-rise mt-6 flex w-full max-w-[360px] gap-3" style={{ animationDelay: '1.3s' }}>
          <button className="flex min-h-[50px] flex-1 items-center justify-center gap-2 rounded-2xl text-[17px] font-bold" style={{ background: P.paper, color: P.ink }} onClick={onAgain}><RotateCcw size={18} /> לצפות שוב</button>
          <button className="min-h-[50px] flex-1 rounded-2xl text-[17px] font-bold" style={{ background: 'rgba(250,245,234,.16)', color: P.paper, boxShadow: 'inset 0 0 0 1.5px rgba(250,245,234,.4)' }} onClick={onClose}>{endLabel ?? 'סגירה'}</button>
        </div>
      </div>
    </div>
  )
}
