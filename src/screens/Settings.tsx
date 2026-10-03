import { Camera, ChevronLeft, Check, LogOut, Plane, Play, RefreshCw, Share, Smartphone, SquarePlus, UserCog, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Avatar } from '../components/Avatar'
import { Overlay } from '../components/Overlay'
import { useToast } from '../components/Toast'
import { groupByHousehold } from '../lib/members'
import { useStore } from '../lib/store'
import { Admin } from './Admin'
import { JourneyPrep } from './JourneyPrep'
import { Journey, MASA_EVENT, readMasa, type MasaState } from '../components/Journey'

type Mode = 'locked' | 'open' | 'end'
const MODES: [Mode, string, string][] = [
  ['locked', 'האפליקציה הרגילה', 'הסרט נעול, רק מנהלים רואים אותו'],
  ['open', 'האפליקציה + הסרט', 'כולם מקבלים התראה והסרט נפתח להם פעם אחת'],
  ['end', 'מסך סיום 🎬', '"הכנו לכם סרטון", צופים, ואחר כך האלבום המלא'],
]
import { AvatarSetup } from './AvatarSetup'

export function Settings({ onClose }: { onClose: () => void }) {
  const { me, data, api, enter, leave, refresh, offline } = useStore()
  const toast = useToast()
  const [view, setView] = useState<'main' | 'switch' | 'photo' | 'admin' | 'install' | 'journey' | 'masa'>('main')
  const [busy, setBusy] = useState(false)
  // מה כולם רואים: נעול / אפליקציה + הסרט / מסך סיום. בחירה מבקשת לחיצה שנייה לאישור
  const [masa, setMasa] = useState<MasaState | null>(null)
  const [arm, setArm] = useState<Mode | null>(null)
  useEffect(() => { if (me?.is_admin) api?.journeyLoad().then((d) => setMasa(readMasa(d))).catch(() => {}) }, [api, me?.is_admin])
  useEffect(() => { if (!arm) return; const t = window.setTimeout(() => setArm(null), 4000); return () => clearTimeout(t) }, [arm])
  const mode: Mode | null = masa ? (masa.end ? 'end' : masa.open ? 'open' : 'locked') : null
  const choose = async (m: Mode) => {
    if (!api || !me || m === mode) return
    if (arm !== m) { setArm(m); return }
    setArm(null)
    const next: MasaState = { open: m !== 'locked', end: m === 'end' }
    try {
      await api.journeySave('release', { ...next, at: new Date().toISOString() }, me.id)
      setMasa(next)
      try { localStorage.setItem('garda-masa-seen', '1') } catch { /* ignore */ }
      window.dispatchEvent(new CustomEvent(MASA_EVENT, { detail: next }))
      toast(m === 'locked' ? 'המסע נעול שוב' : !masa?.open ? 'שוחרר! כולם מקבלים התראה ✈️' : 'עודכן לכולם')
    } catch { toast('לא הצלחתי לעדכן. בדוק קליטה.') }
  }
  if (!me || !data) return null
  const household = data.households.find((h) => h.id === me.household_id)

  if (view === 'photo') return <AvatarSetup member={me} title="תמונת פרופיל" onDone={() => setView('main')} onSkip={() => setView('main')} />
  if (view === 'admin') return <Admin onClose={() => setView('main')} />
  if (view === 'journey') return <JourneyPrep onClose={() => setView('main')} />
  if (view === 'masa') return <Journey onClose={() => setView('main')} />

  if (view === 'switch') {
    return (
      <Overlay title="החלף משתמש" onClose={() => setView('main')}>
        <p className="px-5 pt-4 text-muted">מי משתמש בטלפון הזה?</p>
        <div className="space-y-5 p-5">
          {groupByHousehold(data.members.filter((m) => m.active && !m.guardian_id), (m) => m.household_id, data.households, me.household_id).map((g) => (
            <section key={g.id || 'rest'}>
              {data.households.length > 1 && g.name && <h2 className="mb-3 text-[15px] font-semibold text-muted">{g.name}</h2>}
              <div className="grid grid-cols-3 gap-x-3 gap-y-5">
                {g.members.map((m) => (
                  <button key={m.id} disabled={busy} className="flex flex-col items-center gap-2" onClick={async () => {
                    if (!api) return
                    setBusy(true)
                    const r = await api.switchMember(m.id)
                    setBusy(false)
                    if (r.ok) { await enter(m.id); toast(`שלום ${m.name}`); onClose() } else toast('לא הצלחתי להחליף. בדוק קליטה.')
                  }}>
                    <Avatar member={m} size={68} ring={m.id === me.id} />
                    <span className="font-semibold">{m.name}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </Overlay>
    )
  }

  if (view === 'install') {
    return (
      <Overlay title="הוספה למסך הבית" onClose={() => setView('main')}>
        <div className="space-y-4 p-5 text-[17px] leading-relaxed">
          <section className="card p-4">
            <h2 className="text-lg">אייפון (Safari)</h2>
            <ol className="mt-2 list-decimal space-y-1 ps-5">
              <li>פותחים את הקישור ב-Safari.</li>
              <li>לוחצים על כפתור השיתוף <Share size={17} className="inline" aria-label="שיתוף" /> בתחתית המסך.</li>
              <li>גוללים ובוחרים "הוסף למסך הבית" <SquarePlus size={17} className="inline" aria-hidden />.</li>
              <li>לוחצים "הוסף". מעכשיו פותחים מהאייקון.</li>
            </ol>
          </section>
          <section className="card p-4">
            <h2 className="text-lg">אנדרואיד (Chrome)</h2>
            <ol className="mt-2 list-decimal space-y-1 ps-5">
              <li>לוחצים על שלוש הנקודות למעלה.</li>
              <li>בוחרים "התקן אפליקציה" או "הוסף למסך הבית".</li>
            </ol>
          </section>
          <p className="text-muted">אחרי ההתקנה הלו"ז, המידע החיוני וכרטיס החירום עובדים גם בלי קליטה.</p>
        </div>
      </Overlay>
    )
  }

  const Row = ({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) => (
    <button className={`flex min-h-[56px] w-full items-center gap-3 px-4 text-start text-[17px] font-semibold ${danger ? 'text-terra' : ''}`} onClick={onClick}>
      <span className="text-muted">{icon}</span><span className="flex-1">{label}</span><ChevronLeft size={18} className="text-muted" />
    </button>
  )

  return (
    <Overlay title="הגדרות" onClose={onClose}>
      <div className="flex flex-col items-center gap-2 p-6">
        <button onClick={() => setView('photo')} className="relative" aria-label="החלף תמונה">
          <Avatar member={me} size={96} />
          <span className="absolute -bottom-1 -start-1 grid h-9 w-9 place-items-center rounded-full bg-green text-white shadow-float"><Camera size={18} /></span>
        </button>
        <div className="font-display text-2xl">{me.name}</div>
        {household && <div className="text-muted">{household.name}</div>}
      </div>
      <div className="mx-4 divide-y divide-line overflow-hidden rounded-3xl bg-surface shadow-card">
        <Row icon={<Camera size={20} />} label="החלף תמונת פרופיל" onClick={() => setView('photo')} />
        <Row icon={<Users size={20} />} label="החלף משתמש" onClick={() => setView('switch')} />
        <Row icon={<Smartphone size={20} />} label="הוספה למסך הבית" onClick={() => setView('install')} />
        {me.is_admin && <Row icon={<UserCog size={20} />} label="ניהול הטיול" onClick={() => setView('admin')} />}
        {me.is_admin && <Row icon={<Plane size={20} />} label="חומרים למסע ✈️" onClick={() => setView('journey')} />}
        {me.is_admin && <Row icon={<Play size={20} />} label="צפייה במסע" onClick={() => setView('masa')} />}
        {me.is_admin && mode && (
          <div className="border-t border-line px-4 py-3">
            <div className="mb-2 text-[14px] font-bold text-muted">מה כולם רואים כשהם פותחים את האפליקציה?</div>
            <div className="flex flex-col gap-2" role="radiogroup" aria-label="מה כולם רואים">
              {MODES.map(([k, title, sub]) => (
                <button key={k} role="radio" aria-checked={mode === k} onClick={() => choose(k)}
                  className={`flex min-h-[56px] items-center gap-3 rounded-2xl px-3 text-start ${arm === k ? 'bg-terra text-white' : mode === k ? 'bg-greenSoft ring-2 ring-green' : 'bg-surface2'}`}>
                  <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 ${mode === k ? 'border-green bg-green text-white' : arm === k ? 'border-white' : 'border-line'}`}>{mode === k && <Check size={14} />}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[16px] font-bold">{arm === k ? 'לחץ שוב לאישור' : title}</span>
                    <span className={`block text-[13px] ${arm === k ? 'text-white/90' : 'text-muted'}`}>{sub}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
        <Row icon={<RefreshCw size={20} />} label={offline ? 'רענן נתונים (אין קליטה)' : 'רענן נתונים'} onClick={async () => { await refresh(); toast('הנתונים עודכנו') }} />
      </div>
      <div className="mx-4 mt-4 overflow-hidden rounded-3xl bg-surface shadow-card">
        <Row icon={<LogOut size={20} />} label="נתק את הטלפון הזה" danger onClick={async () => {
          if (confirm('לנתק את הטלפון? תצטרך להקליד שוב את הקוד המשפחתי.')) { await leave(); onClose() }
        }} />
      </div>
      <p className="p-6 text-center text-sm text-muted">
        עודכן לאחרונה: <bdi className="tnum">{new Date(data.fetchedAt).toLocaleString('he-IL', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'numeric' })}</bdi>
      </p>
    </Overlay>
  )
}
