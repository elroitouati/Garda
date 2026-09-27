import { Camera, ChevronLeft, ImagePlus, MapPin, MessageCircle, Shield } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useStore } from '../lib/store'
import { romeDate, shortDate, weekdayLetter } from '../lib/time'
import type { Member } from '../lib/types'
import { AvatarSetup } from '../screens/AvatarSetup'
import { Avatar } from './Avatar'

// ── פוסטר אגם גארדה: שכבות שטוחות בסגנון פוסטר טיולים איטלקי ──
export function GardaPoster({ className = '', compact = false }: { className?: string; compact?: boolean }) {
  return (
    <svg viewBox="0 0 390 440" preserveAspectRatio={compact ? 'xMidYMid slice' : 'xMidYMax slice'} className={className} aria-hidden>
      <defs>
        <linearGradient id="gp-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--poster-sky-top)" />
          <stop offset="1" stopColor="var(--poster-sky-bottom)" />
        </linearGradient>
        <linearGradient id="gp-lake" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--poster-lake-top)" />
          <stop offset="1" stopColor="var(--poster-lake-bottom)" />
        </linearGradient>
      </defs>
      <rect width="390" height="440" fill="url(#gp-sky)" />
      {/* שמש */}
      <circle className="gp-sun" cx="270" cy="150" r="46" fill="var(--poster-sun)" />
      {/* הרים רחוקים (Monte Baldo) */}
      <path d="M0 250 L40 205 L78 228 L130 160 L175 212 L220 170 L262 205 L310 150 L352 196 L390 176 L390 280 L0 280 Z" fill="var(--poster-hill-far)" />
      <path d="M130 160 L148 183 L138 186 L130 176 L121 188 L114 182 Z M310 150 L326 172 L316 174 L310 166 L301 176 L295 171 Z" fill="var(--poster-snow)" opacity=".8" />
      {/* גבעות קרובות */}
      <path d="M0 268 C60 238 110 262 160 250 C220 236 270 262 330 246 C360 240 378 246 390 250 L390 300 L0 300 Z" fill="var(--poster-hill-near)" />
      {/* האגם */}
      <rect y="284" width="390" height="156" fill="url(#gp-lake)" />
      <g className="gp-glints" stroke="var(--poster-glint)" strokeWidth="3" strokeLinecap="round" opacity=".75">
        <path d="M40 318 h34 M120 336 h22 M226 322 h40 M300 344 h26 M70 372 h30 M180 360 h36 M268 392 h32 M20 410 h24 M140 404 h28" />
      </g>
      {/* סירמיונה: חצי אי עם המצודה */}
      <path d="M0 300 C30 296 60 300 82 306 L82 314 L0 318 Z" fill="var(--poster-hill-near)" />
      <g fill="var(--poster-castle)">
        <rect x="22" y="270" width="36" height="32" />
        <rect x="16" y="258" width="12" height="44" />
        <rect x="52" y="262" width="11" height="40" />
        <path d="M16 258 h3 v-5 h3 v5 h3 v-5 h3 v5 M52 262 h2.5 v-5 h3 v5 h2.5 v-5 h3 v5" stroke="var(--poster-castle)" strokeWidth="2" fill="none" />
      </g>
      {/* ברושים */}
      <g fill="var(--poster-cypress)">
        <path d="M338 300 C330 270 334 236 342 214 C350 236 354 270 346 300 Z" />
        <path d="M356 302 C350 280 352 252 360 234 C367 252 370 280 364 302 Z" />
        <path d="M372 304 C367 288 369 266 375 252 C381 266 383 288 378 304 Z" />
      </g>
      <path d="M300 306 C330 300 360 300 390 304 L390 312 L300 312 Z" fill="var(--poster-hill-near)" />
      {/* מפרשית */}
      <g className="gp-boat">
        <path d="M168 346 h52 l-8 10 h-36 Z" fill="var(--poster-castle)" />
        <path d="M192 344 V300 L218 342 Z" fill="var(--poster-sail)" />
        <path d="M189 344 V310 L172 342 Z" fill="var(--poster-sail)" opacity=".85" />
      </g>
    </svg>
  )
}

type Step = 'hero' | 'how' | 'photo' | 'location'

const ITALIAN = (h: number) => (h < 12 && h >= 5 ? 'Buongiorno' : h < 18 && h >= 12 ? 'Buon pomeriggio' : 'Buonasera')
const HEBREW = (h: number) => (h < 12 && h >= 5 ? 'בוקר טוב' : h < 18 && h >= 12 ? 'צהריים טובים' : 'ערב טוב')

export function Welcome({ full, onDone, onLeave, onLocation }: {
  full: boolean
  onDone: () => void
  /** נקרא ברגע שמתחילים לצאת, כדי שהמפה תתחיל לעוף פנימה במקביל */
  onLeave: () => void
  onLocation: (share: boolean) => void
}) {
  const { data, me } = useStore()
  const [step, setStep] = useState<Step>('hero')
  const [leaving, setLeaving] = useState(false)
  const [camera, setCamera] = useState(false)
  const [skipPhoto, setSkipPhoto] = useState(false)

  const now = new Date()
  const hour = Number(now.toLocaleString('en-GB', { timeZone: 'Europe/Rome', hour: '2-digit', hour12: false }))
  const today = romeDate(now)
  const days = data?.days ?? []
  const idx = days.findIndex((d) => d.date === today)
  const first = days[0]
  const daysToGo = first ? Math.ceil((new Date(`${first.date}T00:00:00+02:00`).getTime() - now.getTime()) / 86400000) : 0

  const finish = () => {
    if (leaving) return
    setLeaving(true)
    onLeave()
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    setTimeout(onDone, reduce ? 0 : 900)
  }
  const next = () => {
    if (!full) return finish()
    if (step === 'hero') setStep('how')
    else if (step === 'how') setStep(me && !me.avatar_path && !skipPhoto ? 'photo' : 'location')
    else if (step === 'photo') setStep('location')
    else finish()
  }
  // אחרי צילום סלפי ממשיכים לבד
  useEffect(() => { if (step === 'photo' && me?.avatar_path) setStep('location') }, [me?.avatar_path, step])

  if (!me) return null
  const steps: Step[] = full ? ['hero', 'how', ...(me.avatar_path ? [] : ['photo' as Step]), 'location'] : ['hero']

  return (
    <div className={`welcome fixed inset-0 z-[68] flex flex-col overflow-hidden bg-bg ${leaving ? 'is-leaving' : ''}`} role="dialog" aria-modal="true" aria-label="ברוכים הבאים">
      {/* הפוסטר: מלא במסך הראשון, מצטמצם לרצועה בשלבים הבאים */}
      <div className={`welcome-poster relative shrink-0 overflow-hidden transition-[height] duration-300 ${step === 'hero' ? 'h-[clamp(190px,40dvh,400px)]' : 'h-[clamp(110px,20dvh,210px)]'}`}>
        <img src={`${import.meta.env.BASE_URL}hero.jpg`} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: step === 'hero' ? '28% 55%' : '28% 70%' }} />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/15 to-transparent" aria-hidden />
        <div className="absolute inset-x-0 top-0 flex items-center justify-between px-5 pt-[calc(var(--safe-top)+14px)]">
          <span className="rounded-full bg-surface/85 px-3 py-1 text-[13px] font-semibold text-ink backdrop-blur"><bdi>Lago di Garda · Italia</bdi></span>
          <Avatar member={me} size={40} ring />
        </div>
      </div>

      <div className="welcome-body relative -mt-7 flex min-h-0 flex-1 flex-col rounded-t-[28px] bg-bg px-6 pt-6 pb-[calc(var(--safe-bottom)+16px)]">
        {/* התוכן נגלל אם צריך; הכפתור תמיד נשאר גלוי למטה */}
        <div className="-mx-6 flex min-h-0 flex-1 flex-col overflow-y-auto px-6">
        {step === 'hero' && (
          <div key="hero" className="step-in flex flex-1 flex-col">
            <p className="text-[15px] font-semibold text-terra"><bdi lang="it">{ITALIAN(hour)}</bdi> · {HEBREW(hour)}</p>
            <h1 className="mt-1 text-[clamp(28px,8.5vw,38px)] leading-[1.15]">{me.name},<br />ברוכים הבאים לגארדה</h1>
            <DayLine idx={idx} total={days.length} title={idx >= 0 ? days[idx].title : ''} date={idx >= 0 ? today : ''} daysToGo={daysToGo} />
          </div>
        )}

        {step === 'how' && (
          <div key="how" className="step-in flex flex-1 flex-col">
            <h2 className="text-[28px] leading-tight">ככה זה עובד</h2>
            <p className="mt-1 text-muted">הכל על מפה אחת. ארבעה כפתורים שכדאי להכיר:</p>
            <ul className="mt-4 space-y-3">
              <How icon={<span className="grid h-12 w-12 place-items-center rounded-full bg-green text-white"><Camera size={22} /></span>} title="המצלמה" text="כל תמונה נכנסת לאלבום המשפחתי ומופיעה על המפה." />
              <How icon={<span className="grid h-12 w-12 place-items-center rounded-full bg-surface text-ink shadow-card"><MessageCircle size={22} /></span>} title="הודעה למשפחה" text='"אין תור פה, בואו!" או הודעה חשובה שכולם חייבים לראות.' />
              <How icon={<span className="grid h-12 w-12 place-items-center rounded-full bg-surface text-terra shadow-card"><MapPin size={22} /></span>} title="נקודת מפגש" text="סיכה על המפה ושעה, ולכולם יש מסלול הליכה אליה." />
              <How icon={<span className="grid h-12 w-12 place-items-center rounded-full bg-surface text-danger shadow-card"><Shield size={22} /></span>} title="כרטיס חירום" text="באיטלקית, עם הטלפונים של ההורים. עובד גם בלי קליטה." />
            </ul>
          </div>
        )}

        {step === 'photo' && (
          <div key="photo" className="step-in flex flex-1 flex-col">
            <h2 className="text-[28px] leading-tight">תמונה שלך</h2>
            <p className="mt-1 text-muted">כדי שכולם יזהו אותך על המפה ובהודעות.</p>
            <div className="mt-6 flex items-center gap-4">
              <Avatar member={me as Member} size={84} />
              <div className="flex flex-1 flex-col gap-2">
                <button className="btn-primary" onClick={() => setCamera(true)}><Camera size={19} /> צלם סלפי</button>
                <button className="btn-ghost" onClick={() => setCamera(true)}><ImagePlus size={19} /> בחר תמונה</button>
              </div>
            </div>
          </div>
        )}

        {step === 'location' && (
          <div key="location" className="step-in flex flex-1 flex-col">
            <h2 className="text-[28px] leading-tight">שנראה אחד את השני?</h2>
            <p className="mt-2 text-[17px] leading-relaxed text-muted">
              כששיתוף המיקום פעיל, כולם רואים על המפה איפה כולם. נשמר רק המיקום האחרון, ונמחק אחרי הטיול.
              בשבת זה נכבה לבד.
            </p>
            <p className="mt-3 text-[15px] font-semibold text-ink">המיקום מתעדכן רק כשהאפליקציה פתוחה.</p>
            <div className="mt-auto flex flex-wrap justify-center gap-2 pt-6" aria-hidden>
              {(data?.members ?? []).filter((m) => m.active).map((m, i) => (
                <span key={m.id} className="animate-rise" style={{ animationDelay: `${i * 40}ms` }}><Avatar member={m} size={44} ring={m.id === me.id} /></span>
              ))}
            </div>
          </div>
        )}

        </div>

        {/* ניווט */}
        <div className="shrink-0 pt-4">
          {steps.length > 1 && (
            <div className="mb-4 flex justify-center gap-2" aria-hidden>
              {steps.map((s) => <span key={s} className={`h-2 rounded-full transition-all duration-300 ${s === step ? 'w-6 bg-green' : 'w-2 bg-line'}`} />)}
            </div>
          )}
          {step === 'location' ? (
            <>
              <button className="btn-primary w-full text-lg" onClick={() => { onLocation(true); finish() }}><MapPin size={20} /> שתף מיקום ויאללה למפה</button>
              <button className="btn mt-2 w-full text-muted" onClick={() => { onLocation(false); finish() }}>בלי מיקום בינתיים</button>
            </>
          ) : step === 'photo' ? (
            <button className="btn mt-1 w-full text-muted" onClick={() => { setSkipPhoto(true); next() }}>אחר כך</button>
          ) : (
            <button className="btn-primary w-full text-lg" onClick={next}>
              {full ? (step === 'hero' ? 'בואו נתחיל' : 'הבא') : 'יאללה למפה'} <ChevronLeft size={20} />
            </button>
          )}
        </div>
      </div>

      {camera && (
        <AvatarSetup member={me} title="תמונה שלך" onDone={() => { setCamera(false); setStep('location') }} onSkip={() => setCamera(false)} />
      )}
    </div>
  )
}

function DayLine({ idx, total, title, date, daysToGo }: { idx: number; total: number; title: string; date: string; daysToGo: number }) {
  if (idx >= 0) {
    return (
      <div className="mt-4 flex items-center gap-3 rounded-2xl bg-surface p-3 shadow-card">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-greenSoft font-display text-green">
          <span className="text-center leading-none"><span className="block text-[12px]">יום</span><span className="tnum block text-[24px]">{idx + 1}</span></span>
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] text-muted"><bdi className="tnum">{weekdayLetter(date)} {shortDate(date)}</bdi> · מתוך <bdi className="tnum">{total}</bdi></div>
          <div className="truncate font-display text-[22px] leading-tight"><bdi>{title}</bdi></div>
        </div>
      </div>
    )
  }
  if (daysToGo > 0) return <p className="mt-4 text-[17px] text-muted">עוד <bdi className="tnum">{daysToGo}</bdi> ימים לאגם. הכל מוכן.</p>
  return <p className="mt-4 text-[17px] text-muted">שבוע באגם, 12 אנשים, מפה אחת.</p>
}

function How({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <li className="flex items-center gap-4">
      <span className="shrink-0" aria-hidden>{icon}</span>
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="block text-[15px] leading-snug text-muted">{text}</span>
      </span>
    </li>
  )
}
