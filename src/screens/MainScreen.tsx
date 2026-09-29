import { Camera, Check, ImagePlus, LocateFixed, MapPin, MessageCircle, Minus, Navigation, Plus, Shield, Umbrella, Video, WifiOff, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Avatar } from '../components/Avatar'
import { BottomSheet, type Snap } from '../components/BottomSheet'
import { AlbumTab } from '../components/Album'
import { Feed } from '../components/Feed'
import { Gallery } from '../components/Gallery'
import { Slideshow } from '../components/Slideshow'
import { Welcome } from '../components/Welcome'
import { EmergencyPhonePrompt, FridayCard, LocationConsent, LocationHelp, MeetingCard, MeetingComposer, MeetingPopup, PushCard, ShabbatScreen, TipCard, useWalkingRoute } from '../components/Live'
import { ComposeSheet, MessageHistory, MessagePopups } from '../components/Messages'
import { MapView, type MapHandle, type MapMeeting, type MapPerson } from '../components/MapView'
import { NextCard, NowRow } from '../components/NowNext'
import { PlaceIcon } from '../components/PlaceIcon'
import { DayChips, Essentials, FamilyStrip, RainPlan, SectionTitle, Timeline } from '../components/Sections'
import { useToast } from '../components/Toast'
import { distance, isLive, isStale } from '../lib/geo'
import { useLocationSharing } from '../lib/location'
import { initialsOf } from '../lib/members'
import { isForMe, readOf, unlockAudio } from '../lib/messages'
import { syncPush } from '../lib/push'
import { shabbatPhase } from '../lib/shabbat'
import { TIPS } from '../lib/tips'
import { googleLink, wazeLink } from '../lib/nav'
import { preparePhoto, prepareVideo } from '../lib/photos'
import { isVideoFile, unlockMedia, VideoError } from '../lib/video'
import { enqueue, flush, pendingCount } from '../lib/uploadQueue'
import { myActivities, useNow } from '../lib/schedule'
import { useStore } from '../lib/store'
import { isFakeNow, now, romeDate, shortDate, weekdayLetter } from '../lib/time'
import type { Photo, Place } from '../lib/types'
import { fetchWeather, type DayWeather } from '../lib/weather'
import { AvatarSetup } from './AvatarSetup'
import { EmergencyCard } from './EmergencyCard'
import { Settings } from './Settings'

export function MainScreen() {
  const { data, me, meId, offline, loadError, refresh, live, api, photoUrl, signPhotos, refreshLive, avatarUrl } = useStore()
  const toast = useToast()
  const t = useNow(1000)
  const today = romeDate(t)
  const mapRef = useRef<MapHandle>(null)
  const [snap, setSnap] = useState<Snap>(1)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null)
  const [weather, setWeather] = useState<Record<string, DayWeather>>({})
  const [overlay, setOverlay] = useState<'settings' | 'emergency' | null>(null)
  const [avatarPrompt, setAvatarPrompt] = useState(false)
  const [welcome, setWelcome] = useState<'full' | 'daily' | null>(() => {
    // מחושב כבר בטעינה, כדי שממשק המפה לא יהבהב לפני הפוסטר
    try {
      const id = localStorage.getItem('garda-me') ?? localStorage.getItem('garda-demo-me')
      if (id && !localStorage.getItem(`garda-onboarded-${id}`)) return 'full'
      if (localStorage.getItem('garda-welcome-day') !== romeDate(new Date())) return 'daily'
    } catch { /* ignore */ }
    return null
  })
  // ממשק המפה מתגלה רק אחרי מסך הפתיחה
  const [revealed, setRevealed] = useState(() => welcome === null)
  const [fabOpen, setFabOpen] = useState(false)
  const [slideshow, setSlideshow] = useState<string[] | null>(null)
  const [pending, setPending] = useState(0)
  // תמונות שממתינות לקליטה: מנסים שוב כשחוזרת רשת, בפתיחה, וכל חצי דקה
  useEffect(() => {
    if (!api) return
    const run = async () => {
      const n = await flush(api)
      if (n) { await refreshLive(); toast(n === 1 ? 'תמונה שחיכתה לקליטה עלתה' : `${n} תמונות שחיכו לקליטה עלו`) }
      setPending(await pendingCount())
    }
    void run()
    window.addEventListener('online', run)
    const iv = setInterval(run, 30000)
    return () => { window.removeEventListener('online', run); clearInterval(iv) }
  }, [api]) // eslint-disable-line react-hooks/exhaustive-deps
  // תמונות חדשות מאחרים מאז הביקור האחרון באלבום
  const [albumSeen, setAlbumSeen] = useState(() => { try { return localStorage.getItem('garda-album-seen') ?? '' } catch { return '' } })
  const [phoneLater, setPhoneLater] = useState(() => { try { return localStorage.getItem('garda-phone-later') === romeDate(new Date()) } catch { return false } })
  // הודעות, טיפים ובקשות קופצות רק אחרי שהמעבר למפה נגמר, כדי לא לשבור אותו
  const [settled, setSettled] = useState(revealed)
  useEffect(() => {
    if (!revealed || settled) return
    const t1 = setTimeout(() => setSettled(true), 2200)
    return () => clearTimeout(t1)
  }, [revealed]) // eslint-disable-line react-hooks/exhaustive-deps
  const [tab, setTab] = useState<'day' | 'family' | 'album' | 'info'>('day')
  const [compose, setCompose] = useState(false)
  const [cameraMenu, setCameraMenu] = useState(false)
  const [gallery, setGallery] = useState<{ ids: string[] | null; start: number; comments?: boolean } | null>(null)
  const [feed, setFeed] = useState<{ startId: string | null } | null>(null)
  const [placing, setPlacing] = useState<Photo | null>(null)
  const [uploads, setUploads] = useState<{ done: number; total: number; failed: number; note?: string } | null>(null)
  const [filter, setFilter] = useState<'all' | 'mine'>('all')
  const [meetDraft, setMeetDraft] = useState(false)
  const [locHelpHidden, setLocHelpHidden] = useState(false)
  const [tip, setTip] = useState<{ title: string; body: string } | null>(null)
  const [seenMeetings, setSeenMeetings] = useState<Set<string>>(() => { try { return new Set(JSON.parse(localStorage.getItem('garda-meet-seen') || '[]')) } catch { return new Set() } })
  const phase = shabbatPhase(data?.shabbat, t)
  const loc = useLocationSharing(phase === 'shabbat')
  const camRef = useRef<HTMLInputElement>(null)
  const galRef = useRef<HTMLInputElement>(null)
  const vidRef = useRef<HTMLInputElement>(null)

  // צליל להודעות: iOS מאפשר רק אחרי נגיעה ראשונה
  useEffect(() => {
    const on = () => unlockAudio()
    window.addEventListener('pointerdown', on, { passive: true })
    return () => window.removeEventListener('pointerdown', on)
  }, [])

  const photos = live.photos
  useEffect(() => { signPhotos(photos.map((p) => p.thumb_path)) }, [photos]) // eslint-disable-line react-hooks/exhaustive-deps
  const galleryPhotos = useMemo(() => {
    if (!gallery) return []
    if (!gallery.ids) return photos
    const set = new Set(gallery.ids)
    return photos.filter((p) => set.has(p.id))
  }, [gallery, photos])

  const upload = async (files: FileList | null, source: 'camera' | 'gallery') => {
    if (!files?.length || !api || !me || !data) return
    setCameraMenu(false)
    const arr = [...files]
    let done = 0, failed = 0, queued = 0, bySchedule = 0, videos = 0
    let videoErr: VideoError['code'] | null = null
    setUploads({ done, total: arr.length, failed })
    const hotel = data.places.find((p) => p.kind === 'hotel')
    const allowGps = loc.sharing && phase !== 'shabbat'
    for (const f of arr) {
      let prep: Awaited<ReturnType<typeof preparePhoto>> | null = null
      const video = isVideoFile(f)
      try {
        if (video) {
          const n = done + failed + queued + 1
          prep = await prepareVideo(f, source, list, hotel, allowGps, (p) =>
            setUploads({ done: done + queued, total: arr.length, failed, note: `מכין סרטון ${n}/${arr.length} · ${Math.round(p * 100)}%` }))
          setUploads({ done: done + queued, total: arr.length, failed, note: `מעלה סרטון ${n}/${arr.length}…` })
        } else prep = await preparePhoto(f, source, list, hotel, allowGps)
        await api.uploadPhoto(me.id, prep.full, prep.thumb, prep.meta)
        if (prep.meta.loc_source === 'schedule') bySchedule++
        if (video) videos++
        done++
      } catch (e) {
        console.error(e)
        if (e instanceof VideoError) { videoErr = e.code; failed++ }
        // אין קליטה: שומרים בטלפון ומעלים לבד כשהקליטה חוזרת
        else if (prep) { try { await enqueue(me.id, prep); queued++ } catch { failed++ } } else failed++
      }
      setUploads({ done: done + queued, total: arr.length, failed })
    }
    await refreshLive()
    setPending(await pendingCount())
    setTimeout(() => setUploads(null), 1500)
    const item = videos === arr.length ? 'סרטון' : 'תמונה'
    if (videoErr === 'too_long') toast(`סרטון יכול להיות עד דקה. אפשר לקצר אותו בגלריה של הטלפון ולנסות שוב.`)
    else if (videoErr === 'too_big') toast('הסרטון גדול מדי. נסה סרטון קצר יותר.')
    else if (videoErr) toast('לא הצלחתי לקרוא את הסרטון. נסה שוב.')
    else if (queued) toast(queued === 1 ? `אין קליטה. ה${item} תעלה לבד כשהקליטה תחזור` : `אין קליטה. ${queued} קבצים יעלו לבד כשהקליטה תחזור`)
    else if (failed) toast(`${failed} לא עלו. נסה שוב.`)
    else toast(done === 1 ? (videos ? 'הסרטון עלה לאלבום' : 'התמונה עלתה לאלבום') : `${done} ${videos === done ? 'סרטונים' : videos ? 'קבצים' : 'תמונות'} עלו לאלבום`)
    if (bySchedule && !failed && !queued) setTimeout(() => toast('מיקום לפי הלו"ז. אפשר לתקן בגלריה'), 2400)
  }

  const list = useMemo(() => (data ? myActivities(data, me) : []), [data, me])
  const day = selectedDay ?? (data?.days.some((d) => d.date === today) ? today : data?.days[0]?.date ?? today)
  const dayItems = useMemo(() => list.filter((a) => a.day === day), [list, day])
  const dayPlaceIds = useMemo(() => new Set(dayItems.map((a) => a.place_id).filter(Boolean) as string[]), [dayItems])
  const visiblePlaces = useMemo(() => (data?.places ?? []).filter((p) => p.main || dayPlaceIds.has(p.id) || p.id === selectedPlace?.id), [data, dayPlaceIds, selectedPlace])
  const rainPlaces = useMemo(() => (data?.places ?? []).filter((p) => p.rain_plan), [data])
  const dayObj = data?.days.find((d) => d.date === day)
  const dayIndex = data?.days.findIndex((d) => d.date === day) ?? -1
  const myEssentials = useMemo(() => (data?.essentials ?? []).filter((e) => !e.household_id || e.household_id === me?.household_id), [data, me])
  const familyMembers = useMemo(() => (data?.members ?? []).filter((m) => m.active), [data])

  useEffect(() => { if (data) void fetchWeather(data.days, data.places).then(setWeather) }, [data])

  // מסך פתיחה: מלא בפעם הראשונה בטלפון, ובכל בוקר רק הפוסטר עם תוכנית היום
  useEffect(() => {
    if (!me || welcome) return
    try { if (!localStorage.getItem(`garda-onboarded-${me.id}`)) { setWelcome('full'); setRevealed(false) } } catch { /* ignore */ }
  }, [me?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const closeWelcome = () => {
    try {
      if (me) { localStorage.setItem(`garda-onboarded-${me.id}`, '1'); localStorage.setItem(`garda-avatar-skip-${me.id}`, '1') }
      localStorage.setItem('garda-welcome-day', romeDate(new Date()))
    } catch { /* ignore */ }
    if (welcome === 'full') setAvatarPrompt(false)
    setWelcome(null)
  }

  // תמונת פרופיל בכניסה הראשונה
  useEffect(() => {
    if (me && !me.avatar_path && !localStorage.getItem(`garda-avatar-skip-${me.id}`)) setAvatarPrompt(true)
  }, [me])

  // מעבר בין ימים: flyTo חלק למקומות של היום
  const fitDay = () => {
    const pts = dayItems.map((a) => a.place).filter((p): p is Place => !!p)
    const unique = [...new Map(pts.map((p) => [p.id, p])).values()]
    const near = unique.filter((p) => p.kind !== 'airport')
    mapRef.current?.fit(near.length ? near : unique, { maxZoom: 14 })
  }
  const firstFit = useRef(false)
  useEffect(() => {
    if (!data || !dayItems.length || welcome) return
    const delay = firstFit.current ? 0 : 600
    firstFit.current = true
    const id = setTimeout(fitDay, delay)
    return () => clearTimeout(id)
  }, [day, !!data]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (api && me) void syncPush(api, me.id) }, [api, me?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── בני המשפחה על המפה ──
  const people = useMemo<MapPerson[]>(() => {
    if (!data || !me) return []
    const byId = new Map(data.members.map((m) => [m.id, m]))
    const out: MapPerson[] = []
    for (const l of live.locations) {
      const m = byId.get(l.member_id)
      if (!m || !m.active || l.lat == null || l.lng == null) continue
      if (filter === 'mine' && m.household_id !== me.household_id) continue
      const isMe = m.id === me.id
      const pos = isMe && loc.pos ? loc.pos : { lat: l.lat, lng: l.lng }
      if (isMe && !loc.pos) continue
      out.push({
        id: m.id, name: m.name, color: m.color, initials: initialsOf(m), avatar: avatarUrl(m), lat: pos.lat, lng: pos.lng,
        live: isMe || isLive(l.updated_at), stale: !isMe && isStale(l.updated_at), paused: !l.sharing, isMe,
        heading: isMe ? loc.pos?.heading ?? null : null,
        kids: data.members.filter((k) => k.guardian_id === m.id && k.active).map((k) => k.name),
      })
    }
    if (loc.pos && !out.some((p) => p.isMe)) out.push({ id: me.id, name: me.name, color: me.color, initials: initialsOf(me), avatar: null, lat: loc.pos.lat, lng: loc.pos.lng, live: true, stale: false, paused: false, isMe: true, heading: loc.pos.heading, kids: [] })
    return out
  }, [data, me, live.locations, loc.pos, filter, avatarUrl])

  const fitPeople = () => {
    const pts = people.filter((p) => !p.stale || p.isMe)
    if (pts.length) mapRef.current?.fit(pts, { maxZoom: 16 })
    else toast('עוד אף אחד לא משתף מיקום')
  }
  /** "הצג את כולם": המשפחה אם יש מיקומים, אחרת המקומות של היום */
  const focusAll = () => {
    if (people.some((p) => !p.stale && !p.isMe)) fitPeople()
    else fitDay()
  }

  // ── מסך הפתיחה → המפה: מתחילים מגבוה מעל צפון איטליה ועפים פנימה ──
  useEffect(() => {
    if (!welcome) return
    const t0 = setTimeout(() => mapRef.current?.jump({ lat: 45.62, lng: 10.62 }, 7.2), 50)
    return () => clearTimeout(t0)
  }, [!!welcome, !!data]) // eslint-disable-line react-hooks/exhaustive-deps
  const playIntro = () => {
    firstFit.current = true
    peopleFit.current = true
    const fresh = people.filter((p) => !p.stale)
    const pts = fresh.length > 1 ? fresh : (() => {
      const ps = dayItems.map((a) => a.place).filter((p): p is Place => !!p && p.kind !== 'airport')
      return ps.length ? ps : (data?.places.filter((p) => p.kind === 'hotel') ?? [])
    })()
    setTimeout(() => mapRef.current?.fit(pts, { maxZoom: 14, duration: 2200 }), 150)
    setTimeout(() => setRevealed(true), 700)
  }

  // בפתיחה: אם יש משתתפים שמשתפים מיקום, מתמקדים בהם
  const peopleFit = useRef(false)
  useEffect(() => {
    if (welcome || peopleFit.current || !people.some((p) => !p.isMe && !p.stale)) return
    peopleFit.current = true
    setTimeout(fitPeople, 700)
  }, [people]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── נקודת מפגש ──
  const meeting = useMemo(() => live.meetings.find((m) => m.active && new Date(m.meet_at).getTime() > now().getTime() - 20 * 60000) ?? null, [live.meetings])
  const walk = useWalkingRoute(loc.pos, meeting)
  const mapMeeting = useMemo<MapMeeting | null>(() => meeting ? { key: meeting.id, title: meeting.title, lat: meeting.lat, lng: meeting.lng, route: walk?.coords ?? null } : null, [meeting, walk])
  const newMeeting = meeting && meeting.created_by !== me?.id && !seenMeetings.has(meeting.id) ? meeting : null
  const markMeetingSeen = (id: string) => setSeenMeetings((s) => {
    const n = new Set(s).add(id)
    try { localStorage.setItem('garda-meet-seen', JSON.stringify([...n].slice(-30))) } catch { /* ignore */ }
    return n
  })
  const startMeeting = (at?: { lat: number; lng: number }) => {
    setSelectedPlace(null); setSnap(0); setMeetDraft(true)
    if (at) mapRef.current?.flyTo(at, 16)
  }

  // ── טיפים לפי מיקום: פעם ביום לכל מקום ──
  useEffect(() => {
    if (!loc.pos || !data || phase === 'shabbat') return
    const key = `garda-tips-${romeDate(new Date())}`
    let shown: string[] = []
    try { shown = JSON.parse(localStorage.getItem(key) || '[]') } catch { /* ignore */ }
    for (const [pid, tips] of Object.entries(TIPS)) {
      if (shown.includes(pid)) continue
      const place = data.places.find((p) => p.id === pid)
      if (!place || !tips.length) continue
      const t0 = tips[new Date().getDate() % tips.length]
      if (distance(loc.pos, place) > (t0.radius ?? 400)) continue
      setTip({ title: t0.title, body: t0.body })
      try { localStorage.setItem(key, JSON.stringify([...shown, pid])) } catch { /* ignore */ }
      break
    }
  }, [loc.pos?.lat, loc.pos?.lng]) // eslint-disable-line react-hooks/exhaustive-deps

  const focusPlace = (id: string) => {
    const p = data?.places.find((x) => x.id === id)
    if (!p) return
    setSelectedPlace(p)
    if (snap === 2) setSnap(1)
    mapRef.current?.flyTo(p, 14.5)
  }

  if (!data) {
    return (
      <main className="fixed inset-0 bg-bg p-5 pt-safe" aria-busy="true">
        <div className="skeleton mt-4 h-12 w-2/3" />
        <div className="skeleton mt-6 h-64 w-full rounded-3xl" />
        <div className="skeleton mt-4 h-24 w-full rounded-3xl" />
        <div className="skeleton mt-4 h-24 w-full rounded-3xl" />
        {loadError && (
          <div className="fixed inset-x-5 bottom-10 rounded-3xl bg-surface p-5 shadow-card" role="alert">
            <p className="font-semibold">{loadError === 'offline' ? 'אין קליטה, ועוד לא נשמרו נתונים בטלפון.' : 'לא הצלחתי לטעון את הטיול.'}</p>
            <p className="text-muted">בדוק חיבור לאינטרנט ונסה שוב.</p>
            <button className="btn-primary mt-3 w-full" onClick={() => refresh()}>נסה שוב</button>
          </div>
        )}
      </main>
    )
  }

  const rainyDay = weather[day] && weather[day].rain >= 50

  if (phase === 'shabbat') {
    return (
      <>
        <ShabbatScreen onEmergency={() => setOverlay('emergency')} />
        {overlay === 'emergency' && <EmergencyCard onClose={() => setOverlay(null)} />}
      </>
    )
  }

  const hidden = !revealed
  const unread = me ? live.messages.filter((m) => romeDate(new Date(m.created_at)) === today && isForMe(m, me, data.members) && !readOf(m, me.id, live.reads)).length : 0
  const newPhotos = me ? live.photos.filter((p) => p.member_id !== me.id && p.created_at > albumSeen).length : 0
  const TABS: ['day' | 'family' | 'album' | 'info', string, number][] = [['day', 'היום', 0], ['family', 'משפחה', unread], ['album', 'אלבום', newPhotos], ['info', 'מידע', 0]]
  const fabActions: { key: string; label: string; icon: React.ReactNode; tone: string; run: () => void }[] = [
    { key: 'photo', label: 'תמונה לאלבום', icon: <Camera size={20} />, tone: 'bg-green text-white', run: () => setCameraMenu(true) },
    { key: 'msg', label: 'הודעה למשפחה', icon: <MessageCircle size={20} />, tone: 'bg-surface text-ink', run: () => setCompose(true) },
    { key: 'meet', label: 'נקודת מפגש', icon: <MapPin size={20} />, tone: 'bg-surface text-terra', run: () => startMeeting() },
  ]

  return (
    <main className="fixed inset-0 overflow-hidden bg-bg">
      <MapView ref={mapRef} places={visiblePlaces} highlight={dayPlaceIds} selectedId={selectedPlace?.id ?? null} onSelect={setSelectedPlace} bottomPadding={snap === 0 ? 130 : Math.round(window.innerHeight * 0.52)}
        photos={placing ? photos.filter((p) => p.id !== placing.id) : photos} thumbUrl={photoUrl} onPhotos={(ids) => setGallery({ ids, start: 0 })}
        people={people} meeting={mapMeeting} onLongPress={(p) => { if (!meetDraft && !placing) startMeeting(p) }} />

      {/* כותרת: אני · היום · חירום */}
      <header className={`reveal reveal-top pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center gap-2 px-3 pt-[calc(var(--safe-top)+10px)] ${hidden || snap === 2 ? 'is-hidden' : ''}`} style={{ transitionDelay: hidden ? '0ms' : '650ms' }}>
        <button className="pointer-events-auto rounded-full shadow-float" onClick={() => setOverlay('settings')} aria-label="הגדרות">
          {me ? <Avatar member={me} size={44} ring /> : <span className="btn-icon" />}
        </button>
        <div className="pointer-events-auto flex min-h-[44px] min-w-0 items-center gap-2 rounded-full bg-surface/95 py-1.5 pe-4 ps-2 shadow-float backdrop-blur">
          {dayIndex >= 0 && <span className="tnum grid h-8 min-w-8 place-items-center rounded-full bg-green px-2 text-[14px] font-bold text-white">{dayIndex + 1}</span>}
          <span className="truncate font-display text-[17px] leading-none"><bdi>{dayIndex >= 0 ? dayObj?.title : 'טואטי בגארדה'}</bdi></span>
          {isFakeNow() && <span className="text-[12px] font-bold text-terra">בדיקה</span>}
        </div>
        <span className="flex-1" />
        <button className="pointer-events-auto grid h-11 w-11 place-items-center rounded-full bg-surface/95 text-danger shadow-float" onClick={() => setOverlay('emergency')} aria-label="כרטיס חירום">
          <Shield size={19} strokeWidth={2.4} />
        </button>
      </header>

      {(offline || loadError) && !hidden && (
        <div className="absolute inset-x-0 z-20 flex justify-center" style={{ top: 'calc(var(--safe-top) + 64px)' }}>
          <span className="flex items-center gap-1.5 rounded-full bg-ink/85 px-3 py-1 text-[13px] font-semibold text-bg">
            <WifiOff size={14} /> {offline ? (pending ? `אין קליטה · ${pending === 1 ? 'תמונה אחת ממתינה' : `${pending} תמונות ממתינות`}` : 'אין קליטה · מציג נתונים שמורים') : 'לא הצלחתי לרענן'}
          </span>
        </div>
      )}

      {/* פס שליטה אחד במפה: זום ומיקוד */}
      <div className={`reveal reveal-side absolute end-3 z-20 flex flex-col overflow-hidden rounded-full bg-surface/95 shadow-float backdrop-blur ${hidden || snap === 2 || meetDraft || placing ? 'is-hidden' : ''}`}
        style={{ bottom: 'calc(var(--sheet-h) + 14px)', transitionDelay: hidden ? '0ms' : '800ms', transitionProperty: 'opacity, transform, bottom' }}>
        <button className="grid h-11 w-11 place-items-center" onClick={() => mapRef.current?.zoomBy(1)} aria-label="התקרב"><Plus size={20} /></button>
        <span className="mx-2.5 h-px bg-line" />
        <button className="grid h-11 w-11 place-items-center" onClick={() => mapRef.current?.zoomBy(-1)} aria-label="התרחק"><Minus size={20} /></button>
        <span className="mx-2.5 h-px bg-line" />
        <button className="grid h-11 w-11 place-items-center text-green" onClick={focusAll} aria-label="הצג את כולם"><LocateFixed size={20} /></button>
      </div>

      {/* סינון: כולם / המשפחה שלי */}
      {data.households.length > 1 && snap !== 2 && !meetDraft && !placing && !hidden && (
        <div className="absolute start-3 z-20 flex rounded-full bg-surface/95 p-1 shadow-float" style={{ top: 'calc(var(--safe-top) + 64px)' }} role="radiogroup" aria-label="סינון">
          {([['all', 'כולם'], ['mine', 'המשפחה שלי']] as const).map(([k, l]) => (
            <button key={k} role="radio" aria-checked={filter === k} onClick={() => setFilter(k)} className={`min-h-[36px] rounded-full px-3 text-[14px] font-semibold ${filter === k ? 'bg-green text-white' : 'text-muted'}`}>{l}</button>
          ))}
        </div>
      )}

      {/* קביעת נקודת מפגש: מזיזים את המפה מתחת לסיכה */}
      {meetDraft && (
        <>
          <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center" style={{ paddingBottom: 'var(--sheet-h)' }}>
            <div className="meet-pin" style={{ transform: 'translateY(-22px)' }}><span className="mp-head" /></div>
          </div>
          <MeetingComposer onCancel={() => setMeetDraft(false)} onSave={async (title, at) => {
            const c = mapRef.current?.visibleCenter()
            if (!c || !api || !me) return
            try {
              await api.createMeeting({ created_by: me.id, title, lat: c.lat, lng: c.lng, meet_at: at.toISOString(), audience: 'all', household_id: null })
              await refreshLive(); setMeetDraft(false); setSnap(1); toast('נקודת המפגש נשלחה לכולם')
            } catch { toast('לא הצלחתי לשלוח. בדוק קליטה.') }
          }} />
        </>
      )}

      {/* כפתור פעולה אחד: תמונה · הודעה · נקודת מפגש */}
      {fabOpen && <button className="fixed inset-0 z-[25] bg-black/25 backdrop-blur-[2px] animate-[fade-in_.2s_both]" aria-label="סגור" onClick={() => setFabOpen(false)} />}
      {!selectedPlace && !placing && !meetDraft && (
        <div className={`reveal reveal-pop absolute start-3 z-30 flex flex-col items-start gap-2.5 ${hidden || snap === 2 ? 'is-hidden' : ''}`}
          style={{ bottom: 'calc(var(--sheet-h) + 14px)', transitionDelay: hidden ? '0ms' : '900ms', transitionProperty: 'opacity, transform, bottom' }}>
          {fabOpen && fabActions.map((a, i) => (
            <button key={a.key} className={`fab-item flex min-h-[48px] items-center gap-2.5 rounded-full py-2 pe-5 ps-2 font-semibold shadow-float ${a.tone}`}
              style={{ animationDelay: `${(fabActions.length - 1 - i) * 45}ms` }}
              onClick={() => { setFabOpen(false); a.run() }}>
              <span className="grid h-9 w-9 place-items-center rounded-full bg-black/5">{a.icon}</span>{a.label}
            </button>
          ))}
          <button className={`grid h-16 w-16 place-items-center rounded-full text-white shadow-float transition-[transform,background-color] duration-200 active:scale-95 ${fabOpen ? 'rotate-45 bg-ink' : 'bg-green'}`}
            onClick={() => setFabOpen((o) => !o)} aria-label={fabOpen ? 'סגור' : 'פעולות: תמונה, הודעה, נקודת מפגש'} aria-expanded={fabOpen}>
            <Plus size={30} strokeWidth={2.4} />
          </button>
        </div>
      )}

      {pending > 0 && !uploads && revealed && !offline && !loadError && (
        <div className="absolute inset-x-0 z-20 flex justify-center" style={{ top: 'calc(var(--safe-top) + 64px)' }}>
          <span className="tnum rounded-full bg-ink/85 px-3 py-1 text-[13px] font-semibold text-bg">{pending === 1 ? 'תמונה אחת ממתינה להעלאה' : `${pending} תמונות ממתינות להעלאה`}</span>
        </div>
      )}
      {uploads && (
        <div className="absolute inset-x-0 z-30 flex justify-center" style={{ top: 'calc(var(--safe-top) + 64px)' }}>
          <span className="tnum flex items-center gap-2 rounded-full bg-ink/90 px-4 py-2 text-[14px] font-semibold text-bg">
            {uploads.note ? <>{uploads.note}</> : uploads.done + uploads.failed < uploads.total ? <>מעלה {uploads.done + uploads.failed + 1} מתוך {uploads.total}…</> : <><Check size={16} className="text-[#7BD389]" /> הועלו {uploads.done}</>}
          </span>
        </div>
      )}

      {/* מיקום תמונה: מזיזים את המפה מתחת לסיכה */}
      {placing && (
        <>
          <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center" style={{ paddingBottom: 'var(--sheet-h)' }}>
            <div className="photo-marker" style={{ transform: 'translateY(-24px)' }}>
              {photoUrl(placing.thumb_path) && <img src={photoUrl(placing.thumb_path)!} alt="" />}
            </div>
          </div>
          <div className="absolute inset-x-3 z-30 rounded-3xl bg-surface p-3 shadow-float" style={{ top: 'calc(var(--safe-top) + 10px)' }}>
            <p className="mb-2 text-center font-semibold">הזז את המפה עד שהתמונה במקום הנכון</p>
            <div className="flex gap-2">
              <button className="btn-primary flex-1" onClick={async () => {
                const c = mapRef.current?.visibleCenter()
                if (!c || !api) return
                try { await api.movePhoto(placing.id, c.lat, c.lng); await refreshLive(); toast('המיקום נשמר') } catch { toast('לא הצלחתי לשמור. בדוק קליטה.') }
                setPlacing(null)
              }}><Check size={18} /> שמור כאן</button>
              <button className="btn-ghost" onClick={() => setPlacing(null)}>ביטול</button>
            </div>
          </div>
        </>
      )}

      {/* כרטיס מקום */}
      {selectedPlace && snap !== 2 && (
        <div className="absolute inset-x-3 z-20 animate-rise" style={{ bottom: 'calc(var(--sheet-h) + 14px)' }}>
          <div className="me-14 rounded-3xl bg-surface p-3 shadow-float">
            <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-greenSoft text-green"><PlaceIcon kind={selectedPlace.kind} size={22} /></span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-display text-lg leading-tight"><bdi>{selectedPlace.name_he ?? selectedPlace.name}</bdi></div>
                <div className="truncate text-[14px] text-muted" dir="ltr" style={{ textAlign: 'right' }}>{selectedPlace.address ?? selectedPlace.name}</div>
              </div>
              <button className="-m-1 grid h-11 w-11 place-items-center text-muted" onClick={() => setSelectedPlace(null)} aria-label="סגור"><X size={20} /></button>
            </div>
            <div className="mt-2 flex gap-2">
              <a className="btn-primary flex-1 text-[15px]" href={wazeLink(selectedPlace.lat, selectedPlace.lng)} target="_blank" rel="noreferrer"><Navigation size={17} /> Waze</a>
              <a className="btn-ghost flex-1 text-[15px]" href={googleLink(selectedPlace.lat, selectedPlace.lng)} target="_blank" rel="noreferrer"><MapPin size={17} /> גוגל מפות</a>
            </div>
          </div>
        </div>
      )}

      <BottomSheet snap={snap} onSnap={setSnap} hidden={hidden}>
        <NowRow list={list} t={t} onPlace={focusPlace} />
        {phase === 'friday' && <FridayCard />}
        {meeting && (
          <MeetingCard meeting={meeting} walk={walk} canCancel={meeting.created_by === me?.id || !!me?.is_admin}
            onShow={() => { setSnap(0); mapRef.current?.fit([meeting, ...people.filter((p) => !p.stale)], { maxZoom: 17 }) }}
            onCancel={async () => { if (!confirm('לבטל את נקודת המפגש?')) return; try { await api?.cancelMeeting(meeting.id); await refreshLive(); toast('נקודת המפגש בוטלה') } catch { toast('לא הצלחתי לבטל') } }} />
        )}
        <NextCard list={list} t={t} />

        {/* לשוניות: כל דבר במקום שלו */}
        <div className="sticky top-0 z-10 mt-4 bg-surface px-4 pb-2 pt-1">
          <div className="grid grid-cols-4 gap-1 rounded-2xl bg-surface2 p-1" role="tablist" aria-label="תוכן">
            {TABS.map(([k, label, badge]) => (
              <button key={k} role="tab" aria-selected={tab === k} onClick={() => {
                setTab(k); if (snap === 0) setSnap(1)
                if (k === 'album') { const t0 = new Date().toISOString(); setAlbumSeen(t0); try { localStorage.setItem('garda-album-seen', t0) } catch { /* ignore */ } }
              }}
                className={`relative min-h-[40px] rounded-xl text-[15px] font-semibold transition ${tab === k ? 'bg-surface text-ink shadow-card' : 'text-muted'}`}>
                {label}
                {badge > 0 && <span className="tnum absolute -top-1 end-1 grid h-5 min-w-5 place-items-center rounded-full bg-terra px-1 text-[11px] font-bold text-white">{badge}</span>}
              </button>
            ))}
          </div>
        </div>

        <div key={tab} className="tab-in pb-8">
          {tab === 'day' && (
            <>
              <DayChips days={data.days} selected={day} today={today} weather={weather} onSelect={(d) => { setSelectedDay(d); setSelectedPlace(null) }} />
              <SectionTitle action={dayObj && <span className="text-[15px] text-muted"><bdi>{weekdayLetter(day)} {shortDate(day)}</bdi></span>}>
                {dayObj?.title ?? 'היום'}
              </SectionTitle>
              {dayObj?.subtitle && <p className="-mt-1 mb-2 px-5 text-muted">{dayObj.subtitle}</p>}
              {rainyDay && (
                <div className="mx-4 mb-2 flex items-center gap-2 rounded-2xl bg-lake/15 p-3 text-[15px]">
                  <Umbrella size={18} className="shrink-0 text-lake" /> צפוי גשם ({weather[day].rain}%). יש רעיונות בתוכנית הגשם למטה.
                </div>
              )}
              <Timeline items={dayItems} t={t} onPlace={focusPlace} />
              <SectionTitle>תוכנית גשם</SectionTitle>
              <RainPlan places={rainPlaces} onPlace={focusPlace} />
            </>
          )}

          {tab === 'family' && (
            <>
              <div className="mx-4 mt-2 flex min-h-[52px] items-center gap-3 rounded-2xl bg-surface2 px-4">
                <MapPin size={18} className={loc.sharing ? 'text-green' : 'text-muted'} />
                <span className="flex-1 font-semibold">{loc.sharing ? 'המיקום שלי משותף' : 'המיקום שלי מושהה'}</span>
                <input type="checkbox" role="switch" aria-label="שתף מיקום" className="h-6 w-6 accent-[rgb(var(--green))]" checked={loc.sharing} onChange={async (e) => {
                  const on = e.target.checked
                  if (on) navigator.geolocation?.getCurrentPosition(() => {}, () => {}, { timeout: 1 })
                  try { await loc.setSharing(on); await refreshLive() } catch { toast('לא הצלחתי לעדכן. בדוק קליטה.') }
                }} />
              </div>
              {(loc.state === 'denied' || loc.state === 'unavailable') && !locHelpHidden && <LocationHelp state={loc.state} onClose={() => setLocHelpHidden(true)} />}
              <div className="mt-4">
                <FamilyStrip members={familyMembers} households={data.households} meId={meId} locations={live.locations} myPos={loc.pos} onTap={(m) => {
                  const p = people.find((x) => x.id === m.id)
                  if (p) { setSnap(0); mapRef.current?.flyTo(p, 16) }
                  else toast(`${m.name} עוד לא משתף מיקום`)
                }} />
              </div>
              <SectionTitle action={<button className="min-h-[44px] px-1 text-[15px] font-semibold text-green" onClick={() => setCompose(true)}>הודעה חדשה</button>}>הודעות היום</SectionTitle>
              <PushCard onInstall={() => setOverlay('settings')} />
              <MessageHistory onCompose={() => setCompose(true)} />
            </>
          )}

          {tab === 'album' && (
            <AlbumTab onOpen={(ids, st) => setGallery({ ids, start: st })} onSlideshow={(ids) => setSlideshow(ids)} onAdd={() => setCameraMenu(true)} onFeed={() => setFeed({ startId: null })} />
          )}

          {tab === 'info' && (
            <div className="pt-2"><Essentials items={myEssentials} /></div>
          )}
        </div>
      </BottomSheet>

      {welcome && (
        <Welcome full={welcome === 'full'} onDone={closeWelcome} onLeave={playIntro} onLocation={(share) => {
          if (share) { navigator.geolocation?.getCurrentPosition(() => {}, () => {}, { enableHighAccuracy: true, timeout: 20000 }); loc.setConsent('yes') }
          else loc.setConsent('no')
        }} />
      )}
      {settled && <MessagePopups onShowOnMap={(lat, lng) => { setSnap(0); mapRef.current?.flyTo({ lat, lng }, 16) }} />}
      {newMeeting && settled && <MeetingPopup meeting={newMeeting} onClose={() => markMeetingSeen(newMeeting.id)}
        onShow={() => { markMeetingSeen(newMeeting.id); setSnap(0); mapRef.current?.fit([newMeeting, ...people.filter((p) => p.isMe)], { maxZoom: 17 }) }} />}
      {tip && settled && <TipCard title={tip.title} body={tip.body} onClose={() => setTip(null)} />}
      {loc.consent === null && !avatarPrompt && settled && (
        <LocationConsent
          onYes={() => {
            // הבקשה יוצאת מתוך הלחיצה עצמה (דרישה של iOS)
            navigator.geolocation?.getCurrentPosition(() => {}, () => {}, { enableHighAccuracy: true, timeout: 20000 })
            loc.setConsent('yes')
          }}
          onNo={() => loc.setConsent('no')}
        />
      )}
      {settled && !avatarPrompt && loc.consent !== null && !phoneLater && me &&
        data.emergency.some((c) => c.member_id === me.id && !c.phone) && (
        <EmergencyPhonePrompt onDone={() => setPhoneLater(true)} onLater={() => {
          try { localStorage.setItem('garda-phone-later', romeDate(new Date())) } catch { /* ignore */ }
          setPhoneLater(true)
        }} />
      )}
      {compose && <ComposeSheet onClose={() => setCompose(false)} shareLocation={loc.sharing} />}
      {cameraMenu && (
        <div className="fixed inset-0 z-[75] flex items-end bg-black/40" onClick={() => setCameraMenu(false)}>
          <div className="w-full rounded-t-[28px] bg-surface p-5 pb-[calc(20px+var(--safe-bottom))] animate-rise" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-1 text-xl">לאלבום המשפחתי</h2>
            <p className="mb-4 text-muted">תמונות וסרטונים יופיעו לכולם באלבום ועל המפה. סרטון עד דקה.</p>
            <div className="mb-2 grid grid-cols-2 gap-2">
              <button className="btn-primary text-lg" onClick={() => camRef.current?.click()}><Camera size={20} /> תמונה</button>
              <button className="btn-primary text-lg" onClick={() => { unlockMedia(); vidRef.current?.click() }}><Video size={20} /> סרטון</button>
            </div>
            <button className="btn-ghost w-full" onClick={() => { unlockMedia(); galRef.current?.click() }}><ImagePlus size={20} /> בחר מהגלריה</button>
          </div>
        </div>
      )}
      <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { void upload(e.target.files, 'camera'); e.target.value = '' }} />
      <input ref={vidRef} type="file" accept="video/*" capture="environment" hidden onChange={(e) => { void upload(e.target.files, 'camera'); e.target.value = '' }} />
      <input ref={galRef} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => { void upload(e.target.files, 'gallery'); e.target.value = '' }} />
      {gallery && galleryPhotos.length > 0 && (
        <Gallery photos={galleryPhotos} start={gallery.start} startComments={gallery.comments} onClose={() => setGallery(null)}
          onPlace={(p) => { setGallery(null); setSelectedPlace(null); setSnap(0); setPlacing(p); mapRef.current?.flyTo(p, 15) }} />
      )}
      {feed && <Feed startId={feed.startId} onClose={() => setFeed(null)} onComments={(p) => setGallery({ ids: [p.id], start: 0, comments: true })} />}
      {slideshow && <Slideshow photos={photos.filter((p) => slideshow.includes(p.id))} onClose={() => setSlideshow(null)} />}
      {overlay === 'settings' && <Settings onClose={() => setOverlay(null)} />}
      {overlay === 'emergency' && <EmergencyCard onClose={() => setOverlay(null)} />}
      {avatarPrompt && me && settled && (
        <AvatarSetup
          member={me}
          onDone={() => setAvatarPrompt(false)}
          onSkip={() => { localStorage.setItem(`garda-avatar-skip-${me.id}`, '1'); setAvatarPrompt(false) }}
        />
      )}
    </main>
  )
}
