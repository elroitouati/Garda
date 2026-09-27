import { Camera, Check, Crosshair, ImagePlus, Images, MapPin, MessageCircle, Minus, Navigation, Plus, Shield, Umbrella, Users, WifiOff, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Avatar } from '../components/Avatar'
import { BottomSheet, type Snap } from '../components/BottomSheet'
import { Gallery } from '../components/Gallery'
import { FridayCard, LocationConsent, LocationHelp, MeetingCard, MeetingComposer, MeetingPopup, PushCard, ShabbatScreen, TipCard, useWalkingRoute } from '../components/Live'
import { ComposeSheet, MessageHistory, MessagePopups } from '../components/Messages'
import { MapView, type MapHandle, type MapMeeting, type MapPerson } from '../components/MapView'
import { NextCard, NowRow } from '../components/NowNext'
import { PlaceIcon } from '../components/PlaceIcon'
import { DayChips, Essentials, FamilyStrip, RainPlan, SectionTitle, Timeline } from '../components/Sections'
import { useToast } from '../components/Toast'
import { distance, isLive, isStale } from '../lib/geo'
import { useLocationSharing } from '../lib/location'
import { initialsOf } from '../lib/members'
import { unlockAudio } from '../lib/messages'
import { syncPush } from '../lib/push'
import { shabbatPhase } from '../lib/shabbat'
import { TIPS } from '../lib/tips'
import { googleLink, wazeLink } from '../lib/nav'
import { preparePhoto } from '../lib/photos'
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
  const [compose, setCompose] = useState(false)
  const [cameraMenu, setCameraMenu] = useState(false)
  const [gallery, setGallery] = useState<{ ids: string[] | null; start: number } | null>(null)
  const [placing, setPlacing] = useState<Photo | null>(null)
  const [uploads, setUploads] = useState<{ done: number; total: number; failed: number } | null>(null)
  const [filter, setFilter] = useState<'all' | 'mine'>('all')
  const [meetDraft, setMeetDraft] = useState(false)
  const [locHelpHidden, setLocHelpHidden] = useState(false)
  const [tip, setTip] = useState<{ title: string; body: string } | null>(null)
  const [seenMeetings, setSeenMeetings] = useState<Set<string>>(() => { try { return new Set(JSON.parse(localStorage.getItem('garda-meet-seen') || '[]')) } catch { return new Set() } })
  const phase = shabbatPhase(data?.shabbat, t)
  const loc = useLocationSharing(phase === 'shabbat')
  const camRef = useRef<HTMLInputElement>(null)
  const galRef = useRef<HTMLInputElement>(null)

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
    let done = 0, failed = 0, bySchedule = 0
    setUploads({ done, total: arr.length, failed })
    const hotel = data.places.find((p) => p.kind === 'hotel')
    for (const f of arr) {
      try {
        const prep = await preparePhoto(f, source, list, hotel)
        await api.uploadPhoto(me.id, prep.full, prep.thumb, prep.meta)
        if (prep.meta.loc_source === 'schedule') bySchedule++
        done++
      } catch (e) { console.error(e); failed++ }
      setUploads({ done, total: arr.length, failed })
    }
    await refreshLive()
    setTimeout(() => setUploads(null), 1500)
    if (failed) toast(navigator.onLine ? `${failed} תמונות לא עלו. נסה שוב.` : 'אין קליטה. התמונות לא עלו.')
    else toast(done === 1 ? 'התמונה עלתה לאלבום' : `${done} תמונות עלו לאלבום`)
    if (bySchedule && !failed) setTimeout(() => toast('מיקום לפי הלו"ז. אפשר לתקן בגלריה'), 2400)
  }

  const list = useMemo(() => (data ? myActivities(data, me) : []), [data, me])
  const day = selectedDay ?? (data?.days.some((d) => d.date === today) ? today : data?.days[0]?.date ?? today)
  const dayItems = useMemo(() => list.filter((a) => a.day === day), [list, day])
  const dayPlaceIds = useMemo(() => new Set(dayItems.map((a) => a.place_id).filter(Boolean) as string[]), [dayItems])
  const visiblePlaces = useMemo(() => (data?.places ?? []).filter((p) => p.main || dayPlaceIds.has(p.id) || p.id === selectedPlace?.id), [data, dayPlaceIds, selectedPlace])
  const rainPlaces = useMemo(() => (data?.places ?? []).filter((p) => p.rain_plan), [data])
  const dayObj = data?.days.find((d) => d.date === day)
  const dayIndex = data?.days.findIndex((d) => d.date === day) ?? -1
  const myEssentials = useMemo(() => (data?.essentials ?? []).filter((e) => e.household_id === me?.household_id), [data, me])
  const familyMembers = useMemo(() => (data?.members ?? []).filter((m) => m.active), [data])

  useEffect(() => { if (data) void fetchWeather(data.days, data.places).then(setWeather) }, [data])

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
    if (!data || !dayItems.length) return
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
  // בפתיחה: אם יש משתתפים שמשתפים מיקום, מתמקדים בהם
  const peopleFit = useRef(false)
  useEffect(() => {
    if (peopleFit.current || !people.some((p) => !p.isMe && !p.stale)) return
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

  return (
    <main className="fixed inset-0 overflow-hidden bg-bg">
      <MapView ref={mapRef} places={visiblePlaces} highlight={dayPlaceIds} selectedId={selectedPlace?.id ?? null} onSelect={setSelectedPlace} bottomPadding={snap === 0 ? 130 : Math.round(window.innerHeight * 0.52)}
        photos={placing ? photos.filter((p) => p.id !== placing.id) : photos} thumbUrl={photoUrl} onPhotos={(ids) => setGallery({ ids, start: 0 })}
        people={people} meeting={mapMeeting} onLongPress={(p) => { if (!meetDraft && !placing) startMeeting(p) }} />

      {/* כותרת עליונה */}
      <header className={`pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start gap-2 px-3 pt-[calc(var(--safe-top)+10px)] transition-opacity duration-300 ${snap === 2 ? 'opacity-0' : ''}`}>
        <button className="pointer-events-auto rounded-full shadow-float" onClick={() => setOverlay('settings')} aria-label="הגדרות">
          {me ? <Avatar member={me} size={46} ring /> : <span className="btn-icon" />}
        </button>
        <div className="pointer-events-auto flex min-h-[46px] flex-1 flex-col justify-center rounded-3xl bg-surface/95 px-4 py-1.5 shadow-float backdrop-blur">
          <h1 className="text-[19px] leading-tight">טואטי בגארדה</h1>
          <p className="truncate text-[13px] leading-tight text-muted">
            {dayIndex >= 0 ? <>יום {dayIndex + 1} מתוך {data.days.length} · <bdi>{dayObj?.title}</bdi></> : <bdi>27.9 – 4.10.2026</bdi>}
            {isFakeNow() && <span className="ms-1 font-bold text-terra">· שעון בדיקה</span>}
          </p>
        </div>
        <button className="pointer-events-auto grid h-11 w-11 place-items-center rounded-full bg-surface/95 text-danger shadow-float" onClick={() => setOverlay('emergency')} aria-label="כרטיס חירום">
          <Shield size={20} strokeWidth={2.4} />
        </button>
      </header>

      {(offline || loadError) && (
        <div className="absolute inset-x-0 z-20 flex justify-center" style={{ top: 'calc(var(--safe-top) + 66px)' }}>
          <span className="flex items-center gap-1.5 rounded-full bg-ink/85 px-3 py-1 text-[13px] font-semibold text-bg">
            <WifiOff size={14} /> {offline ? 'אין קליטה · מציג נתונים שמורים' : 'לא הצלחתי לרענן'}
          </span>
        </div>
      )}

      {/* כפתורי מפה — עולים ויורדים עם החלונית */}
      <div
        className="absolute end-3 z-20 flex flex-col gap-2 transition-[bottom,opacity] duration-300"
        style={{ bottom: 'calc(var(--sheet-h) + 14px)', opacity: snap === 2 ? 0 : 1 }}
      >
        <button className="btn-icon" onClick={() => mapRef.current?.zoomBy(1)} aria-label="התקרב"><Plus size={22} /></button>
        <button className="btn-icon" onClick={() => mapRef.current?.zoomBy(-1)} aria-label="התרחק"><Minus size={22} /></button>
        <button className="btn-icon text-green" onClick={fitDay} aria-label="הצג את כל המקומות של היום"><Crosshair size={21} /></button>
        <button className="btn-icon text-green" onClick={fitPeople} aria-label="הצג את כולם"><Users size={21} /></button>
        <button className="btn-icon text-terra" onClick={() => startMeeting()} aria-label="קבע נקודת מפגש"><MapPin size={21} /></button>
      </div>

      {/* סינון: כולם / המשפחה שלי */}
      {data.households.length > 1 && snap !== 2 && !meetDraft && !placing && (
        <div className="absolute start-3 z-20 flex rounded-full bg-surface/95 p-1 shadow-float" style={{ top: 'calc(var(--safe-top) + 66px)' }} role="radiogroup" aria-label="סינון">
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

      {/* מצלמה והודעה — בצד השני של המפה */}
      {!selectedPlace && !placing && !meetDraft && (
        <div className="absolute start-3 z-20 flex flex-col items-center gap-2.5 transition-[bottom,opacity] duration-300"
          style={{ bottom: 'calc(var(--sheet-h) + 14px)', opacity: snap === 2 ? 0 : 1 }}>
          <button className="btn-icon h-12 w-12" onClick={() => setCompose(true)} aria-label="הודעה למשפחה"><MessageCircle size={22} /></button>
          <button className="grid h-16 w-16 place-items-center rounded-full bg-green text-white shadow-float transition active:scale-95" onClick={() => setCameraMenu(true)} aria-label="צלם או הוסף תמונה">
            <Camera size={28} />
          </button>
        </div>
      )}

      {uploads && (
        <div className="absolute inset-x-0 z-30 flex justify-center" style={{ top: 'calc(var(--safe-top) + 66px)' }}>
          <span className="tnum flex items-center gap-2 rounded-full bg-ink/90 px-4 py-2 text-[14px] font-semibold text-bg">
            {uploads.done + uploads.failed < uploads.total ? <>מעלה {uploads.done + uploads.failed + 1} מתוך {uploads.total}…</> : <><Check size={16} className="text-[#7BD389]" /> הועלו {uploads.done}</>}
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

      <BottomSheet snap={snap} onSnap={setSnap}>
        <NowRow list={list} t={t} onPlace={focusPlace} />
        {phase === 'friday' && <FridayCard />}
        {meeting && (
          <MeetingCard meeting={meeting} walk={walk} canCancel={meeting.created_by === me?.id || !!me?.is_admin}
            onShow={() => { setSnap(0); mapRef.current?.fit([meeting, ...people.filter((p) => !p.stale)], { maxZoom: 17 }) }}
            onCancel={async () => { if (!confirm('לבטל את נקודת המפגש?')) return; try { await api?.cancelMeeting(meeting.id); await refreshLive(); toast('נקודת המפגש בוטלה') } catch { toast('לא הצלחתי לבטל') } }} />
        )}
        <NextCard list={list} t={t} />

        <SectionTitle action={<button className="min-h-[44px] px-1 text-[15px] font-semibold text-green" onClick={() => setCompose(true)}>הודעה חדשה</button>}>הודעות היום</SectionTitle>
        <PushCard onInstall={() => setOverlay('settings')} />
        <MessageHistory onCompose={() => setCompose(true)} />

        <SectionTitle action={photos.length > 0 && <button className="min-h-[44px] px-1 text-[15px] font-semibold text-green" onClick={() => setGallery({ ids: null, start: 0 })}>כל {photos.length} התמונות</button>}>האלבום</SectionTitle>
        {photos.length ? (
          <div className="no-scrollbar flex gap-2 overflow-x-auto px-5 pb-1" style={{ touchAction: 'pan-x' }}>
            {photos.slice(0, 30).map((ph, k) => {
              const u = photoUrl(ph.thumb_path)
              const who = data.members.find((m) => m.id === ph.member_id)
              return (
                <button key={ph.id} className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-surface2" onClick={() => setGallery({ ids: null, start: k })} aria-label={`תמונה של ${who?.name ?? ''}`}>
                  {u && <img src={u} alt="" className="h-full w-full object-cover" loading="lazy" />}
                  {who && <span className="absolute bottom-1 end-1"><Avatar member={who} size={22} /></span>}
                </button>
              )
            })}
          </div>
        ) : (
          <div className="mx-4 flex items-center gap-3 rounded-2xl bg-surface2 p-4">
            <Images size={22} className="shrink-0 text-muted" />
            <p className="flex-1 text-muted">עוד אין תמונות. כל תמונה שתעלו תופיע כאן ועל המפה.</p>
            <button className="btn-primary" onClick={() => setCameraMenu(true)}>הוסף</button>
          </div>
        )}

        <SectionTitle action={
          <label className="flex min-h-[44px] items-center gap-2 text-[15px] font-semibold">
            <span className={loc.sharing ? 'text-green' : 'text-muted'}>{loc.sharing ? 'משתף מיקום' : 'מיקום מושהה'}</span>
            <input type="checkbox" role="switch" className="h-6 w-6 accent-[rgb(var(--green))]" checked={loc.sharing} onChange={async (e) => {
              const on = e.target.checked
              if (on) navigator.geolocation?.getCurrentPosition(() => {}, () => {}, { timeout: 1 })
              try { await loc.setSharing(on); await refreshLive() } catch { toast('לא הצלחתי לעדכן. בדוק קליטה.') }
            }} />
          </label>
        }>המשפחה</SectionTitle>
        {(loc.state === 'denied' || loc.state === 'unavailable') && !locHelpHidden && <LocationHelp state={loc.state} onClose={() => setLocHelpHidden(true)} />}
        <FamilyStrip members={familyMembers} meId={meId} locations={live.locations} myPos={loc.pos} onTap={(m) => {
          const p = people.find((x) => x.id === m.id)
          if (p) { setSnap(0); mapRef.current?.flyTo(p, 16) }
          else toast(`${m.name} עוד לא משתף מיקום`)
        }} />

        <SectionTitle>ימי הטיול</SectionTitle>
        <DayChips days={data.days} selected={day} today={today} weather={weather} onSelect={(d) => { setSelectedDay(d); setSelectedPlace(null) }} />

        <SectionTitle action={dayObj && <span className="text-[15px] text-muted"><bdi>{weekdayLetter(day)} {shortDate(day)}</bdi></span>}>
          {dayObj?.title ?? 'היום'}
        </SectionTitle>
        {dayObj?.subtitle && <p className="-mt-1 mb-2 px-5 text-muted">{dayObj.subtitle}</p>}
        {rainyDay && (
          <div className="mx-4 mb-2 flex items-center gap-2 rounded-2xl bg-lake/15 p-3 text-[15px]">
            <Umbrella size={18} className="shrink-0 text-lake" /> צפוי גשם ({weather[day].rain}%). אפשר לבחור מתוכנית הגשם למטה.
          </div>
        )}
        <Timeline items={dayItems} t={t} onPlace={focusPlace} />

        <SectionTitle>תוכנית גשם</SectionTitle>
        <RainPlan places={rainPlaces} onPlace={focusPlace} />

        <SectionTitle>מידע חיוני</SectionTitle>
        <Essentials items={myEssentials} />

        <p className="px-5 pb-10 pt-8 text-center text-sm text-muted">שבוע טוב ומהנה, משפחת טואטי</p>
      </BottomSheet>

      <MessagePopups onShowOnMap={(lat, lng) => { setSnap(0); mapRef.current?.flyTo({ lat, lng }, 16) }} />
      {newMeeting && <MeetingPopup meeting={newMeeting} onClose={() => markMeetingSeen(newMeeting.id)}
        onShow={() => { markMeetingSeen(newMeeting.id); setSnap(0); mapRef.current?.fit([newMeeting, ...people.filter((p) => p.isMe)], { maxZoom: 17 }) }} />}
      {tip && <TipCard title={tip.title} body={tip.body} onClose={() => setTip(null)} />}
      {loc.consent === null && !avatarPrompt && (
        <LocationConsent
          onYes={() => {
            // הבקשה יוצאת מתוך הלחיצה עצמה (דרישה של iOS)
            navigator.geolocation?.getCurrentPosition(() => {}, () => {}, { enableHighAccuracy: true, timeout: 20000 })
            loc.setConsent('yes')
          }}
          onNo={() => loc.setConsent('no')}
        />
      )}
      {compose && <ComposeSheet onClose={() => setCompose(false)} />}
      {cameraMenu && (
        <div className="fixed inset-0 z-[75] flex items-end bg-black/40" onClick={() => setCameraMenu(false)}>
          <div className="w-full rounded-t-[28px] bg-surface p-5 pb-[calc(20px+var(--safe-bottom))] animate-rise" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-1 text-xl">תמונה לאלבום המשפחתי</h2>
            <p className="mb-4 text-muted">התמונה תופיע לכולם על המפה, במקום שבו צולמה.</p>
            <button className="btn-primary mb-2 w-full text-lg" onClick={() => camRef.current?.click()}><Camera size={20} /> צלם עכשיו</button>
            <button className="btn-ghost w-full" onClick={() => galRef.current?.click()}><ImagePlus size={20} /> בחר מהגלריה</button>
          </div>
        </div>
      )}
      <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { void upload(e.target.files, 'camera'); e.target.value = '' }} />
      <input ref={galRef} type="file" accept="image/*" multiple hidden onChange={(e) => { void upload(e.target.files, 'gallery'); e.target.value = '' }} />
      {gallery && galleryPhotos.length > 0 && (
        <Gallery photos={galleryPhotos} start={gallery.start} onClose={() => setGallery(null)}
          onPlace={(p) => { setGallery(null); setSelectedPlace(null); setSnap(0); setPlacing(p); mapRef.current?.flyTo(p, 15) }} />
      )}
      {overlay === 'settings' && <Settings onClose={() => setOverlay(null)} />}
      {overlay === 'emergency' && <EmergencyCard onClose={() => setOverlay(null)} />}
      {avatarPrompt && me && (
        <AvatarSetup
          member={me}
          onDone={() => setAvatarPrompt(false)}
          onSkip={() => { localStorage.setItem(`garda-avatar-skip-${me.id}`, '1'); setAvatarPrompt(false) }}
        />
      )}
    </main>
  )
}
