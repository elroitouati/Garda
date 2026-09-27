import { BellRing, Clock, Flame, Footprints, MapPin, Navigation, Shield, Smartphone, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { formatDistance, type LatLng } from '../lib/geo'
import { isIOS, type GeoState } from '../lib/location'
import { enablePush, pushStatus, type PushStatus } from '../lib/push'
import { myActivities, useNow } from '../lib/schedule'
import { romeHM } from '../lib/shabbat'
import { useStore } from '../lib/store'
import { countdown, formatDuration, hm, now } from '../lib/time'
import type { Meeting } from '../lib/types'
import { Avatar } from './Avatar'
import { useToast } from './Toast'

// ── מסך הסבר לפני בקשת הרשאת מיקום ───────────────────────────
export function LocationConsent({ onYes, onNo }: { onYes: () => void; onNo: () => void }) {
  return (
    <div className="fixed inset-0 z-[72] flex items-end bg-black/40">
      <div className="w-full rounded-t-[28px] bg-surface p-6 pb-[calc(24px+var(--safe-bottom))] animate-rise">
        <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-greenSoft text-green"><MapPin size={30} /></div>
        <h2 className="text-center text-2xl">שתף מיקום כדי שהמשפחה תראה אותך על המפה</h2>
        <ul className="mt-4 space-y-2 text-[16px] leading-snug text-muted">
          <li>• כולם רואים איפה כולם, ומי רחוק ממי.</li>
          <li>• נשמר רק המיקום האחרון, בלי היסטוריה, ונמחק אחרי הטיול.</li>
          <li>• אפשר להשהות בכל רגע, ובשבת זה נכבה לבד.</li>
          <li className="font-semibold text-ink">• חשוב לדעת: המיקום מתעדכן רק כשהאפליקציה פתוחה על המסך.</li>
        </ul>
        <button className="btn-primary mt-6 w-full text-lg" onClick={onYes}><MapPin size={20} /> שתף מיקום</button>
        <button className="btn mt-2 w-full text-muted" onClick={onNo}>לא עכשיו</button>
      </div>
    </div>
  )
}

/** מי שסירב: איך להפעיל מחדש */
export function LocationHelp({ state, onClose }: { state: GeoState; onClose: () => void }) {
  return (
    <div className="mx-4 mt-2 rounded-2xl bg-terraSoft p-4 text-[15px] leading-snug">
      <div className="flex items-start gap-2">
        <p className="flex-1 font-semibold text-terra">{state === 'denied' ? 'הטלפון חוסם את המיקום לאתר.' : 'לא הצלחתי לקבל מיקום.'}</p>
        <button className="-m-2 grid h-11 w-11 place-items-center text-muted" onClick={onClose} aria-label="סגור"><X size={18} /></button>
      </div>
      {state === 'denied' && (isIOS() ? (
        <p className="mt-1">באייפון: הגדרות ← פרטיות ואבטחה ← שירותי מיקום ← <b>Safari Websites</b> (או האפליקציה שממנה פתחת) ← "בזמן השימוש". אחר כך לסגור ולפתוח את האפליקציה.</p>
      ) : (
        <p className="mt-1">באנדרואיד: לוחצים על סמל המנעול ליד הכתובת ← הרשאות ← מיקום ← "אפשר". או: הגדרות ← אפליקציות ← Chrome ← הרשאות ← מיקום.</p>
      ))}
    </div>
  )
}

// ── נקודת מפגש ──────────────────────────────────────────────
const QUICK_PLACES = ['נפגשים כאן', 'ליד הרכב', 'בכניסה', 'בנמל', 'במלון']
const QUICK_MIN = [15, 30, 45, 60]

export function MeetingComposer({ onSave, onCancel }: { onSave: (title: string, at: Date) => Promise<void>; onCancel: () => void }) {
  const [title, setTitle] = useState('נפגשים כאן')
  const [mins, setMins] = useState<number | null>(30)
  const [time, setTime] = useState('')
  const [busy, setBusy] = useState(false)
  const at = () => {
    if (mins != null) return new Date(now().getTime() + mins * 60000)
    const [h, m] = time.split(':').map(Number)
    const d = now()
    // השעה שנבחרה היא בשעון איטליה
    const rome = new Date(d.toLocaleString('en-US', { timeZone: 'Europe/Rome' }))
    const diff = (h * 60 + m) - (rome.getHours() * 60 + rome.getMinutes())
    return new Date(d.getTime() + (diff < -60 ? diff + 1440 : diff) * 60000)
  }
  return (
    <div className="absolute inset-x-3 z-30 rounded-3xl bg-surface p-4 shadow-float" style={{ top: 'calc(var(--safe-top) + 10px)' }}>
      <p className="mb-2 text-center font-semibold">הזז את המפה עד שהסיכה במקום</p>
      <div className="no-scrollbar -mx-4 mb-2 flex gap-2 overflow-x-auto px-4">
        {QUICK_PLACES.map((q) => (
          <button key={q} onClick={() => setTitle(q)} className={`min-h-[40px] shrink-0 rounded-full px-3 text-[15px] font-semibold ${title === q ? 'bg-terra text-white' : 'bg-surface2'}`}>{q}</button>
        ))}
      </div>
      <input className="input mb-2" maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} aria-label="שם נקודת המפגש" />
      <div className="flex flex-wrap items-center gap-2">
        <Clock size={18} className="text-muted" />
        {QUICK_MIN.map((m) => (
          <button key={m} onClick={() => { setMins(m); setTime('') }} className={`tnum min-h-[40px] rounded-full px-3 text-[15px] font-semibold ${mins === m ? 'bg-terra text-white' : 'bg-surface2'}`}>{m} דק׳</button>
        ))}
        <input type="time" aria-label="שעה" className="input tnum h-10 min-h-0 w-[110px]" value={time} onChange={(e) => { setTime(e.target.value); setMins(null) }} />
      </div>
      <div className="mt-3 flex gap-2">
        <button className="btn flex-1 bg-terra text-white" disabled={busy || !title.trim() || (mins == null && !time)} onClick={async () => { setBusy(true); try { await onSave(title.trim(), at()) } finally { setBusy(false) } }}>
          <MapPin size={18} /> {busy ? 'שולח…' : 'קבע נקודת מפגש'}
        </button>
        <button className="btn-ghost" onClick={onCancel}>ביטול</button>
      </div>
    </div>
  )
}

export function useWalkingRoute(from: LatLng | null, to: LatLng | null) {
  const [r, setR] = useState<{ coords: [number, number][]; m: number; s: number } | null>(null)
  const key = from && to ? `${from.lat.toFixed(4)},${from.lng.toFixed(4)}>${to.lat},${to.lng}` : ''
  useEffect(() => {
    if (!from || !to) { setR(null); return }
    let dead = false
    fetch(`https://routing.openstreetmap.de/routed-foot/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`)
      .then((x) => x.json())
      .then((j) => { const rt = j?.routes?.[0]; if (!dead && rt) setR({ coords: rt.geometry.coordinates, m: rt.distance, s: rt.duration }) })
      .catch(() => {})
    return () => { dead = true }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  return r
}

export function MeetingCard({ meeting, walk, onShow, onCancel, canCancel }: {
  meeting: Meeting; walk: { m: number; s: number } | null; onShow: () => void; onCancel: () => void; canCancel: boolean
}) {
  const t = useNow(1000)
  const { data } = useStore()
  const who = data?.members.find((m) => m.id === meeting.created_by)
  const ms = new Date(meeting.meet_at).getTime() - t.getTime()
  return (
    <section className="mx-4 mb-3 rounded-3xl border-2 border-terra bg-terraSoft p-4" aria-label="נקודת מפגש">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-terra text-white"><MapPin size={22} /></span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-terra">נקודת מפגש · {who?.name}</div>
          <div className="truncate font-display text-xl leading-tight"><bdi>{meeting.title}</bdi></div>
          <div className="tnum text-[15px] text-muted">
            ב-{romeHM(meeting.meet_at)}{walk ? <> · <Footprints size={14} className="inline" /> {formatDistance(walk.m)}, {Math.max(1, Math.round(walk.s / 60))} דק׳ הליכה</> : ''}
          </div>
        </div>
        <div className="text-end">
          <div className="text-[13px] text-muted">{ms >= 0 ? 'בעוד' : 'עכשיו'}</div>
          <div className="tnum font-display text-[26px] leading-none">{ms >= 0 ? countdown(ms) : '00:00'}</div>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button className="btn flex-1 bg-terra text-white" onClick={onShow}><MapPin size={17} /> הראה</button>
        <a className="btn-ghost flex-1 bg-surface" href={`https://www.google.com/maps/dir/?api=1&destination=${meeting.lat},${meeting.lng}&travelmode=walking`} target="_blank" rel="noreferrer"><Navigation size={17} /> נווט ברגל</a>
        {canCancel && <button className="btn-ghost bg-surface text-terra" onClick={onCancel}>בטל</button>}
      </div>
    </section>
  )
}

// ── שבת ─────────────────────────────────────────────────────
export function FridayCard() {
  const t = useNow(1000)
  const { data } = useStore()
  const s = data?.shabbat
  if (!s) return null
  const ms = new Date(s.candles).getTime() - t.getTime()
  return (
    <section className="mx-4 mb-3 flex items-center gap-3 rounded-3xl bg-[#FFF3D6] p-4 text-[#5A4410] dark:bg-[#3A2F17] dark:text-[#F3DFA8]">
      <Flame size={28} className="shrink-0 text-[#D9941E]" />
      <div className="flex-1">
        <div className="font-display text-lg leading-tight">הדלקת נרות ב-{romeHM(s.candles)}</div>
        <div className="text-[14px] opacity-80">{s.title}. שיתוף מיקום והתראות ייכבו לבד.</div>
      </div>
      <div className="tnum font-display text-2xl">{countdown(ms)}</div>
    </section>
  )
}

export function ShabbatScreen({ onEmergency }: { onEmergency: () => void }) {
  const { data, me } = useStore()
  const s = data?.shabbat
  const list = useMemo(() => (data ? myActivities(data, me) : []), [data, me])
  if (!s) return null
  const day = new Date(s.havdalah).toLocaleDateString('en-CA', { timeZone: 'Europe/Rome' })
  const items = list.filter((a) => a.day === day)
  return (
    <main className="fixed inset-0 overflow-y-auto bg-[#1E2A44] text-[#F6F0E4] pt-safe pb-safe">
      <button className="absolute end-4 top-[calc(var(--safe-top)+12px)] grid h-11 w-11 place-items-center rounded-full bg-white/10 text-[#FF9C8A]" onClick={onEmergency} aria-label="כרטיס חירום"><Shield size={20} /></button>
      <div className="mx-auto max-w-md px-6 pt-20 text-center">
        <div className="mx-auto mb-6 flex w-fit gap-3" aria-hidden>
          {[0, 1].map((i) => <span key={i} className="block h-16 w-3 rounded-sm bg-[#F6F0E4]/90 shadow-[0_-10px_16px_-2px_rgb(255_200_90/0.9)]" />)}
        </div>
        <h1 className="text-[44px] leading-tight">שבת שלום</h1>
        <p className="mt-1 text-lg text-white/70">{s.title}</p>
        <div className="mx-auto mt-8 w-fit rounded-3xl bg-white/10 px-8 py-5">
          <div className="text-white/70">צאת השבת</div>
          <div className="tnum font-display text-[40px] leading-none">{romeHM(s.havdalah)}</div>
        </div>
        {items.length > 0 && (
          <ul className="mt-8 space-y-2 text-start">
            {items.map((a) => (
              <li key={a.id} className="flex gap-3 rounded-2xl bg-white/5 p-3">
                <span className="tnum w-12 font-bold text-white/60">{hm(a.start_time)}</span>
                <span className="text-lg"><bdi>{a.title}</bdi></span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-10 text-[15px] text-white/60">שיתוף המיקום וההתראות כבויים עד צאת השבת, וחוזרים לבד.</p>
      </div>
    </main>
  )
}

// ── התראות גם כשהאפליקציה סגורה ──────────────────────────────
export function PushCard({ onInstall }: { onInstall: () => void }) {
  const { api, me } = useStore()
  const toast = useToast()
  const [status, setStatus] = useState<PushStatus>(pushStatus)
  const [hidden, setHidden] = useState(() => { try { return !!localStorage.getItem('garda-push-hide') } catch { return false } })
  if (hidden || status === 'granted' || status === 'no-server' || status === 'unsupported') return null
  const hide = () => { try { localStorage.setItem('garda-push-hide', '1') } catch { /* ignore */ } setHidden(true) }
  return (
    <section className="mx-4 mb-3 rounded-3xl bg-surface2 p-4">
      <div className="flex items-start gap-3">
        <BellRing size={24} className="mt-0.5 shrink-0 text-green" />
        <div className="flex-1">
          <div className="font-semibold">לקבל הודעות גם כשהאפליקציה סגורה</div>
          <div className="text-[14px] text-muted">
            {status === 'needs-install' ? 'באייפון זה עובד רק אחרי "הוסף למסך הבית". פותחים משם ומפעילים.'
              : status === 'denied' ? 'ההתראות חסומות. אפשר לאפשר בהגדרות הטלפון ← התראות.'
              : 'הודעות חשובות ונקודות מפגש יגיעו גם כשהמסך נעול.'}
          </div>
        </div>
        <button className="-m-2 grid h-11 w-11 place-items-center text-muted" onClick={hide} aria-label="הסתר"><X size={18} /></button>
      </div>
      {status === 'needs-install' && <button className="btn-primary mt-3 w-full" onClick={onInstall}><Smartphone size={18} /> איך מוסיפים למסך הבית</button>}
      {status === 'default' && (
        <button className="btn-primary mt-3 w-full" onClick={async () => {
          if (!api || !me) return
          try { const r = await enablePush(api, me.id); setStatus(r); if (r === 'granted') toast('ההתראות הופעלו') } catch { toast('לא הצלחתי להפעיל. נסה שוב.') }
        }}><BellRing size={18} /> הפעל התראות</button>
      )}
    </section>
  )
}

// ── טיפ לפי מיקום ───────────────────────────────────────────
export function TipCard({ title, body, onClose }: { title: string; body: string; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 20000); return () => clearTimeout(t) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="fixed inset-x-3 z-[65] animate-rise" style={{ top: 'calc(var(--safe-top) + 70px)' }} role="status">
      <div className="flex items-start gap-3 rounded-3xl bg-lake p-4 text-white shadow-float">
        <span className="text-[13px] font-bold uppercase tracking-wide opacity-80">טיפ</span>
        <div className="flex-1"><div className="font-display text-lg leading-tight">{title}</div><p className="text-[15px] leading-snug">{body}</p></div>
        <button className="-m-2 grid h-11 w-11 place-items-center" onClick={onClose} aria-label="סגור"><X size={18} /></button>
      </div>
    </div>
  )
}

/** פופאפ קטן כשמישהו אחר קובע נקודת מפגש */
export function MeetingPopup({ meeting, onShow, onClose }: { meeting: Meeting; onShow: () => void; onClose: () => void }) {
  const { data } = useStore()
  const who = data?.members.find((m) => m.id === meeting.created_by)
  return (
    <div className="pointer-events-none fixed inset-x-0 z-[84] flex justify-center px-3" style={{ top: 'calc(var(--safe-top) + 8px)' }}>
      <article className="postcard postcard-important pointer-events-auto w-full max-w-md rounded-[22px] p-4" role="alertdialog" aria-label="נקודת מפגש חדשה">
        <div className="flex items-center gap-2 text-[14px] font-bold text-terra">
          {who && <Avatar member={who} size={28} />} נקודת מפגש מ{who?.name}
        </div>
        <p className="mt-1 font-display text-[22px] leading-snug"><bdi>{meeting.title}</bdi> · <span className="tnum">{romeHM(meeting.meet_at)}</span></p>
        <p className="text-[14px] text-muted">עוד {formatDuration(new Date(meeting.meet_at).getTime() - Date.now())}</p>
        <div className="mt-3 flex gap-2">
          <button className="btn flex-1 bg-terra text-white" onClick={onShow}><MapPin size={17} /> הראה על המפה</button>
          <button className="btn-ghost flex-1 bg-surface" onClick={onClose}>ראיתי</button>
        </div>
      </article>
    </div>
  )
}
