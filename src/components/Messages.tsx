import imageCompression from 'browser-image-compression'
import { BellRing, Check, ImagePlus, MapPin, Send, TriangleAlert, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { alertFeedback, QUICK_MESSAGES, readOf, recipientsOf, shouldPop, timeHM } from '../lib/messages'
import { useStore } from '../lib/store'
import { romeDate } from '../lib/time'
import type { Member, Message } from '../lib/types'
import { Avatar } from './Avatar'
import { useToast } from './Toast'

// ── גלויה שנופלת מלמעלה ─────────────────────────────────────
export function MessagePopups({ onShowOnMap }: { onShowOnMap: (lat: number, lng: number) => void }) {
  const { live, me, data, api } = useStore()
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const alerted = useRef(new Set<string>())
  const members = data?.members ?? []

  const queue = useMemo(() => {
    if (!me) return []
    return live.messages
      .filter((m) => shouldPop(m, me, members, live.reads) && !dismissed.has(m.id + (m.reminded_at ?? '')))
      .sort((a, b) => Number(b.important) - Number(a.important) || a.created_at.localeCompare(b.created_at))
  }, [live, me, members, dismissed])

  const cur = queue[0]
  const key = cur ? cur.id + (cur.reminded_at ?? '') : ''

  useEffect(() => {
    if (!cur || alerted.current.has(key)) return
    alerted.current.add(key)
    alertFeedback(cur.important)
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  const seen = () => {
    if (!cur || !me) return
    setDismissed((s) => new Set(s).add(key))
    void api?.markRead(cur.id, me.id).catch(() => {})
  }

  // הודעה רגילה נעלמת לבד; חשובה נשארת עד "ראיתי"
  useEffect(() => {
    if (!cur || cur.important) return
    const t = setTimeout(seen, 9000)
    return () => clearTimeout(t)
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!cur || !me) return null
  const sender = members.find((m) => m.id === cur.sender_id)
  return (
    <div className="pointer-events-none fixed inset-x-0 z-[85] flex justify-center px-3" style={{ top: 'calc(var(--safe-top) + 8px)' }}>
      {cur.important && <div className="pointer-events-auto fixed inset-0 -z-10 bg-black/35" aria-hidden />}
      <article
        key={key}
        role={cur.important ? 'alertdialog' : 'status'}
        aria-label={`הודעה מ${sender?.name ?? ''}`}
        className={`postcard pointer-events-auto relative w-full max-w-md overflow-hidden rounded-[22px] p-4 pe-[92px] ${cur.important ? 'postcard-important' : ''}`}
      >
        <Stamp member={sender} time={timeHM(cur.created_at)} />
        <div className="flex items-center gap-2 text-[14px] font-bold">
          {cur.important && <span className="inline-flex items-center gap-1 rounded-full bg-terra px-2 py-0.5 text-white"><TriangleAlert size={13} /> חשוב</span>}
          <span className="text-muted">מ{sender?.name ?? 'מישהו'}{cur.reminded_at ? ' · תזכורת' : ''}</span>
        </div>
        {cur.body !== '📷' && <p className="mt-1.5 font-display text-[22px] leading-snug text-ink"><bdi>{cur.body}</bdi></p>}
        {cur.photo_path && <MessagePhoto path={cur.photo_path} className="mt-2 max-h-56" />}
        <div className="mt-3 flex gap-2">
          <button className={`btn flex-1 text-white ${cur.important ? 'bg-terra' : 'bg-green'}`} onClick={seen}><Check size={18} /> ראיתי</button>
          {cur.lat != null && cur.lng != null && (
            <button className="btn-ghost flex-1 bg-surface" onClick={() => { onShowOnMap(cur.lat!, cur.lng!); seen() }}><MapPin size={17} /> הראה על המפה</button>
          )}
        </div>
        {queue.length > 1 && <p className="mt-2 text-center text-[13px] text-muted">עוד {queue.length - 1} הודעות</p>}
      </article>
    </div>
  )
}

/** בול עם תמונת השולח וחותמת שעה */
function Stamp({ member, time }: { member?: Member; time: string }) {
  return (
    <div className="absolute end-3 top-3 rotate-3" aria-hidden>
      <div className="stamp grid h-[84px] w-[70px] place-items-center bg-surface p-1.5">
        {member ? <Avatar member={member} size={50} className="rounded-md" /> : null}
        <span className="text-[10px] font-bold tracking-wide text-muted">GARDA</span>
      </div>
      <div className="postmark tnum absolute -bottom-3 -start-6 grid h-12 w-12 place-items-center rounded-full text-[11px] font-bold">{time}</div>
    </div>
  )
}

// ── כתיבת הודעה ─────────────────────────────────────────────
export function ComposeSheet({ onClose, shareLocation }: { onClose: () => void; shareLocation: boolean }) {
  const { me, data, api, refreshLive } = useStore()
  const toast = useToast()
  const [body, setBody] = useState('')
  const [important, setImportant] = useState(false)
  const [audience, setAudience] = useState<Message['audience']>('all')
  const [picked, setPicked] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo.url) }, [photo])
  if (!me || !data) return null
  const people = data.members.filter((m) => m.active && !m.guardian_id && m.id !== me.id)

  const pickPhoto = async (f: File | undefined) => {
    if (!f) return
    try {
      const blob = await imageCompression(f, { maxWidthOrHeight: 1600, maxSizeMB: 0.9, initialQuality: 0.85, fileType: 'image/jpeg', useWebWorker: true })
      setPhoto({ blob, url: URL.createObjectURL(blob) })
    } catch { setErr('לא הצלחתי לקרוא את התמונה') }
  }

  const send = async (text = body) => {
    const t = text.trim() || (photo ? '📷' : '')
    if (!t || !api) return
    if (audience === 'custom' && !picked.length) { setErr('בחר למי לשלוח'); return }
    setBusy(true); setErr(null)
    // מצרפים מיקום להודעה רק אם שיתוף המיקום שלי פעיל
    const pos = shareLocation ? await currentPositionIfAllowed() : null
    try {
      const photo_path = photo ? await api.uploadMessagePhoto(me.id, photo.blob) : null
      await api.sendMessage({
        sender_id: me.id, body: t, important, audience, photo_path,
        household_id: audience === 'household' ? me.household_id : null,
        recipients: audience === 'custom' ? picked : null,
        lat: pos?.lat ?? null, lng: pos?.lng ?? null,
      })
      await refreshLive()
      toast(important ? 'ההודעה החשובה נשלחה' : 'ההודעה נשלחה')
      onClose()
    } catch {
      setErr(navigator.onLine ? 'השליחה נכשלה. נסה שוב.' : 'אין קליטה. נסה שוב כשתהיה רשת.')
    } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-[75] flex items-end bg-black/40" onClick={onClose}>
      <div className="max-h-[92dvh] w-full overflow-y-auto rounded-t-[28px] bg-surface p-5 pb-[calc(20px+var(--safe-bottom))] animate-rise" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl">הודעה למשפחה</h2>
          <button className="grid h-11 w-11 place-items-center text-muted" onClick={onClose} aria-label="סגור"><X size={22} /></button>
        </div>

        <span className="label">הודעה מהירה</span>
        <div className="-mx-5 mb-4 flex gap-2 overflow-x-auto px-5 no-scrollbar">
          {QUICK_MESSAGES.map((q) => (
            <button key={q} disabled={busy} className="min-h-[44px] shrink-0 rounded-full bg-greenSoft px-4 font-semibold text-green" onClick={() => (q.endsWith('…?') ? setBody(q.replace('…?', ' ')) : send(q))}>{q}</button>
          ))}
        </div>

        <label className="label" htmlFor="msg-body">או כתוב בעצמך</label>
        <textarea id="msg-body" className="input min-h-[88px] py-2" maxLength={500} value={body} onChange={(e) => setBody(e.target.value)} placeholder="מה קורה?" />
        {photo ? (
          <div className="relative mt-2 w-fit">
            <img src={photo.url} alt="התמונה שתישלח" className="max-h-44 rounded-2xl object-cover" />
            <button className="absolute end-1.5 top-1.5 grid h-9 w-9 place-items-center rounded-full bg-black/55 text-white" onClick={() => setPhoto(null)} aria-label="הסר תמונה"><X size={17} /></button>
          </div>
        ) : (
          <button className="btn-ghost mt-2 w-full" onClick={() => fileRef.current?.click()}><ImagePlus size={19} /> הוסף תמונה</button>
        )}
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { void pickPhoto(e.target.files?.[0]); e.target.value = '' }} />

        <span className="label mt-4">למי</span>
        <div className="grid grid-cols-3 gap-1 rounded-2xl bg-surface2 p-1" role="radiogroup">
          {([['all', 'כולם'], ['household', 'המשפחה שלי'], ['custom', 'אנשים מסוימים']] as const).map(([k, l]) => (
            <button key={k} role="radio" aria-checked={audience === k} onClick={() => setAudience(k)}
              className={`min-h-[44px] rounded-xl text-[15px] font-semibold ${audience === k ? 'bg-surface shadow-card' : 'text-muted'}`}>{l}</button>
          ))}
        </div>
        {audience === 'custom' && (
          <div className="mt-3 flex flex-wrap gap-3">
            {people.map((m) => {
              const on = picked.includes(m.id)
              return (
                <button key={m.id} className="flex w-[60px] flex-col items-center gap-1" aria-pressed={on}
                  onClick={() => setPicked(on ? picked.filter((x) => x !== m.id) : [...picked, m.id])}>
                  <span className="relative">
                    <Avatar member={m} size={48} dim={!on} />
                    {on && <span className="absolute -bottom-1 -end-1 grid h-5 w-5 place-items-center rounded-full bg-green text-white"><Check size={13} /></span>}
                  </span>
                  <span className="w-full truncate text-center text-[13px]">{m.name}</span>
                </button>
              )
            })}
          </div>
        )}

        <label className={`mt-4 flex min-h-[56px] items-center gap-3 rounded-2xl border-2 px-4 ${important ? 'border-terra bg-terraSoft' : 'border-line'}`}>
          <BellRing size={20} className={important ? 'text-terra' : 'text-muted'} />
          <span className="flex-1">
            <span className="block font-semibold">הודעה חשובה</span>
            <span className="block text-[14px] text-muted">נשארת על המסך עד שלוחצים "ראיתי", ואתה רואה מי ראה</span>
          </span>
          <input type="checkbox" checked={important} onChange={(e) => setImportant(e.target.checked)} className="h-6 w-6 accent-[rgb(var(--terra))]" />
        </label>

        {err && <p role="alert" className="mt-3 font-semibold text-terra">{err}</p>}
        <button className={`btn mt-4 w-full text-lg text-white ${important ? 'bg-terra' : 'bg-green'}`} disabled={busy || (!body.trim() && !photo)} onClick={() => send()}>
          <Send size={19} /> {busy ? 'שולח…' : 'שלח'}
        </button>
      </div>
    </div>
  )
}

async function currentPositionIfAllowed(): Promise<{ lat: number; lng: number } | null> {
  try {
    const st = await navigator.permissions?.query({ name: 'geolocation' as PermissionName })
    if (st?.state !== 'granted') return null
    return await new Promise((res) => navigator.geolocation.getCurrentPosition(
      (p) => res({ lat: p.coords.latitude, lng: p.coords.longitude }), () => res(null), { timeout: 4000, maximumAge: 60000 }))
  } catch { return null }
}

// ── היסטוריית הודעות של היום ────────────────────────────────
export function MessageHistory({ onCompose }: { onCompose: () => void }) {
  const { live, me, data, api, refreshLive } = useStore()
  const toast = useToast()
  const [open, setOpen] = useState<string | null>(null)
  if (!me || !data) return null
  const today = romeDate(new Date())
  const list = live.messages.filter((m) => romeDate(new Date(m.created_at)) === today)
  if (!list.length) {
    return (
      <div className="mx-4 flex items-center gap-3 rounded-2xl bg-surface2 p-4">
        <p className="flex-1 text-muted">עוד אין הודעות היום.</p>
        <button className="btn-primary" onClick={onCompose}>שלח הודעה</button>
      </div>
    )
  }
  return (
    <ul className="mx-4 space-y-2">
      {list.map((m) => {
        const sender = data.members.find((x) => x.id === m.sender_id)
        const mine = m.sender_id === me.id
        const rec = recipientsOf(m, data.members)
        const seenBy = rec.filter((x) => readOf(m, x.id, live.reads) && !(m.reminded_at && readOf(m, x.id, live.reads)!.read_at < m.reminded_at))
        const notSeen = rec.filter((x) => !seenBy.includes(x))
        const expanded = open === m.id
        return (
          <li key={m.id} className={`rounded-2xl border-2 bg-bg p-3 ${m.important ? 'border-terra' : 'border-transparent'}`}>
            <button className="flex w-full items-start gap-3 text-start" onClick={() => setOpen(expanded ? null : m.id)}>
              {sender && <Avatar member={sender} size={36} />}
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-[14px] text-muted">
                  <b className="text-ink">{mine ? 'אני' : sender?.name}</b>
                  <span className="tnum">{timeHM(m.created_at)}</span>
                  {m.important && <span className="rounded-full bg-terra px-1.5 text-[12px] font-bold text-white">חשוב</span>}
                  {m.audience !== 'all' && <span>· {m.audience === 'household' ? 'למשפחה' : `ל-${rec.length}`}</span>}
                </span>
                {m.body !== '📷' && <span className="block text-[16px] leading-snug"><bdi>{m.body}</bdi></span>}
                {mine && (
                  <span className="mt-1 flex items-center gap-2 text-[14px] font-semibold text-green">
                    <span className="tnum">{seenBy.length} מתוך {rec.length} ראו</span>
                    <span className="flex -space-x-1.5 space-x-reverse">{seenBy.slice(0, 6).map((x) => <Avatar key={x.id} member={x} size={20} />)}</span>
                  </span>
                )}
              </span>
            </button>
            {m.photo_path && <MessagePhoto path={m.photo_path} className="ms-12 mt-2 max-h-48" />}
            {mine && expanded && (
              <div className="mt-3 border-t border-line pt-3">
                {notSeen.length > 0 ? (
                  <>
                    <p className="mb-2 text-[14px] text-muted">עוד לא ראו:</p>
                    <div className="mb-3 flex flex-wrap gap-2">
                      {notSeen.map((x) => <span key={x.id} className="flex items-center gap-1.5 rounded-full bg-surface2 py-1 pe-3 ps-1"><Avatar member={x} size={24} dim /><span className="text-[14px]">{x.name}</span></span>)}
                    </div>
                    <button className="btn w-full bg-terraSoft text-terra" onClick={async () => {
                      try { await api?.remind(m.id); await refreshLive(); toast(`נשלחה תזכורת ל-${notSeen.length}`) } catch { toast('לא הצלחתי לשלוח תזכורת') }
                    }}><BellRing size={18} /> שלח תזכורת למי שלא ראה</button>
                  </>
                ) : <p className="text-[14px] font-semibold text-green">כולם ראו</p>}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/** תמונה בהודעה; נגיעה פותחת אותה במסך מלא */
function MessagePhoto({ path, className = '' }: { path: string; className?: string }) {
  const { photoUrl, signPhotos } = useStore()
  const [full, setFull] = useState(false)
  useEffect(() => { signPhotos([path]) }, [path]) // eslint-disable-line react-hooks/exhaustive-deps
  const u = photoUrl(path)
  if (!u) return <div className={`h-32 w-44 animate-pulse rounded-2xl bg-surface2 ${className}`} />
  return (
    <>
      <button className="block" onClick={(e) => { e.stopPropagation(); setFull(true) }} aria-label="הגדל תמונה">
        <img src={u} alt="תמונה בהודעה" className={`rounded-2xl object-cover ${className}`} />
      </button>
      {full && (
        <div className="fixed inset-0 z-[95] grid place-items-center bg-black/90 p-3" onClick={() => setFull(false)} role="dialog" aria-label="תמונה">
          <img src={u} alt="" className="max-h-full max-w-full object-contain" />
          <button className="absolute end-3 top-[calc(var(--safe-top)+10px)] grid h-11 w-11 place-items-center rounded-full bg-white/15 text-white" aria-label="סגור"><X size={22} /></button>
        </div>
      )}
    </>
  )
}
