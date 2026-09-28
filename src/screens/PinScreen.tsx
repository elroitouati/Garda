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
          <div className="mt-6 space-y-6 pb-6">
            {groupPicks(members).map((g) => (
              <section key={g.name}>
                {g.name && <h2 className="mb-3 text-center text-[15px] font-semibold text-muted">{g.name}</h2>}
                <div className="grid grid-cols-3 gap-x-3 gap-y-5">
                  {g.members.map((m) => (
                    <button key={m.id} disabled={busy} className="flex flex-col items-center gap-2 rounded-2xl p-1 active:scale-95 transition" onClick={() => pick(m)}>
                      <Avatar member={m} size={76} />
                      <span className="text-[17px] font-semibold">{m.name}</span>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-full flex-col items-center bg-bg pb-safe">
      {/* הנוף מהלוגו כרקע עליון, והלוגו יושב על הקצה */}
      <div className="relative h-[34dvh] min-h-[200px] w-full overflow-hidden">
        <img src={`${import.meta.env.BASE_URL}hero.jpg`} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: '45% 60%' }} />
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-bg to-transparent" aria-hidden />
      </div>
      <div className="-mt-16 flex w-full max-w-sm flex-1 flex-col items-center px-6 animate-rise">
        <img src={`${import.meta.env.BASE_URL}pwa-192.png`} alt="" className="h-28 w-28 rounded-[30px] shadow-card ring-4 ring-surface" />
        <h1 className="mt-4 text-[32px] leading-tight">טואטי בגארדה</h1>
        <p className="text-muted"><bdi>27.9 – 4.10.2026</bdi></p>
        <label htmlFor="pin-0" className="mt-8 flex items-center gap-2 text-[17px] font-semibold"><Lock size={18} /> הקוד המשפחתי</label>
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

/** השרת מחזיר את הרשימה כבר מסודרת לפי משפחה */
function groupPicks(list: PickMember[]) {
  const out: { name: string; members: PickMember[] }[] = []
  for (const m of list) {
    const name = m.household ?? ''
    const last = out[out.length - 1]
    if (last && last.name === name) last.members.push(m)
    else out.push({ name, members: [m] })
  }
  return out
}
