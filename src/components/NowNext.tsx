import { Clock, Navigation } from 'lucide-react'
import { useEffect, useState } from 'react'
import { driveMinutes } from '../lib/directions'
import { googleLink, wazeLink } from '../lib/nav'
import { nowNext, type Timed } from '../lib/schedule'
import { countdown, formatDuration, hm, shortDate, weekdayLetter } from '../lib/time'
import { PlaceIcon } from './PlaceIcon'

const optLabel = (o: 'A' | 'B' | null) => (o ? ` · אופציה ${o === 'A' ? 'א׳' : 'ב׳'}` : '')

export function NowRow({ list, t, onPlace }: { list: Timed[]; t: Date; onPlace: (id: string) => void }) {
  const { current, next } = nowNext(list, t)
  const first = list[0]
  const last = list[list.length - 1]

  if (first && t < first.start) {
    return (
      <Row label="עכשיו" title="מתכוננים לטיול" sub={<>ההמראה בעוד <bdi className="tnum">{formatDuration(first.start.getTime() - t.getTime())}</bdi></>} />
    )
  }
  if (!next && last && t >= last.end) return <Row label="עכשיו" title="הטיול הסתיים" sub="תודה על שבוע מושלם בגארדה" />
  if (!current.length) {
    return <Row label="עכשיו" title="זמן חופשי" sub={next ? <>הבא: <bdi>{next.title}</bdi> ב-<bdi className="tnum">{hm(next.start_time)}</bdi></> : ''} />
  }
  const a = current[0]
  const pct = Math.min(100, Math.max(0, ((t.getTime() - a.start.getTime()) / (a.end.getTime() - a.start.getTime())) * 100))
  return (
    <button className="block w-full px-5 pb-3 text-start" onClick={() => a.place && onPlace(a.place.id)}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-bold text-green">עכשיו{current.length > 1 ? ` · ${current.length} אופציות` : optLabel(a.option_group)}</span>
        <span className="tnum text-sm text-muted">עד <bdi>{hm(a.end_time) || formatTime(a.end)}</bdi></span>
      </div>
      <div className="mt-0.5 truncate font-display text-[22px] leading-tight"><bdi>{a.title}</bdi></div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface2" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-green transition-[width] duration-1000" style={{ width: `${pct}%` }} />
      </div>
    </button>
  )
}

const formatTime = (d: Date) => d.toLocaleTimeString('he-IL', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' })

function Row({ label, title, sub }: { label: string; title: string; sub: React.ReactNode }) {
  return (
    <div className="px-5 pb-3">
      <span className="text-sm font-bold text-green">{label}</span>
      <div className="font-display text-[22px] leading-tight">{title}</div>
      <div className="mt-0.5 text-[15px] text-muted">{sub}</div>
    </div>
  )
}

export function NextCard({ list, t }: { list: Timed[]; t: Date }) {
  const { next, from } = nowNext(list, t)
  const [drive, setDrive] = useState<number | null>(null)
  useEffect(() => {
    setDrive(null)
    if (next?.place && from) void driveMinutes(from, next.place).then(setDrive)
  }, [next?.id, from?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!next) return null
  const ms = next.start.getTime() - t.getTime()
  const p = next.place
  return (
    <section className="mx-4 rounded-3xl bg-greenSoft p-4" aria-label="הבא בתור">
      <div className="flex items-center gap-3">
        {p && <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-green text-white"><PlaceIcon kind={p.kind} size={21} /></span>}
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-bold text-green">הבא בתור{optLabel(next.option_group)}</div>
          <div className="truncate font-display text-[19px] leading-tight"><bdi>{next.title}</bdi></div>
          <div className="flex items-center gap-1 text-[14px] text-muted">
            <Clock size={13} /><bdi className="tnum">{ms > 86400000 ? `${weekdayLetter(next.day)} ${shortDate(next.day)} · ` : ''}{hm(next.start_time)}</bdi>
            {drive != null && drive > 0 && <span className="tnum"> · {drive} דק׳ נסיעה</span>}
          </div>
        </div>
        <div className="shrink-0 text-end">
          <div className="text-[12px] text-muted">בעוד</div>
          <div className="tnum font-display text-[24px] leading-none"><bdi>{ms > 86400000 ? formatDuration(ms) : countdown(ms)}</bdi></div>
        </div>
      </div>
      {p && (
        <div className="mt-3 flex gap-2">
          <a className="btn-primary min-h-[44px] flex-1 text-[15px]" href={wazeLink(p.lat, p.lng)} target="_blank" rel="noreferrer"><Navigation size={17} /> נווט עם Waze</a>
          <a className="btn-ghost min-h-[44px] bg-surface text-[15px]" href={googleLink(p.lat, p.lng)} target="_blank" rel="noreferrer">גוגל מפות</a>
        </div>
      )}
    </section>
  )
}
