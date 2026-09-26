import { Crosshair, MapPin, Minus, Navigation, Plus, Shield, Umbrella, WifiOff, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Avatar } from '../components/Avatar'
import { BottomSheet, type Snap } from '../components/BottomSheet'
import { MapView, type MapHandle } from '../components/MapView'
import { NextCard, NowRow } from '../components/NowNext'
import { PlaceIcon } from '../components/PlaceIcon'
import { DayChips, Essentials, FamilyStrip, RainPlan, SectionTitle, Timeline } from '../components/Sections'
import { useToast } from '../components/Toast'
import { googleLink, wazeLink } from '../lib/nav'
import { myActivities, useNow } from '../lib/schedule'
import { useStore } from '../lib/store'
import { isFakeNow, romeDate, shortDate, weekdayLetter } from '../lib/time'
import type { Place } from '../lib/types'
import { fetchWeather, type DayWeather } from '../lib/weather'
import { AvatarSetup } from './AvatarSetup'
import { EmergencyCard } from './EmergencyCard'
import { Settings } from './Settings'

export function MainScreen() {
  const { data, me, meId, offline, loadError, refresh } = useStore()
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
      <MapView ref={mapRef} places={visiblePlaces} highlight={dayPlaceIds} selectedId={selectedPlace?.id ?? null} onSelect={setSelectedPlace} bottomPadding={snap === 0 ? 130 : Math.round(window.innerHeight * 0.52)} />

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
