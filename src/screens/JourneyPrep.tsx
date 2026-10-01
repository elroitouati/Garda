import imageCompression from 'browser-image-compression'
import { Check, Heart, ImagePlus, Images, Plus, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { photoDay } from '../components/Album'
import { Avatar } from '../components/Avatar'
import { Overlay } from '../components/Overlay'
import { useToast } from '../components/Toast'
import { useStore } from '../lib/store'
import { shortDate, weekdayLetter } from '../lib/time'
import type { Photo } from '../lib/types'

// תמונה לחומרי המסע: מהאלבום (id) או שהועלתה (path)
type Img = { id?: string; path?: string } | null
type Data = Record<string, Record<string, unknown>>
const PLANES: [string, string][] = [['illustration', 'איור עדין ומעוצב'], ['real', 'צילום אמיתי של המטוס'], ['playful', 'מצויר וחמוד']]

/** חומרים ל"המסע": מנהלים ממלאים כאן כל מה שצריך לחוויה של סוף הטיול */
export function JourneyPrep({ onClose }: { onClose: () => void }) {
  const { api, me, data: trip, live, photoUrl, signPhotos } = useStore()
  const toast = useToast()
  const [d, setD] = useState<Data | null>(null)
  const [picker, setPicker] = useState<{ max: number; day?: string; selected: string[]; onDone: (ids: string[]) => void; onPhone?: () => void } | null>(null)
  const timers = useRef<Record<string, number>>({})
  const fileRef = useRef<HTMLInputElement>(null)
  const uploadCb = useRef<((path: string) => void) | null>(null)
  const [uploading, setUploading] = useState<string | null>(null)

  useEffect(() => { api?.journeyLoad().then(setD).catch(() => { setD({}); toast('לא הצלחתי לטעון. בדוק קליטה.') }) }, [api]) // eslint-disable-line react-hooks/exhaustive-deps
  // חותמים את התמונות שהועלו כדי להציג אותן
  useEffect(() => {
    if (!d) return
    const paths: string[] = []
    JSON.stringify(d, (k, v) => { if (k === 'path' && typeof v === 'string') paths.push(v); return v })
    if (paths.length) signPhotos(paths)
  }, [d]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { signPhotos(live.photos.map((p) => p.thumb_path)) }, [live.photos]) // eslint-disable-line react-hooks/exhaustive-deps

  const members = useMemo(() => (trip?.members ?? []).filter((m) => m.active).sort((a, b) => a.sort - b.sort), [trip])
  if (!trip || !me) return null

  const get = (key: string) => (d?.[key] ?? {}) as Record<string, unknown>
  const set = (key: string, patch: Record<string, unknown>, now = false) => {
    setD((cur) => {
      const next = { ...(cur ?? {}), [key]: { ...((cur ?? {})[key] ?? {}), ...patch } }
      clearTimeout(timers.current[key])
      const save = () => api?.journeySave(key, next[key], me.id).catch(() => toast('השמירה נכשלה. בדוק קליטה.'))
      if (now) void save(); else timers.current[key] = window.setTimeout(save, 700)
      return next
    })
  }

  const upload = (slot: string, cb: (path: string) => void) => { uploadCb.current = cb; setUploading(null); fileRef.current?.setAttribute('data-slot', slot); fileRef.current?.click() }
  const onFile = async (f: File | undefined) => {
    const slot = fileRef.current?.getAttribute('data-slot') ?? ''
    if (!f || !api || !uploadCb.current) return
    setUploading(slot)
    try {
      const blob = await imageCompression(f, { maxWidthOrHeight: 1800, maxSizeMB: 1.4, initialQuality: 0.88, fileType: 'image/jpeg', useWebWorker: true })
      const path = await api.uploadMessagePhoto(me.id, blob)
      signPhotos([path])
      uploadCb.current(path)
    } catch { toast('ההעלאה נכשלה. נסה שוב.') }
    setUploading(null)
  }

  const imgUrl = (img: Img) => {
    if (!img) return null
    if (img.path) return photoUrl(img.path)
    const p = live.photos.find((x) => x.id === img.id)
    return p ? photoUrl(p.thumb_path) : null
  }

  // ── התקדמות ──
  const progress = (() => {
    let total = 0, done = 0
    for (const m of members) { const p = get(`person:${m.id}`); total += 2; done += (p.face || m.avatar_path ? 1 : 0) + (String(p.line ?? '').trim() ? 1 : 0) }
    const g = get('general'); total += 3; done += (g.plane ? 1 : 0) + (g.arrival ? 1 : 0) + (g.group ? 1 : 0)
    for (const day of trip.days) { const x = get(`day:${day.date}`); total += 1; done += ((x.photoIds as string[] | undefined)?.length || x.byLikes) ? 1 : 0 }
    return total ? Math.round((done / total) * 100) : 0
  })()

  // ── רכיבים קטנים ──
  const ImgSlot = ({ img, slot, onSet, round, wide, label, album }: {
    img: Img; slot: string; onSet: (v: Img) => void; round?: boolean; wide?: boolean; label: string; album?: { day?: string }
  }) => {
    const u = imgUrl(img)
    const fromPhone = () => upload(slot, (path) => onSet({ path }))
    const fromAlbum = () => setPicker({ max: 1, day: album?.day, selected: img?.id ? [img.id] : [], onDone: (ids) => onSet(ids[0] ? { id: ids[0] } : null), onPhone: fromPhone })
    return (
      <div className={`flex ${wide ? 'flex-col' : 'items-center'} gap-2`}>
        <div role="button" tabIndex={0} onClick={album ? fromAlbum : fromPhone} className={`relative grid shrink-0 cursor-pointer place-items-center overflow-hidden border-2 ${u ? 'border-transparent' : 'border-dashed border-line'} bg-surface2 text-[13px] text-muted ${round ? 'h-20 w-20 rounded-full' : wide ? 'aspect-video w-full rounded-2xl' : 'h-20 w-20 rounded-2xl'}`}>
          {u ? <img src={u} alt="" className="absolute inset-0 h-full w-full object-cover" /> : label}
          {uploading === slot && <span className="absolute inset-0 grid place-items-center bg-black/40 font-bold text-white">מעלה…</span>}
          {img && <button className="absolute end-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-black/55 text-white" onClick={(e) => { e.stopPropagation(); onSet(null) }} aria-label="הסר"><X size={14} /></button>}
        </div>
        <div className={`flex gap-2 ${wide ? '' : 'flex-col'}`}>
          {album && (
            <button className="btn-ghost min-h-[40px] px-3 text-[14px]" onClick={fromAlbum}>
              <Images size={16} /> מהאלבום
            </button>
          )}
          <button className="btn-ghost min-h-[40px] px-3 text-[14px]" onClick={fromPhone}><ImagePlus size={16} /> מהטלפון</button>
        </div>
      </div>
    )
  }
  const H = ({ n, title, hint }: { n: string; title: string; hint?: string }) => (
    <div className="mt-7 px-4">
      <div className="flex items-baseline gap-2"><span className="text-[12px] font-bold tracking-wide text-terra">{n}</span><h2 className="text-xl">{title}</h2></div>
      {hint && <p className="mt-1 text-[14px] text-muted">{hint}</p>}
    </div>
  )

  const g = get('general')
  const stats = ((get('stats').rows as { label: string; value: string }[] | undefined) ?? [{ label: 'גלידות שנאכלו', value: '' }, { label: 'פעמים שמישהו הלך לאיבוד', value: '' }])

  return (
    <Overlay title="חומרים למסע ✈️" onClose={onClose}>
      {!d ? <p className="p-6 text-center text-muted">טוען…</p> : (
        <div className="pb-10">
          <div className="sticky top-0 z-10 border-b border-line bg-bg/95 px-4 py-3 backdrop-blur">
            <div className="mb-1.5 flex justify-between text-[13px] text-muted"><span>הכל נשמר לבד · מנהלים בלבד</span><b className="tnum text-ink">{progress}%</b></div>
            <div className="h-2 overflow-hidden rounded-full bg-surface2"><div className="h-full rounded-full bg-gradient-to-l from-terra to-green transition-all" style={{ width: `${progress}%` }} /></div>
          </div>

          <H n="01" title="כל אחד ורגע משלו" hint="תמונת פנים (תופיע בחלון המטוס), משפט אישי, והרגע שלו מהטיול. אם יש תמונת פרופיל, היא כבר בפנים." />
          <div className="mt-3 space-y-3 px-4">
            {members.map((m) => {
              const p = get(`person:${m.id}`)
              const face = p.face as Img | undefined
              const moment = p.moment as Img | undefined
              return (
                <div key={m.id} className="space-y-3 rounded-3xl bg-surface p-4 shadow-card">
                  <div className="flex items-center gap-3">
                    {face ? null : m.avatar_path ? (
                      <button onClick={() => upload(`face-${m.id}`, (path) => set(`person:${m.id}`, { face: { path } }, true))} aria-label="החלף תמונת פנים"><Avatar member={m} size={80} /></button>
                    ) : null}
                    {(face || !m.avatar_path) && <ImgSlot img={face ?? null} slot={`face-${m.id}`} round label="+ פנים" onSet={(v) => set(`person:${m.id}`, { face: v }, true)} />}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-lg font-bold"><span className="h-3 w-3 rounded-full" style={{ background: m.color }} />{m.name}</div>
                      {m.avatar_path && !face && (
                        <button className="mt-1 text-[14px] font-semibold text-green" onClick={() => upload(`face-${m.id}`, (path) => set(`person:${m.id}`, { face: { path } }, true))}>החלף לתמונה אחרת</button>
                      )}
                    </div>
                  </div>
                  <input className="input" maxLength={90} placeholder="משפט אישי: משהו שמתאר אותו בטיול" value={String(p.line ?? '')} onChange={(e) => set(`person:${m.id}`, { line: e.target.value })} />
                  <div className="text-[13px] font-semibold text-muted">הרגע שלו מהטיול</div>
                  <ImgSlot img={moment ?? null} slot={`moment-${m.id}`} label="+ תמונה" album={{}} onSet={(v) => set(`person:${m.id}`, { moment: v }, true)} />
                  <textarea className="input min-h-[64px] py-2" maxLength={160} placeholder="מה קרה? למשל: נהג בקארטינג כמו בפורמולה 1" value={String(p.momentText ?? '')} onChange={(e) => set(`person:${m.id}`, { momentText: e.target.value })} />
                </div>
              )
            })}
          </div>

          <H n="02" title="פתיחה וסיום" />
          <div className="mt-3 space-y-3 px-4">
            <div className="space-y-3 rounded-3xl bg-surface p-4 shadow-card">
              <b>המטוס בפתיחה</b>
              <div className="flex flex-wrap gap-2">
                {PLANES.map(([k, l]) => (
                  <button key={k} onClick={() => set('general', { plane: k }, true)} className={`min-h-[40px] rounded-full px-4 text-[15px] font-semibold ${g.plane === k ? 'bg-green text-white' : 'bg-surface2'}`}>{l}</button>
                ))}
              </div>
              <div className="text-[13px] text-muted">תמונה של המטוס שלכם (לא חובה)</div>
              <ImgSlot img={(g.planePhoto as Img) ?? null} slot="plane" label="+ מטוס" onSet={(v) => set('general', { planePhoto: v }, true)} />
            </div>
            <div className="space-y-2 rounded-3xl bg-surface p-4 shadow-card">
              <b>רגע ההגעה לגארדה</b>
              <ImgSlot img={(g.arrival as Img) ?? null} slot="arrival" wide label="+ תמונה" album={{ day: '2026-09-27' }} onSet={(v) => set('general', { arrival: v }, true)} />
            </div>
            <div className="space-y-2 rounded-3xl bg-surface p-4 shadow-card">
              <b>התמונה הקבוצתית לסיום</b>
              <ImgSlot img={(g.group as Img) ?? null} slot="group" wide label="+ תמונה" album={{}} onSet={(v) => set('general', { group: v }, true)} />
            </div>
          </div>

          <H n="03" title="יום אחרי יום" hint="עד 5 תמונות מהאלבום לכל יום, ומשפט שמסכם אותו. או: לבחור לפי הלבבות." />
          <div className="mt-3 space-y-3 px-4">
            {trip.days.map((day) => {
              const x = get(`day:${day.date}`)
              const ids = (x.photoIds as string[] | undefined) ?? []
              return (
                <div key={day.date} className="space-y-2.5 rounded-3xl bg-surface p-4 shadow-card">
                  <div className="flex items-baseline justify-between"><b className="text-lg">{day.title}</b><span className="tnum text-[13px] text-muted">{weekdayLetter(day.date)} {shortDate(day.date)}</span></div>
                  <div className="flex flex-wrap gap-2">
                    {ids.map((id) => {
                      const u = imgUrl({ id })
                      return <div key={id} className="h-16 w-16 overflow-hidden rounded-xl bg-surface2">{u && <img src={u} alt="" className="h-full w-full object-cover" />}</div>
                    })}
                    <button className="grid h-16 w-16 place-items-center rounded-xl border-2 border-dashed border-line text-muted" onClick={() => setPicker({ max: 5, day: day.date, selected: ids, onDone: (sel) => set(`day:${day.date}`, { photoIds: sel }, true) })} aria-label="בחר תמונות"><Plus size={20} /></button>
                  </div>
                  <button onClick={() => set(`day:${day.date}`, { byLikes: !x.byLikes }, true)} className={`flex min-h-[38px] items-center gap-1.5 rounded-full px-3 text-[14px] font-semibold ${x.byLikes ? 'bg-terra text-white' : 'bg-surface2'}`}><Heart size={15} /> תבחר לפי הלבבות</button>
                  <input className="input" maxLength={100} placeholder="משפט שמסכם את היום" value={String(x.caption ?? '')} onChange={(e) => set(`day:${day.date}`, { caption: e.target.value })} />
                </div>
              )
            })}
          </div>

          <H n="04" title="מספרים מצחיקים" hint="דברים שאין באפליקציה. תמונות, לבבות ותגובות אני סופר לבד." />
          <div className="mt-3 space-y-2 px-4">
            {stats.map((r, i) => (
              <div key={i} className="flex gap-2">
                <input className="input flex-[2]" maxLength={60} placeholder="מה סופרים?" value={r.label} onChange={(e) => set('stats', { rows: stats.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)) })} />
                <input className="input tnum flex-1" maxLength={20} placeholder="כמה?" value={r.value} onChange={(e) => set('stats', { rows: stats.map((x, k) => (k === i ? { ...x, value: e.target.value } : x)) })} />
                <button className="grid w-10 shrink-0 place-items-center text-muted" onClick={() => set('stats', { rows: stats.filter((_, k) => k !== i) }, true)} aria-label="מחק"><X size={18} /></button>
              </div>
            ))}
            <button className="btn-ghost w-full" onClick={() => set('stats', { rows: [...stats, { label: '', value: '' }] }, true)}><Plus size={18} /> עוד מספר</button>
          </div>

          <H n="05" title="הערות ובקשות" />
          <div className="mt-3 space-y-2 px-4">
            <input className="input" placeholder="שיר או אווירה מוזיקלית" value={String(g.music ?? '')} onChange={(e) => set('general', { music: e.target.value })} />
            <textarea className="input min-h-[90px] py-2" placeholder="רגעים שחייבים להיכנס, דברים שלא להכניס, רעיונות…" value={String(g.notes ?? '')} onChange={(e) => set('general', { notes: e.target.value })} />
          </div>
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = '' }} />
      {picker && <AlbumPicker {...picker} photos={live.photos} onClose={() => setPicker(null)} />}
    </Overlay>
  )
}

/** בחירת תמונות מהאלבום (לפי יום, או הכל) */
function AlbumPicker({ photos, day, max, selected, onDone, onClose, onPhone }: {
  photos: Photo[]; day?: string; max: number; selected: string[]; onDone: (ids: string[]) => void; onClose: () => void; onPhone?: () => void
}) {
  const { photoUrl } = useStore()
  const [sel, setSel] = useState<string[]>(selected)
  const [all, setAll] = useState(!day)
  const list = photos.filter((p) => p.kind !== 'video' && (all || photoDay(p) === day))
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : max === 1 ? [id] : s.length < max ? [...s, id] : s))
  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-bg">
      <header className="flex items-center gap-2 border-b border-line bg-surface px-3 pt-safe">
        <button className="btn-icon my-2 bg-surface2 shadow-none" onClick={onClose} aria-label="סגור"><X size={22} /></button>
        <h2 className="flex-1 text-lg">בחר {max === 1 ? 'תמונה' : `עד ${max} תמונות`} <span className="tnum text-muted">({sel.length})</span></h2>
        <button className="btn-primary my-2 px-4" onClick={() => { onDone(sel); onClose() }}><Check size={18} /> סיום</button>
      </header>
      {onPhone && (
        <div className="px-3 pt-2">
          <button className="btn-ghost w-full" onClick={() => { onClose(); onPhone() }}><ImagePlus size={18} /> תמונה מהטלפון</button>
        </div>
      )}
      {day && (
        <div className="flex gap-2 px-3 py-2">
          <button onClick={() => setAll(false)} className={`min-h-[36px] rounded-full px-3 text-[14px] font-semibold ${!all ? 'bg-ink text-bg' : 'bg-surface2'}`}>מהיום הזה</button>
          <button onClick={() => setAll(true)} className={`min-h-[36px] rounded-full px-3 text-[14px] font-semibold ${all ? 'bg-ink text-bg' : 'bg-surface2'}`}>כל האלבום</button>
        </div>
      )}
      <div className="grid flex-1 grid-cols-3 content-start gap-1 overflow-y-auto p-1 pb-safe">
        {list.length === 0 && <p className="col-span-3 p-6 text-center text-muted">אין תמונות מהיום הזה.</p>}
        {list.map((p) => {
          const u = photoUrl(p.thumb_path)
          const k = sel.indexOf(p.id)
          return (
            <button key={p.id} className="relative aspect-square overflow-hidden bg-surface2" onClick={() => toggle(p.id)}>
              {u && <img src={u} alt="" className="h-full w-full object-cover" loading="lazy" />}
              {k >= 0 && <span className="absolute inset-0 grid place-items-start justify-end bg-green/25 p-1.5 ring-4 ring-inset ring-green"><span className="tnum grid h-7 w-7 place-items-center rounded-full bg-green text-[14px] font-bold text-white">{max === 1 ? '✓' : k + 1}</span></span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
