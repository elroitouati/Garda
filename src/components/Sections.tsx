import { Check, Cloud, CloudFog, CloudLightning, CloudRain, CloudSun, Copy, MapPin, Snowflake, Sun, Umbrella } from 'lucide-react'
import { useState } from 'react'
import { googleLink, wazeLink } from '../lib/nav'
import type { Timed } from '../lib/schedule'
import { hm, shortDate, weekdayLetter } from '../lib/time'
import { ago, distance, formatDistance, isStale, type LatLng } from '../lib/geo'
import type { Day, Essential, Location, Member, Place } from '../lib/types'
import type { DayWeather } from '../lib/weather'
import { Avatar } from './Avatar'
import { PlaceIcon } from './PlaceIcon'
import { useToast } from './Toast'

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-2 mt-6 flex items-center justify-between px-5">
      <h2 className="section-title">{children}</h2>
      {action}
    </div>
  )
}

// ── המשפחה ──
export function FamilyStrip({ members, meId, locations, myPos, onTap }: {
  members: Member[]; meId: string | null; locations: Location[]; myPos: LatLng | null; onTap: (m: Member) => void
}) {
  const sorted = [...members].sort((a, b) => (a.id === meId ? -1 : b.id === meId ? 1 : a.sort - b.sort))
  if (!members.length) return <p className="px-5 text-muted">עוד אין משתתפים. מנהל יכול להוסיף במסך הניהול.</p>
  const status = (m: Member) => {
    const l = locations.find((x) => x.member_id === (m.guardian_id ?? m.id))
    if (m.guardian_id) return { text: `עם ${members.find((x) => x.id === m.guardian_id)?.name ?? 'מבוגר'}`, dim: !l }
    if (!l || l.lat == null || l.lng == null) return { text: 'לא משתף', dim: true }
    if (!l.sharing) return { text: 'מושהה', dim: true, grey: true }
    const d = myPos && m.id !== meId ? ` · ${formatDistance(distance(myPos, { lat: l.lat, lng: l.lng }))}` : ''
    return { text: `${ago(l.updated_at)}${d}`, dim: isStale(l.updated_at) }
  }
  return (
    <div className="no-scrollbar flex gap-3 overflow-x-auto px-5 pb-1" style={{ touchAction: 'pan-x' }}>
      {sorted.map((m) => {
        const st = status(m)
        return (
          <button key={m.id} className="flex w-[76px] shrink-0 flex-col items-center gap-1 text-center" onClick={() => onTap(m)}>
            <Avatar member={m} size={52} ring={m.id === meId} dim={'grey' in st && st.grey} className={st.dim ? 'opacity-60' : ''} />
            <span className="w-full truncate text-[14px] font-semibold leading-tight">{m.id === meId ? 'אני' : m.name}</span>
            <span className="tnum w-full truncate text-[12px] leading-tight text-muted">{st.text}</span>
          </button>
        )
      })}
    </div>
  )
}

// ── ימי הטיול ──
function WeatherIcon({ code, size = 18 }: { code: number; size?: number }) {
  const I = code <= 1 ? Sun : code <= 3 ? CloudSun : code <= 48 ? CloudFog : code <= 67 || (code >= 80 && code <= 82) ? CloudRain : code <= 77 || code === 85 || code === 86 ? Snowflake : code >= 95 ? CloudLightning : Cloud
  return <I size={size} aria-hidden />
}

export function DayChips({ days, selected, today, weather, onSelect }: {
  days: Day[]; selected: string; today: string; weather: Record<string, DayWeather>; onSelect: (d: string) => void
}) {
  return (
    <div className="no-scrollbar flex gap-2 overflow-x-auto px-5 pb-1" style={{ touchAction: 'pan-x' }} role="tablist">
      {days.map((d, i) => {
        const w = weather[d.date]
        const sel = d.date === selected
        return (
          <button
            key={d.date}
            role="tab"
            aria-selected={sel}
            onClick={() => onSelect(d.date)}
            className={`relative flex w-[64px] shrink-0 flex-col items-center rounded-2xl border-2 py-2 transition ${
              sel ? 'border-green bg-green text-white' : d.is_shabbat ? 'border-terra bg-surface' : 'border-transparent bg-surface2'
            }`}
          >
            <span className="text-[13px] font-semibold opacity-80">יום {i + 1}</span>
            <span className="font-display text-lg leading-tight">{weekdayLetter(d.date)}</span>
            <span className="tnum text-[13px] opacity-80">{shortDate(d.date)}</span>
            <span className="mt-1 flex h-5 items-center gap-0.5 text-[13px] font-semibold">
              {w ? <><WeatherIcon code={w.code} size={15} /><bdi className="tnum">{w.max}°</bdi></> : <span className="opacity-40">—</span>}
            </span>
            {d.date === today && <span className={`absolute -top-1 h-2.5 w-2.5 rounded-full ${sel ? 'bg-white' : 'bg-green'} ring-2 ring-surface`} aria-label="היום" />}
          </button>
        )
      })}
    </div>
  )
}

// ── ציר זמן ──
export function Timeline({ items, t, onPlace }: { items: Timed[]; t: Date; onPlace: (id: string) => void }) {
  if (!items.length) return <p className="mx-5 rounded-2xl bg-surface2 p-4 text-muted">אין עדיין פעילויות ביום הזה.</p>
  const shared = items.filter((a) => !a.option_group)
  const A = items.filter((a) => a.option_group === 'A')
  const B = items.filter((a) => a.option_group === 'B')
  const hasOpts = A.length + B.length > 0
  const optStart = hasOpts ? Math.min(...[...A, ...B].map((a) => a.start.getTime())) : Infinity
  const before = shared.filter((a) => a.start.getTime() < optStart)
  const after = shared.filter((a) => a.start.getTime() >= optStart)

  const Item = ({ a, compact }: { a: Timed; compact?: boolean }) => {
    const past = t >= a.end
    const cur = t >= a.start && t < a.end
    return (
      <li>
        <button
          className={`flex w-full items-start gap-3 rounded-2xl p-2.5 text-start transition ${cur ? 'bg-greenSoft ring-2 ring-green' : ''} ${past ? 'opacity-45' : ''}`}
          onClick={() => a.place && onPlace(a.place.id)}
        >
          <span className={`tnum w-12 shrink-0 pt-0.5 text-[15px] font-bold ${cur ? 'text-green' : 'text-muted'}`}><bdi>{hm(a.start_time)}</bdi></span>
          <span className="min-w-0 flex-1">
            <span className={`block font-semibold leading-snug ${compact ? 'text-[15px]' : 'text-[17px]'}`}><bdi>{a.title}</bdi></span>
            {a.notes && <span className="block text-[14px] leading-snug text-muted"><bdi>{a.notes}</bdi></span>}
            {cur && <span className="mt-1 inline-block rounded-full bg-green px-2 py-0.5 text-[12px] font-bold text-white">עכשיו</span>}
          </span>
          {a.place && !compact && <span className="mt-0.5 text-muted"><PlaceIcon kind={a.place.kind} size={18} /></span>}
        </button>
      </li>
    )
  }

  return (
    <div className="px-3">
      <ol>{before.map((a) => <Item key={a.id} a={a} />)}</ol>
      {hasOpts && (
        <div className="my-2 grid grid-cols-2 gap-2">
          {([['A', 'אופציה א׳', A], ['B', 'אופציה ב׳', B]] as const).map(([k, label, list]) => (
            <div key={k} className="rounded-2xl border-2 border-dashed border-line p-1.5">
              <div className="px-2 pb-1 pt-1 font-display text-[15px] text-green">{label}</div>
              <ol>{list.map((a) => <Item key={a.id} a={a} compact />)}</ol>
            </div>
          ))}
        </div>
      )}
      <ol>{after.map((a) => <Item key={a.id} a={a} />)}</ol>
    </div>
  )
}

// ── מידע חיוני ──
export function Essentials({ items }: { items: Essential[] }) {
  const toast = useToast()
  const [copied, setCopied] = useState<string | null>(null)
  if (!items.length) return <p className="mx-5 rounded-2xl bg-surface2 p-4 text-muted">עוד אין מידע חיוני למשפחה שלך. מנהל יכול להוסיף.</p>
  const copy = async (v: string, key: string) => {
    try { await navigator.clipboard.writeText(v); setCopied(key); toast('הועתק'); setTimeout(() => setCopied(null), 1500) } catch { /* ignore */ }
  }
  return (
    <div className="space-y-3 px-4">
      {items.map((e) => (
        <article key={e.id} className="rounded-3xl border border-line bg-bg p-4">
          <h3 className="text-[18px] leading-tight"><bdi>{e.title}</bdi></h3>
          {e.subtitle && <p className="text-[15px] text-muted"><bdi>{e.subtitle}</bdi></p>}
          <dl className="mt-2 space-y-1.5">
            {e.fields.map((f, i) => {
              const key = `${e.id}-${i}`
              const empty = !f.value
              return (
                <div key={key} className="flex min-h-[44px] items-center gap-2 rounded-xl bg-surface px-3">
                  <dt className="w-24 shrink-0 text-[14px] text-muted">{f.label}</dt>
                  <dd className={`min-w-0 flex-1 truncate font-semibold ${empty ? 'font-normal text-muted' : ''}`} dir="ltr" style={{ textAlign: 'right' }}>
                    {empty ? 'יתווסף בקרוב' : f.value}
                  </dd>
                  {!empty && f.copy !== false && (
                    <button className="grid h-11 w-11 place-items-center text-green" onClick={() => copy(f.value, key)} aria-label={`העתק ${f.label}`}>
                      {copied === key ? <Check size={18} /> : <Copy size={18} />}
                    </button>
                  )}
                </div>
              )
            })}
          </dl>
          {e.lat != null && e.lng != null && (
            <div className="mt-2 flex gap-2">
              <a className="btn-ghost flex-1 text-[15px]" href={wazeLink(e.lat, e.lng)} target="_blank" rel="noreferrer"><MapPin size={17} /> נווט</a>
              <a className="btn-ghost text-[15px]" href={googleLink(e.lat, e.lng)} target="_blank" rel="noreferrer">גוגל מפות</a>
            </div>
          )}
        </article>
      ))}
    </div>
  )
}

// ── תוכנית גשם ──
export function RainPlan({ places, onPlace }: { places: Place[]; onPlace: (id: string) => void }) {
  return (
    <div className="no-scrollbar flex gap-2 overflow-x-auto px-5 pb-1" style={{ touchAction: 'pan-x' }}>
      {places.map((p) => (
        <button key={p.id} className="flex min-h-[44px] shrink-0 items-center gap-2 rounded-full bg-surface2 px-4 text-[15px] font-semibold" onClick={() => onPlace(p.id)}>
          <Umbrella size={16} className="text-lake" /><bdi>{p.name_he ?? p.name}</bdi>
        </button>
      ))}
    </div>
  )
}
