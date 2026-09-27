import { Camera, Check, Crosshair, ImagePlus, Images, MapPin, MessageCircle, Minus, Navigation, Plus, Shield, Umbrella, WifiOff, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Avatar } from '../components/Avatar'
import { BottomSheet, type Snap } from '../components/BottomSheet'
import { Gallery } from '../components/Gallery'
import { ComposeSheet, MessageHistory, MessagePopups } from '../components/Messages'
import { MapView, type MapHandle } from '../components/MapView'
import { NextCard, NowRow } from '../components/NowNext'
import { PlaceIcon } from '../components/PlaceIcon'
import { DayChips, Essentials, FamilyStrip, RainPlan, SectionTitle, Timeline } from '../components/Sections'
import { useToast } from '../components/Toast'
import { unlockAudio } from '../lib/messages'
import { googleLink, wazeLink } from '../lib/nav'
import { preparePhoto } from '../lib/photos'
import { myActivities, useNow } from '../lib/schedule'
import { useStore } from '../lib/store'
import { isFakeNow, romeDate, shortDate, weekdayLetter } from '../lib/time'
import type { Photo, Place } from '../lib/types'
import { fetchWeather, type DayWeather } from '../lib/weather'
import { AvatarSetup } from './AvatarSetup'
import { EmergencyCard } from './EmergencyCard'
import { Settings } from './Settings'

export function MainScreen() {
  const { data, me, meId, offline, loadError, refresh, live, api, photoUrl, signPhotos, refreshLive } = useStore()
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
  }, [day, data?.fetchedAt]) // eslint-disable-line react-hooks/exhaustive-deps

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

  return (
    <main className="fixed inset-0 overflow-hidden bg-bg">
      <MapView ref={mapRef} places={visiblePlaces} highlight={dayPlaceIds} selectedId={selectedPlace?.id ?? null} onSelect={setSelectedPlace} bottomPadding={snap === 0 ? 130 : Math.round(window.innerHeight * 0.52)}
        photos={placing ? photos.filter((p) => p.id !== placing.id) : photos} thumbUrl={photoUrl} onPhotos={(ids) => setGallery({ ids, start: 0 })} />

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
      </div>

      {/* מצלמה והודעה — בצד השני של המפה */}
      {!selectedPlace && !placing && (
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
                const c = mapRef.current?.center()
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
        <NextCard list={list} t={t} />

        <SectionTitle action={<button className="min-h-[44px] px-1 text-[15px] font-semibold text-green" onClick={() => setCompose(true)}>הודעה חדשה</button>}>הודעות היום</SectionTitle>
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

        <SectionTitle>המשפחה</SectionTitle>
        <FamilyStrip members={familyMembers} meId={meId} onTap={(m) => toast(`המיקום של ${m.name} יופיע כשנפעיל שיתוף מיקום`)} />

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
