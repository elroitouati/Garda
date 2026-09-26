import { Check, KeyRound, Plus, Trash2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Avatar } from '../components/Avatar'
import { Overlay } from '../components/Overlay'
import { PLACE_KINDS, PlaceIcon } from '../components/PlaceIcon'
import { useToast } from '../components/Toast'
import { MEMBER_COLORS } from '../lib/members'
import { useStore } from '../lib/store'
import { hm, shortDate, weekdayLetter } from '../lib/time'
import type { Activity, EmergencyContact, Household, Member, Place } from '../lib/types'
import { AvatarSetup } from './AvatarSetup'

type Tab = 'members' | 'households' | 'schedule' | 'places' | 'pin'
const TABS: [Tab, string][] = [['members', 'משתתפים'], ['households', 'משפחות'], ['schedule', 'לו"ז'], ['places', 'מקומות'], ['pin', 'קוד']]
const rid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 8)}`

export function Admin({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('members')
  return (
    <Overlay title="ניהול הטיול" onClose={onClose}>
      <div className="no-scrollbar sticky top-0 z-10 flex gap-2 overflow-x-auto bg-bg px-4 py-3">
        {TABS.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`min-h-[44px] shrink-0 rounded-full px-4 font-semibold ${tab === k ? 'bg-green text-white' : 'bg-surface2'}`}>{l}</button>
        ))}
      </div>
      {tab === 'members' && <MembersTab />}
      {tab === 'households' && <HouseholdsTab />}
      {tab === 'schedule' && <ScheduleTab />}
      {tab === 'places' && <PlacesTab />}
      {tab === 'pin' && <PinTab />}
    </Overlay>
  )
}

// ── עזרים ──
function useSave() {
  const { api, refresh } = useStore()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const run = async (fn: () => Promise<void>, ok = 'נשמר') => {
    setBusy(true)
    try { await fn(); await refresh(); toast(ok); return true }
    catch (e) { console.error(e); alert('השמירה נכשלה. בדוק קליטה ונסה שוב.'); return false }
    finally { setBusy(false) }
  }
  return { api: api!, busy, run }
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-[75] flex items-end bg-black/40" onClick={onClose}>
      <div className="max-h-[92dvh] w-full overflow-y-auto rounded-t-[28px] bg-surface p-5 pb-[calc(20px+var(--safe-bottom))] animate-rise" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-xl">{title}</h2>
        {children}
      </div>
    </div>
  )
}

const Field = ({ label, children }: { label: string; children: ReactNode }) => <label className="mb-3 block"><span className="label">{label}</span>{children}</label>
const Toggle = ({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) => (
  <label className="mb-3 flex min-h-[44px] items-center justify-between gap-3">
    <span className="font-semibold">{label}</span>
    <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} className="h-6 w-6 accent-[rgb(var(--green))]" />
  </label>
)
const AddButton = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <button className="btn-primary mx-4 mb-4 w-[calc(100%-2rem)]" onClick={onClick}><Plus size={18} /> {label}</button>
)
const FormButtons = ({ busy, onSave, onDelete }: { busy: boolean; onSave: () => void; onDelete?: () => void }) => (
  <div className="mt-4 flex gap-2">
    <button className="btn-primary flex-1" disabled={busy} onClick={onSave}><Check size={18} /> שמור</button>
    {onDelete && <button className="btn-ghost text-terra" disabled={busy} onClick={onDelete} aria-label="מחק"><Trash2 size={18} /></button>}
  </div>
)

// ── משתתפים ──
function MembersTab() {
  const { data } = useStore()
  const { api, busy, run } = useSave()
  const [edit, setEdit] = useState<Member | null>(null)
  const [photoFor, setPhotoFor] = useState<Member | null>(null)
  if (!data) return null
  if (photoFor) return <AvatarSetup member={photoFor} title={`תמונה ל${photoFor.name}`} onDone={() => setPhotoFor(null)} onSkip={() => setPhotoFor(null)} />
  const hh = (id: string) => data.households.find((h) => h.id === id)?.name ?? id
  const adults = data.members.filter((m) => !m.guardian_id && m.active)
  return (
    <>
      <AddButton label="הוסף משתתף" onClick={() => setEdit({ id: '', name: '', color: MEMBER_COLORS[data.members.length % MEMBER_COLORS.length], initials: null, household_id: data.households[0]?.id ?? 'tuati', is_admin: false, guardian_id: null, avatar_path: null, sort: data.members.length + 1, active: true })} />
      <ul className="mx-4 divide-y divide-line overflow-hidden rounded-3xl bg-surface shadow-card">
        {data.members.map((m) => (
          <li key={m.id}>
            <button className={`flex min-h-[64px] w-full items-center gap-3 px-4 text-start ${m.active ? '' : 'opacity-50'}`} onClick={() => setEdit(m)}>
              <Avatar member={m} size={44} />
              <span className="flex-1">
                <span className="block font-semibold">{m.name}{m.is_admin && <span className="ms-2 rounded-full bg-greenSoft px-2 text-xs text-green">מנהל</span>}</span>
                <span className="block text-sm text-muted">{hh(m.household_id)}{m.guardian_id ? ` · עם ${data.members.find((x) => x.id === m.guardian_id)?.name ?? ''}` : ''}{m.active ? '' : ' · לא פעיל'}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {edit && (
        <Sheet title={edit.id ? `עריכת ${edit.name}` : 'משתתף חדש'} onClose={() => setEdit(null)}>
          <Field label="שם"><input className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
          <Field label="אותיות (אופציונלי, עד 2)"><input className="input" maxLength={2} value={edit.initials ?? ''} onChange={(e) => setEdit({ ...edit, initials: e.target.value || null })} /></Field>
          <div className="mb-3">
            <span className="label">צבע</span>
            <div className="flex flex-wrap gap-2">
              {MEMBER_COLORS.map((c) => (
                <button key={c} className="grid h-11 w-11 place-items-center rounded-full" style={{ background: c }} onClick={() => setEdit({ ...edit, color: c })} aria-label={c}>
                  {edit.color === c && <Check size={20} className="text-white" />}
                </button>
              ))}
            </div>
          </div>
          <Field label="משפחה">
            <select className="input" value={edit.household_id} onChange={(e) => setEdit({ ...edit, household_id: e.target.value })}>
              {data.households.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          </Field>
          <Field label="בלי טלפון? מוצג יחד עם">
            <select className="input" value={edit.guardian_id ?? ''} onChange={(e) => setEdit({ ...edit, guardian_id: e.target.value || null })}>
              <option value="">יש לו טלפון משלו</option>
              {adults.filter((a) => a.id !== edit.id).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>
          <Toggle label="מנהל" value={edit.is_admin} onChange={(v) => setEdit({ ...edit, is_admin: v })} />
          <Toggle label="פעיל בטיול" value={edit.active} onChange={(v) => setEdit({ ...edit, active: v })} />
          {edit.id && <button className="btn-ghost mb-2 w-full" onClick={() => { setPhotoFor(edit); setEdit(null) }}>תמונת פרופיל</button>}
          <FormButtons busy={busy} onSave={async () => {
            if (!edit.name.trim()) return alert('צריך שם')
            const row = { ...edit, id: edit.id || rid('m'), name: edit.name.trim() }
            if (await run(() => api.upsert('members', row))) setEdit(null)
          }} />
        </Sheet>
      )}
    </>
  )
}

// ── משפחות + טלפונים לכרטיס החירום ──
function HouseholdsTab() {
  const { data } = useStore()
  const { api, busy, run } = useSave()
  const [edit, setEdit] = useState<Household | null>(null)
  const [contacts, setContacts] = useState<EmergencyContact[]>([])
  const [removed, setRemoved] = useState<string[]>([])
  if (!data) return null
  const open = (h: Household) => {
    setEdit(h)
    setContacts(data.emergency.filter((c) => c.household_id === h.id).map((c) => ({ ...c })))
    setRemoved([])
  }
  return (
    <>
      <p className="mx-5 mb-3 text-[15px] text-muted">כל משתתף שייך למשפחה. מידע חיוני ופעילויות פרטיות מוצגים רק למשפחה שלהם.</p>
      <AddButton label="הוסף משפחה" onClick={() => open({ id: '', name: '', sort: data.households.length })} />
      <ul className="mx-4 divide-y divide-line overflow-hidden rounded-3xl bg-surface shadow-card">
        {data.households.map((h) => (
          <li key={h.id}>
            <button className="flex min-h-[64px] w-full items-center gap-3 px-4 text-start" onClick={() => open(h)}>
              <span className="flex -space-x-2 space-x-reverse">
                {data.members.filter((m) => m.household_id === h.id).slice(0, 4).map((m) => <Avatar key={m.id} member={m} size={32} />)}
              </span>
              <span className="flex-1 font-semibold">{h.name}</span>
              <span className="text-sm text-muted">{data.members.filter((m) => m.household_id === h.id && m.active).length} אנשים</span>
            </button>
          </li>
        ))}
      </ul>
      {edit && (
        <Sheet title={edit.id ? edit.name : 'משפחה חדשה'} onClose={() => setEdit(null)}>
          <Field label="שם המשפחה"><input className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
          <span className="label">טלפונים לכרטיס החירום</span>
          {contacts.map((c, i) => (
            <div key={c.id || i} className="mb-2 grid grid-cols-[1fr_1fr_auto] gap-2">
              <input className="input" placeholder="שם באנגלית" dir="ltr" value={c.name_latin ?? ''} onChange={(e) => setContacts(contacts.map((x, k) => (k === i ? { ...x, name_latin: e.target.value, name: x.name || e.target.value } : x)))} />
              <input className="input tnum" placeholder="+972…" dir="ltr" inputMode="tel" value={c.phone} onChange={(e) => setContacts(contacts.map((x, k) => (k === i ? { ...x, phone: e.target.value } : x)))} />
              <button className="grid h-11 w-11 place-items-center text-terra" aria-label="הסר" onClick={() => { if (c.id) setRemoved([...removed, c.id]); setContacts(contacts.filter((_, k) => k !== i)) }}><Trash2 size={18} /></button>
            </div>
          ))}
          <button className="btn-ghost mb-2 w-full" onClick={() => setContacts([...contacts, { id: '', household_id: edit.id, name: '', name_latin: '', role: null, phone: '', sort: contacts.length + 1 }])}><Plus size={16} /> הוסף טלפון</button>
          <FormButtons busy={busy} onSave={async () => {
            if (!edit.name.trim()) return alert('צריך שם')
            const id = edit.id || rid('h')
            const ok = await run(async () => {
              await api.upsert('households', { ...edit, id, name: edit.name.trim() })
              for (const rm of removed) await api.remove('emergency_contacts', 'id', rm)
              for (const c of contacts) {
                const row: Record<string, unknown> = { ...c, household_id: id, name: c.name || c.name_latin || '—' }
                if (!row.id) delete row.id
                await api.upsert('emergency_contacts', row)
              }
            })
            if (ok) setEdit(null)
          }} />
        </Sheet>
      )}
    </>
  )
}

// ── לו"ז ──
function ScheduleTab() {
  const { data } = useStore()
  const { api, busy, run } = useSave()
  const [day, setDay] = useState(() => data?.days[0]?.date ?? '')
  const [edit, setEdit] = useState<Activity | null>(null)
  if (!data) return null
  const list = data.activities.filter((a) => a.day === day).sort((a, b) => a.start_time.localeCompare(b.start_time))
  const placeName = (id: string | null) => data.places.find((p) => p.id === id)?.name_he ?? ''
  return (
    <>
      <div className="no-scrollbar mb-3 flex gap-2 overflow-x-auto px-4">
        {data.days.map((d) => (
          <button key={d.date} onClick={() => setDay(d.date)} className={`min-h-[44px] shrink-0 rounded-2xl px-3 text-sm font-semibold ${day === d.date ? 'bg-green text-white' : 'bg-surface2'}`}>
            {weekdayLetter(d.date)} <bdi className="tnum">{shortDate(d.date)}</bdi>
          </button>
        ))}
      </div>
      <AddButton label="הוסף פעילות" onClick={() => setEdit({ id: '', day, start_time: '10:00', end_time: null, title: '', place_id: null, option_group: null, household_id: null, notes: null, sort: list.length + 1 })} />
      <ul className="mx-4 divide-y divide-line overflow-hidden rounded-3xl bg-surface shadow-card">
        {list.length === 0 && <li className="p-4 text-muted">אין פעילויות ביום הזה.</li>}
        {list.map((a) => (
          <li key={a.id}>
            <button className="flex min-h-[60px] w-full items-center gap-3 px-4 py-2 text-start" onClick={() => setEdit({ ...a, start_time: hm(a.start_time), end_time: a.end_time ? hm(a.end_time) : null })}>
              <span className="tnum w-12 font-bold text-muted">{hm(a.start_time)}</span>
              <span className="flex-1">
                <span className="block font-semibold"><bdi>{a.title}</bdi></span>
                <span className="block text-sm text-muted">
                  {placeName(a.place_id)}
                  {a.option_group && ` · אופציה ${a.option_group === 'A' ? 'א׳' : 'ב׳'}`}
                  {a.household_id && ` · ${data.households.find((h) => h.id === a.household_id)?.name}`}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {edit && (
        <Sheet title={edit.id ? 'עריכת פעילות' : 'פעילות חדשה'} onClose={() => setEdit(null)}>
          <Field label="כותרת"><input className="input" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="התחלה"><input type="time" className="input tnum" value={edit.start_time} onChange={(e) => setEdit({ ...edit, start_time: e.target.value })} /></Field>
            <Field label="סיום"><input type="time" className="input tnum" value={edit.end_time ?? ''} onChange={(e) => setEdit({ ...edit, end_time: e.target.value || null })} /></Field>
          </div>
          <Field label="יום">
            <select className="input" value={edit.day} onChange={(e) => setEdit({ ...edit, day: e.target.value })}>
              {data.days.map((d) => <option key={d.date} value={d.date}>{weekdayLetter(d.date)} {shortDate(d.date)} · {d.title}</option>)}
            </select>
          </Field>
          <Field label="מקום">
            <select className="input" value={edit.place_id ?? ''} onChange={(e) => setEdit({ ...edit, place_id: e.target.value || null })}>
              <option value="">בלי מקום</option>
              {data.places.map((p) => <option key={p.id} value={p.id}>{p.name_he ?? p.name}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="אופציה">
              <select className="input" value={edit.option_group ?? ''} onChange={(e) => setEdit({ ...edit, option_group: (e.target.value || null) as Activity['option_group'] })}>
                <option value="">לכולם</option><option value="A">אופציה א׳</option><option value="B">אופציה ב׳</option>
              </select>
            </Field>
            <Field label="מי רואה">
              <select className="input" value={edit.household_id ?? ''} onChange={(e) => setEdit({ ...edit, household_id: e.target.value || null })}>
                <option value="">משותף לכולם</option>
                {data.households.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
            </Field>
          </div>
          <Field label="הערות"><input className="input" value={edit.notes ?? ''} onChange={(e) => setEdit({ ...edit, notes: e.target.value || null })} /></Field>
          <FormButtons busy={busy}
            onSave={async () => {
              if (!edit.title.trim()) return alert('צריך כותרת')
              const row: Record<string, unknown> = { ...edit, title: edit.title.trim(), updated_at: new Date().toISOString() }
              if (!row.id) delete row.id
              if (await run(() => api.upsert('activities', row))) setEdit(null)
            }}
            onDelete={edit.id ? async () => { if (confirm('למחוק את הפעילות?') && (await run(() => api.remove('activities', 'id', edit.id), 'נמחק'))) setEdit(null) } : undefined}
          />
        </Sheet>
      )}
    </>
  )
}

// ── מקומות ──
function PlacesTab() {
  const { data } = useStore()
  const { api, busy, run } = useSave()
  const [edit, setEdit] = useState<Place | null>(null)
  if (!data) return null
  return (
    <>
      <AddButton label="הוסף מקום" onClick={() => setEdit({ id: '', name: '', name_he: '', kind: 'star', lat: 45.5362, lng: 10.5357, address: '', rain_plan: false, main: true, notes: null, sort: data.places.length + 1 })} />
      <ul className="mx-4 divide-y divide-line overflow-hidden rounded-3xl bg-surface shadow-card">
        {data.places.map((p) => (
          <li key={p.id}>
            <button className="flex min-h-[60px] w-full items-center gap-3 px-4 py-2 text-start" onClick={() => setEdit(p)}>
              <span className="grid h-10 w-10 place-items-center rounded-full bg-greenSoft text-green"><PlaceIcon kind={p.kind} size={18} /></span>
              <span className="flex-1">
                <span className="block font-semibold"><bdi>{p.name_he || p.name}</bdi></span>
                <span className="block text-sm text-muted"><bdi>{p.name}</bdi>{p.rain_plan ? ' · תוכנית גשם' : ''}{p.main ? '' : ' · מוסתר'}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {edit && (
        <Sheet title={edit.id ? 'עריכת מקום' : 'מקום חדש'} onClose={() => setEdit(null)}>
          <Field label="שם בעברית"><input className="input" value={edit.name_he ?? ''} onChange={(e) => setEdit({ ...edit, name_he: e.target.value })} /></Field>
          <Field label="שם מקורי"><input className="input" dir="ltr" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
          <Field label="סוג">
            <select className="input" value={edit.kind} onChange={(e) => setEdit({ ...edit, kind: e.target.value as Place['kind'] })}>
              {PLACE_KINDS.map((k) => <option key={k.kind} value={k.kind}>{k.label}</option>)}
            </select>
          </Field>
          <Field label="קואורדינטות (אפשר להדביק מגוגל מפות: 45.53, 10.54)">
            <input className="input tnum" dir="ltr" defaultValue={`${edit.lat}, ${edit.lng}`} onChange={(e) => {
              const m = e.target.value.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/)
              if (m) setEdit({ ...edit, lat: Number(m[1]), lng: Number(m[2]) })
            }} />
          </Field>
          <Field label="כתובת"><input className="input" dir="ltr" value={edit.address ?? ''} onChange={(e) => setEdit({ ...edit, address: e.target.value })} /></Field>
          <Toggle label="מוצג על המפה" value={edit.main} onChange={(v) => setEdit({ ...edit, main: v })} />
          <Toggle label="תוכנית גשם" value={edit.rain_plan} onChange={(v) => setEdit({ ...edit, rain_plan: v })} />
          <FormButtons busy={busy}
            onSave={async () => {
              if (!(edit.name_he || edit.name).trim()) return alert('צריך שם')
              const row = { ...edit, id: edit.id || rid('p'), name: edit.name || edit.name_he || '' }
              if (await run(() => api.upsert('places', row))) setEdit(null)
            }}
            onDelete={edit.id ? async () => { if (confirm('למחוק את המקום?') && (await run(() => api.remove('places', 'id', edit.id), 'נמחק'))) setEdit(null) } : undefined}
          />
        </Sheet>
      )}
    </>
  )
}

// ── קוד PIN ──
function PinTab() {
  const { api } = useStore()
  const toast = useToast()
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const valid = /^\d{4}$/.test(a) && a === b
  return (
    <div className="mx-4 rounded-3xl bg-surface p-5 shadow-card">
      <p className="mb-4 text-muted">קוד חדש מחליף את הישן. מי שכבר מחובר נשאר מחובר. רק כניסות חדשות יצטרכו את הקוד החדש.</p>
      <Field label="קוד חדש (4 ספרות)"><input className="input tnum text-center text-2xl tracking-widest" dir="ltr" inputMode="numeric" maxLength={4} value={a} onChange={(e) => setA(e.target.value.replace(/\D/g, ''))} /></Field>
      <Field label="שוב, לאימות"><input className="input tnum text-center text-2xl tracking-widest" dir="ltr" inputMode="numeric" maxLength={4} value={b} onChange={(e) => setB(e.target.value.replace(/\D/g, ''))} /></Field>
      {err && <p role="alert" className="mb-2 font-semibold text-terra">{err}</p>}
      <button className="btn-primary w-full" disabled={!valid} onClick={async () => {
        const r = await api!.setPin(a)
        if (r.ok) { toast('הקוד עודכן'); setA(''); setB(''); setErr(null) } else setErr('לא הצלחתי לעדכן. בדוק קליטה.')
      }}><KeyRound size={18} /> החלף קוד</button>
    </div>
  )
}
