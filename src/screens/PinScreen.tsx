import { Lock } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Avatar } from '../components/Avatar'
import type { PickMember } from '../lib/api'
import { useStore } from '../lib/store'

const ERR: Record<string, string> = {
  bad_pin: 'הקוד לא נכון. נסה שוב.',
  too_many: 'יותר מדי ניסיונות. נסה שוב בעוד רבע שעה.',
  no_pin: 'עוד לא הוגדר קוד משפחתי. בקש ממנהל להגדיר.',
  network: 'אין חיבור לשרת. בדוק קליטה ונסה שוב.',
  auth: 'הכניסה האנונימית כבויה ב-Supabase. צריך להפעיל אותה.',
  no_member: 'המשתתף הזה כבר לא קיים. בחר שוב.',
}

export function PinScreen() {
  const { api, enter } = useStore()
  const [digits, setDigits] = useState(['', '', '', ''])
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [members, setMembers] = useState<PickMember[] | null>(null)
  const [shake, setShake] = useState(0)
  const refs = useRef<(HTMLInputElement | null)[]>([])
  const pin = digits.join('')

  useEffect(() => { refs.current[0]?.focus() }, [])

  useEffect(() => {
    if (pin.length !== 4 || !api || busy) return
    setBusy(true)
    setErr(null)
    api.checkPin(pin).then((r) => {
      setBusy(false)
      if (r.members) { setMembers(r.members); return }
      setErr(ERR[r.error ?? ''] ?? 'משהו השתבש. נסה שוב.')
      setShake((s) => s + 1)
      setDigits(['', '', '', ''])
      setTimeout(() => refs.current[0]?.focus(), 50)
    })
  }, [pin]) // eslint-disable-line react-hooks/exhaustive-deps

  const pick = async (m: PickMember) => {
    if (!api) return
    setBusy(true)
    const r = await api.join(pin, m.id)
    setBusy(false)
    if (r.ok) await enter(m.id)
    else setErr(ERR[r.error ?? ''] ?? 'משהו השתבש. נסה שוב.')
  }

  const onInput = (i: number, v: string) => {
    const clean = v.replace(/\D/g, '')
    if (clean.length > 1) { // הדבקה של קוד שלם
      const arr = clean.slice(0, 4).split('')
      setDigits([0, 1, 2, 3].map((k) => arr[k] ?? ''))
      refs.current[Math.min(3, arr.length)]?.focus()
      return
    }
    const next = [...digits]
    next[i] = clean
    setDigits(next)
    if (clean && i < 3) refs.current[i + 1]?.focus()
  }

  if (members) {
    return (
      <main className="min-h-full bg-bg px-5 pt-safe pb-safe">
        <div className="mx-auto max-w-md pt-10 animate-rise">
          <h1 className="text-center text-[30px]">מי אתה?</h1>
          <p className="mt-1 text-center text-muted">לחץ על עצמך. הטלפון יזכור אותך.</p>
          {err && <p role="alert" className="mt-4 rounded-2xl bg-terraSoft p-3 text-center font-semibold text-terra">{err}</p>}
          <div className="mt-8 grid grid-cols-3 gap-x-3 gap-y-6">
            {members.map((m) => (
              <button key={m.id} disabled={busy} className="flex flex-col items-center gap-2 rounded-2xl p-1 active:scale-95 transition" onClick={() => pick(m)}>
                <Avatar member={m} size={76} />
                <span className="text-[17px] font-semibold">{m.name}</span>
              </button>
            ))}
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-full flex-col items-center bg-bg px-6 pt-safe pb-safe">
      <div className="flex w-full max-w-sm flex-1 flex-col items-center justify-center animate-rise">
        <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="h-20 w-20 rounded-[22px] shadow-card" />
        <h1 className="mt-5 text-[32px] leading-tight">טואטי בגארדה</h1>
        <p className="text-muted"><bdi>27.9 – 4.10.2026</bdi></p>
        <label htmlFor="pin-0" className="mt-10 flex items-center gap-2 text-[17px] font-semibold"><Lock size={18} /> הקוד המשפחתי</label>
        <div key={shake} className={`mt-3 flex gap-3 ${shake ? 'animate-shake' : ''}`} dir="ltr">
          {digits.map((d, i) => (
            <input
              key={i}
              id={`pin-${i}`}
              ref={(el) => { refs.current[i] = el }}
              value={d}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={4}
              disabled={busy}
              aria-label={`ספרה ${i + 1}`}
              onChange={(e) => onInput(i, e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Backspace' && !d && i > 0) refs.current[i - 1]?.focus() }}
              className="tnum h-16 w-14 rounded-2xl border-2 border-line bg-surface text-center font-display text-3xl outline-none transition focus:border-green"
            />
          ))}
        </div>
        <p role="alert" className="mt-4 min-h-[48px] text-center font-semibold text-terra">{busy ? <span className="text-muted">בודק…</span> : err}</p>
      </div>
      <p className="pb-4 text-center text-sm text-muted">אין קוד? בקש מיתיר או מאלרואי.</p>
    </main>
  )
}
