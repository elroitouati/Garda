import { Camera, ChevronLeft, LogOut, RefreshCw, Share, Smartphone, SquarePlus, UserCog, Users } from 'lucide-react'
import { useState } from 'react'
import { Avatar } from '../components/Avatar'
import { Overlay } from '../components/Overlay'
import { useToast } from '../components/Toast'
import { useStore } from '../lib/store'
import { Admin } from './Admin'
import { AvatarSetup } from './AvatarSetup'

export function Settings({ onClose }: { onClose: () => void }) {
  const { me, data, api, enter, leave, refresh, offline } = useStore()
  const toast = useToast()
  const [view, setView] = useState<'main' | 'switch' | 'photo' | 'admin' | 'install'>('main')
  const [busy, setBusy] = useState(false)
  if (!me || !data) return null
  const household = data.households.find((h) => h.id === me.household_id)

  if (view === 'photo') return <AvatarSetup member={me} title="תמונת פרופיל" onDone={() => setView('main')} onSkip={() => setView('main')} />
  if (view === 'admin') return <Admin onClose={() => setView('main')} />

  if (view === 'switch') {
    return (
      <Overlay title="החלף משתמש" onClose={() => setView('main')}>
        <p className="px-5 pt-4 text-muted">מי משתמש בטלפון הזה?</p>
        <div className="grid grid-cols-3 gap-x-3 gap-y-5 p-5">
          {data.members.filter((m) => m.active && !m.guardian_id).map((m) => (
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
