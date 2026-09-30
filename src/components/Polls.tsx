import { Check, Plus, Vote, X } from 'lucide-react'
import { useState } from 'react'
import { ago } from '../lib/geo'
import { useStore } from '../lib/store'
import type { Poll } from '../lib/types'
import { Avatar } from './Avatar'
import { useToast } from './Toast'

const QUESTIONS = ['איפה אוכלים הערב?', 'מתי יוצאים מחר?', 'מה עושים אחר הצהריים?', 'מי בא לבריכה?']
const OPEN_HOURS = 24

/** סקרים שמוצגים עכשיו: פתוחים מהיממה האחרונה. סקר שנסגר נעלם מיד */
export function usePolls() {
  const { live } = useStore()
  const now = Date.now()
  return live.polls.filter((p) => !p.closed && (now - new Date(p.created_at).getTime()) / 3600_000 < OPEN_HOURS)
}

export function PollCard({ poll }: { poll: Poll }) {
  const { live, data, me, api, refreshLive } = useStore()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const votes = live.votes.filter((v) => v.poll_id === poll.id)
  const mine = votes.find((v) => v.member_id === me?.id)?.option
  const who = data?.members.find((m) => m.id === poll.created_by)
  const people = (data?.members ?? []).filter((m) => m.active && !m.guardian_id).length
  const counts = poll.options.map((_, i) => votes.filter((v) => v.option === i).length)
  const top = Math.max(...counts)
  const canClose = poll.created_by === me?.id || !!me?.is_admin

  const vote = async (i: number) => {
    if (!api || !me || poll.closed || busy) return
    setBusy(true)
    try { await api.vote(poll.id, me.id, mine === i ? null : i); await refreshLive() } catch { toast('ההצבעה לא נשמרה. בדוק קליטה.') }
    setBusy(false)
  }

  return (
    <section className="mx-4 mb-3 rounded-3xl border-2 border-green/30 bg-surface p-4 shadow-card" aria-label="סקר">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-green text-white"><Vote size={20} /></span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-green">{poll.closed ? 'הסקר נסגר' : 'סקר'} · {who?.name} · {ago(poll.created_at)}</div>
          <h3 className="font-display text-xl leading-tight"><bdi>{poll.question}</bdi></h3>
        </div>
      </div>
      <div className="mt-3 space-y-2">
        {poll.options.map((o, i) => {
          const n = counts[i]
          const pct = votes.length ? Math.round((n / votes.length) * 100) : 0
          const voters = votes.filter((v) => v.option === i).map((v) => data?.members.find((m) => m.id === v.member_id)).filter((m): m is NonNullable<typeof m> => !!m)
          const win = poll.closed && n === top && n > 0
          return (
            <button key={i} disabled={poll.closed || busy} onClick={() => vote(i)} aria-pressed={mine === i}
              className={`relative flex min-h-[48px] w-full items-center gap-2 overflow-hidden rounded-2xl border-2 px-3 text-start transition ${mine === i ? 'border-green' : 'border-line'} ${win ? 'bg-lemon/30' : 'bg-surface2'}`}>
              <span className="absolute inset-y-0 start-0 bg-green/15 transition-all duration-500" style={{ width: `${pct}%` }} aria-hidden />
              <span className="relative flex-1 font-semibold"><bdi>{o}</bdi>{win ? ' 🏆' : ''}</span>
              {voters.length > 0 && (
                <span className="relative flex -space-x-2 space-x-reverse">{voters.slice(0, 4).map((m) => <Avatar key={m.id} member={m} size={24} />)}</span>
              )}
              <span className="tnum relative w-9 text-end text-sm font-bold text-muted">{votes.length ? `${pct}%` : ''}</span>
              {mine === i && <Check size={16} className="relative text-green" />}
            </button>
          )
        })}
      </div>
      <div className="mt-2 flex items-center justify-between text-[14px] text-muted">
        <span className="tnum">{votes.length} מתוך {people} הצביעו{!poll.closed && mine != null ? ' · לחיצה נוספת מבטלת' : ''}</span>
        {canClose && !poll.closed && (
          <button className="font-semibold text-terra" onClick={async () => {
            const win = top > 0 ? poll.options[counts.indexOf(top)] : null
            try { await api?.closePoll(poll.id); await refreshLive(); toast(win ? `הסקר נסגר · ניצח: ${win} 🏆` : 'הסקר נסגר') } catch { toast('לא הצלחתי לסגור') }
          }}>סגור סקר</button>
        )}
      </div>
    </section>
  )
}

export function PollComposer({ onClose }: { onClose: () => void }) {
  const { me, api, refreshLive } = useStore()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [opts, setOpts] = useState(['', ''])
  const [busy, setBusy] = useState(false)
  const clean = opts.map((o) => o.trim()).filter(Boolean)
  const ok = q.trim() && clean.length >= 2

  const send = async () => {
    if (!api || !me || !ok) return
    setBusy(true)
    try {
      await api.createPoll({ created_by: me.id, question: q.trim(), options: clean })
      await refreshLive(); toast('הסקר נשלח לכולם'); onClose()
    } catch { toast('לא הצלחתי לשלוח. בדוק קליטה.') }
    setBusy(false)
  }

  return (
    <div className="fixed inset-0 z-[75] flex items-end bg-black/40" onClick={onClose}>
      <div className="max-h-[92dvh] w-full overflow-y-auto rounded-t-[28px] bg-surface p-5 pb-[calc(20px+var(--safe-bottom))] animate-rise" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl">סקר משפחתי</h2>
          <button className="grid h-11 w-11 place-items-center text-muted" onClick={onClose} aria-label="סגור"><X size={22} /></button>
        </div>
        <label className="label" htmlFor="poll-q">השאלה</label>
        <input id="poll-q" className="input" maxLength={120} placeholder="למשל: איפה אוכלים הערב?" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="no-scrollbar -mx-5 mt-2 flex gap-2 overflow-x-auto px-5">
          {QUESTIONS.map((s) => (
            <button key={s} onClick={() => setQ(s)} className={`min-h-[36px] shrink-0 rounded-full px-3 text-[14px] font-semibold ${q === s ? 'bg-green text-white' : 'bg-surface2'}`}>{s}</button>
          ))}
        </div>
        <div className="label mt-4">אפשרויות</div>
        <div className="space-y-2">
          {opts.map((o, i) => (
            <div key={i} className="flex gap-2">
              <input className="input flex-1" maxLength={60} placeholder={`אפשרות ${i + 1}`} value={o}
                onChange={(e) => setOpts(opts.map((x, k) => (k === i ? e.target.value : x)))} />
              {opts.length > 2 && (
                <button className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-surface2 text-muted" onClick={() => setOpts(opts.filter((_, k) => k !== i))} aria-label="הסר אפשרות"><X size={18} /></button>
              )}
            </div>
          ))}
        </div>
        {opts.length < 6 && (
          <button className="btn-ghost mt-2 w-full" onClick={() => setOpts([...opts, ''])}><Plus size={18} /> עוד אפשרות</button>
        )}
        <button className="btn-primary mt-4 w-full text-lg" disabled={!ok || busy} onClick={send}><Vote size={20} /> {busy ? 'שולח…' : 'שלח לכולם'}</button>
      </div>
    </div>
  )
}
