import { Lightbulb, LocateFixed, MessageCircle, Trash2, Vote, X } from 'lucide-react'
import { useState } from 'react'
import type { LatLng } from '../lib/geo'
import { ago } from '../lib/geo'
import { useStore } from '../lib/store'
import type { Place, PlaceTip } from '../lib/types'
import { Avatar } from './Avatar'
import { useToast } from './Toast'

export type PostKind = 'message' | 'poll' | 'tip'

/** כפתור אחד בפלוס: בוחרים מה לשלוח למשפחה */
export function PostChooser({ onPick, onClose }: { onPick: (k: PostKind) => void; onClose: () => void }) {
  const items: { k: PostKind; icon: React.ReactNode; title: string; sub: string; tone: string }[] = [
    { k: 'message', icon: <MessageCircle size={24} />, title: 'הודעה', sub: 'לכולם, למשפחה שלי או לאנשים מסוימים', tone: 'bg-green text-white' },
    { k: 'poll', icon: <Vote size={24} />, title: 'סקר', sub: 'שאלה עם אפשרויות, וכולם מצביעים', tone: 'bg-[#2E8B57] text-white' },
    { k: 'tip', icon: <Lightbulb size={24} />, title: 'טיפ למקום', sub: 'המלצה שתקפוץ למי שמגיע למקום', tone: 'bg-lemon text-[#3A2E00]' },
  ]
  return (
    <div className="fixed inset-0 z-[75] flex items-end bg-black/40" onClick={onClose}>
      <div className="w-full rounded-t-[28px] bg-surface p-5 pb-[calc(20px+var(--safe-bottom))] animate-rise" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl">מה שולחים למשפחה?</h2>
          <button className="grid h-11 w-11 place-items-center text-muted" onClick={onClose} aria-label="סגור"><X size={22} /></button>
        </div>
        <div className="space-y-2.5">
          {items.map((it) => (
            <button key={it.k} className="flex w-full items-center gap-3 rounded-3xl bg-surface2 p-3.5 text-start active:scale-[.98] transition" onClick={() => onPick(it.k)}>
              <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${it.tone}`}>{it.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-bold">{it.title}</span>
                <span className="block text-[14px] text-muted">{it.sub}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

const TIP_IDEAS = ['הכי טעים פה ה...', 'יש חניה חינם ב...', 'שווה להגיע לפני...', 'לילדים יש פה...']

export function TipComposer({ dayPlaces, myPos, onClose }: { dayPlaces: Place[]; myPos: LatLng | null; onClose: () => void }) {
  const { data, me, api, refreshLive } = useStore()
  const toast = useToast()
  const [body, setBody] = useState('')
  const [where, setWhere] = useState<string>(dayPlaces[0]?.id ?? (myPos ? 'me' : ''))
  const [busy, setBusy] = useState(false)
  const places = data?.places ?? []
  const place = places.find((p) => p.id === where) ?? null
  const ok = body.trim() && (place || (where === 'me' && myPos))

  const send = async () => {
    if (!api || !me || !ok) return
    setBusy(true)
    const at = place ?? myPos!
    try {
      await api.addTip({ created_by: me.id, place_id: place?.id ?? null, lat: at.lat, lng: at.lng, place_name: place ? (place.name_he ?? place.name) : null, body: body.trim() })
      await refreshLive(); toast('הטיפ נשמר. הוא יקפוץ למי שיגיע למקום'); onClose()
    } catch { toast('לא הצלחתי לשמור. בדוק קליטה.') }
    setBusy(false)
  }

  const chip = (id: string, label: React.ReactNode) => (
    <button key={id} onClick={() => setWhere(id)} className={`flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-full px-3 text-[15px] font-semibold ${where === id ? 'bg-ink text-bg' : 'bg-surface2'}`}>{label}</button>
  )
  return (
    <div className="fixed inset-0 z-[75] flex items-end bg-black/40" onClick={onClose}>
      <div className="max-h-[92dvh] w-full overflow-y-auto rounded-t-[28px] bg-surface p-5 pb-[calc(20px+var(--safe-bottom))] animate-rise" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-xl"><Lightbulb size={22} className="text-[#B7791F]" /> טיפ למקום</h2>
          <button className="grid h-11 w-11 place-items-center text-muted" onClick={onClose} aria-label="סגור"><X size={22} /></button>
        </div>
        <div className="label">איפה?</div>
        <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
          {myPos && chip('me', <><LocateFixed size={16} /> איפה שאני עכשיו</>)}
          {dayPlaces.map((p) => chip(p.id, p.name_he ?? p.name))}
        </div>
        <select className="input mt-2" value={dayPlaces.some((p) => p.id === where) || where === 'me' ? '' : where} onChange={(e) => e.target.value && setWhere(e.target.value)} aria-label="מקום אחר">
          <option value="">מקום אחר…</option>
          {places.map((p) => <option key={p.id} value={p.id}>{p.name_he ?? p.name}</option>)}
        </select>
        <label className="label mt-4" htmlFor="tip-body">הטיפ</label>
        <textarea id="tip-body" className="input min-h-[96px] py-3" maxLength={200} placeholder="למשל: הכי טעים פה הפיסטוק, ושווה להגיע לפני 11" value={body} onChange={(e) => setBody(e.target.value)} />
        <div className="no-scrollbar -mx-5 mt-2 flex gap-2 overflow-x-auto px-5">
          {TIP_IDEAS.map((t) => <button key={t} onClick={() => setBody(t)} className="min-h-[34px] shrink-0 rounded-full bg-surface2 px-3 text-[14px]">{t}</button>)}
        </div>
        <button className="btn-primary mt-4 w-full text-lg" disabled={!ok || busy} onClick={send}><Lightbulb size={20} /> {busy ? 'שומר…' : 'שמור טיפ'}</button>
      </div>
    </div>
  )
}

/** טיפים של המשפחה בכרטיס המקום */
export function PlaceTips({ tips }: { tips: PlaceTip[] }) {
  const { data, me, api, refreshLive } = useStore()
  if (!tips.length) return null
  return (
    <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto">
      {tips.map((t) => {
        const m = data?.members.find((x) => x.id === t.created_by)
        return (
          <li key={t.id} className="flex items-start gap-2 rounded-2xl bg-lemon/25 p-2.5">
            {m && <Avatar member={m} size={28} />}
            <div className="min-w-0 flex-1 text-[15px] leading-snug">
              <span className="text-[13px] font-semibold text-muted">💡 {m?.name} · {ago(t.created_at)}</span>
              <div><bdi>{t.body}</bdi></div>
            </div>
            {(t.created_by === me?.id || me?.is_admin) && (
              <button className="grid h-8 w-8 place-items-center text-muted" aria-label="מחק טיפ" onClick={async () => { try { await api?.deleteTip(t.id); await refreshLive() } catch { /* ignore */ } }}><Trash2 size={14} /></button>
            )}
          </li>
        )
      })}
    </ul>
  )
}
