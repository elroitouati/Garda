import { Camera, Clapperboard, Download, Heart, Images, Play, Sparkles } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useToast } from './Toast'
import { useStore } from '../lib/store'
import { romeDate, shortDate, weekdayLetter } from '../lib/time'
import type { Photo } from '../lib/types'
import { formatDuration } from '../lib/video'
import { Avatar } from './Avatar'

export const photoDay = (p: Photo) => romeDate(new Date(p.taken_at))

function countLabel(list: Photo[]) {
  const v = list.filter((p) => p.kind === 'video').length, ph = list.length - v
  return [ph && (ph === 1 ? 'תמונה' : `${ph} תמונות`), v && (v === 1 ? 'סרטון' : `${v} סרטונים`)].filter(Boolean).join(' · ')
}

/** הרגע של היום: התמונה עם הכי הרבה לבבות (לפחות 2) */
export function topPhoto(list: Photo[], likes: Map<string, number>) {
  let best: Photo | null = null, n = 1
  for (const p of list) { const c = likes.get(p.id) ?? 0; if (c > n) { best = p; n = c } }
  return best ? { photo: best, likes: n } : null
}

export function useLikeCounts() {
  const { live } = useStore()
  return useMemo(() => {
    const m = new Map<string, number>()
    for (const l of live.likes) m.set(l.photo_id, (m.get(l.photo_id) ?? 0) + 1)
    return m
  }, [live.likes])
}

export function AlbumTab({ onOpen, onSlideshow, onAdd, onFeed, onWrapped, wrappedPreview }: {
  onOpen: (ids: string[], start: number) => void
  onSlideshow: (ids: string[]) => void
  onAdd: () => void
  onFeed: () => void
  onWrapped?: () => void
  wrappedPreview?: boolean
}) {
  const { live, data, photoUrl, api, me, refreshLive } = useStore()
  const toast = useToast()
  const [who, setWho] = useState<string | null>(null)
  const likes = useLikeCounts()
  // לחיצה אחת פותחת, לחיצה כפולה נותנת לב (כמו באינסטגרם)
  const tap = useRef<{ id: string; timer: number } | null>(null)
  const [pop, setPop] = useState<{ id: string; n: number } | null>(null)
  const onTap = (id: string, open: () => void) => {
    if (tap.current?.id === id) {
      clearTimeout(tap.current.timer); tap.current = null
      setPop((x) => ({ id, n: (x?.n ?? 0) + 1 }))
      if (api && me && !live.likes.some((l) => l.photo_id === id && l.member_id === me.id))
        api.setLike(id, me.id, true).then(refreshLive, () => toast('לא הצלחתי. בדוק קליטה.'))
      return
    }
    if (tap.current) clearTimeout(tap.current.timer)
    tap.current = { id, timer: window.setTimeout(() => { tap.current = null; open() }, 260) }
  }
  const comments = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of live.comments) m.set(c.photo_id, (m.get(c.photo_id) ?? 0) + 1)
    return m
  }, [live.comments])

  const all = live.photos
  const uploaders = useMemo(() => {
    const count = new Map<string, number>()
    for (const p of all) count.set(p.member_id, (count.get(p.member_id) ?? 0) + 1)
    return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([id, n]) => ({ m: data?.members.find((x) => x.id === id), n })).filter((x) => x.m)
  }, [all, data])
  const shown = who ? all.filter((p) => p.member_id === who) : all
  const days = useMemo(() => {
    const g = new Map<string, Photo[]>()
    for (const p of shown) { const d = photoDay(p); g.set(d, [...(g.get(d) ?? []), p]) }
    return [...g.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [shown])

  if (!all.length) {
    return (
      <div className="mx-4 mt-2 flex flex-col items-center gap-3 rounded-3xl bg-surface2 p-6 text-center">
        <Images size={28} className="text-muted" />
        <p className="text-muted">עוד אין תמונות. כל תמונה או סרטון שתעלו יופיעו כאן ועל המפה, במקום שבו צולמו.</p>
        <button className="btn-primary" onClick={onAdd}><Camera size={18} /> תמונה ראשונה</button>
      </div>
    )
  }

  const ids = (list: Photo[]) => list.map((p) => p.id)
  return (
    <div className="pt-1">
      <div className="grid grid-cols-2 gap-2 px-4 pb-3">
        <button className="btn-primary text-lg" onClick={onAdd}><Camera size={20} /> הוסף</button>
        <button className="btn-ghost text-lg" onClick={onFeed}><Clapperboard size={20} /> גלילה</button>
      </div>
      <p className="-mt-1 px-4 pb-2 text-center text-[13px] text-muted">טיפ: במסך מלא, החלקה ימינה פותחת את הגלילה</p>
      {onWrapped && (
        <div className="px-4 pb-3">
          <button className="flex w-full items-center gap-3 rounded-2xl bg-gradient-to-l from-[#1768B0] via-[#B8467A] to-[#D34838] p-3.5 text-start text-white shadow-card" onClick={onWrapped}>
            <Sparkles size={22} className="text-lemon" />
            <span className="flex-1"><span className="block font-bold">Wrapped של הטיול</span><span className="block text-[13px] opacity-90">{wrappedPreview ? 'תצוגה מקדימה למנהלים · נפתח לכולם במוצאי שבת' : 'כל הטיול במספרים'}</span></span>
          </button>
        </div>
      )}

      {/* סינון לפי מי צילם */}
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-2" style={{ touchAction: 'pan-x' }} role="radiogroup" aria-label="של מי">
        <button role="radio" aria-checked={!who} onClick={() => setWho(null)}
          className={`flex min-h-[40px] shrink-0 items-center rounded-full px-4 text-[15px] font-semibold ${!who ? 'bg-ink text-bg' : 'bg-surface2'}`}>
          כולם <bdi className="tnum ms-1.5 opacity-70">{all.length}</bdi>
        </button>
        {uploaders.map(({ m, n }) => (
          <button key={m!.id} role="radio" aria-checked={who === m!.id} onClick={() => setWho(who === m!.id ? null : m!.id)}
            className={`flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-full py-1 pe-3 ps-1 text-[15px] font-semibold ${who === m!.id ? 'bg-ink text-bg' : 'bg-surface2'}`}>
            <Avatar member={m!} size={30} />{m!.name}<bdi className="tnum opacity-70">{n}</bdi>
          </button>
        ))}
      </div>

      {days.map(([day, list]) => {
        const dayTitle = data?.days.find((d) => d.date === day)?.title
        const top = topPhoto(list, likes)
        const topUrl = top ? photoUrl(top.photo.thumb_path) : null
        return (
          <section key={day} className="mt-3">
            <div className="flex items-center gap-2 px-4">
              <h3 className="min-w-0 flex-1 truncate text-[18px] leading-tight">
                <bdi className="tnum">{weekdayLetter(day)} {shortDate(day)}</bdi>{dayTitle ? <> · <bdi>{dayTitle}</bdi></> : null}
                <span className="tnum ms-2 font-sans text-[14px] font-normal text-muted">{countLabel(list)}</span>
              </h3>
              <button className="grid h-10 w-10 place-items-center rounded-full bg-surface2 text-green" onClick={() => onSlideshow(ids(list))} aria-label="מצגת של היום"><Play size={18} /></button>
              <button className="grid h-10 w-10 place-items-center rounded-full bg-surface2" onClick={() => onOpen(ids(list), 0)} aria-label="שמור את כל היום"><Download size={18} /></button>
            </div>

            {top && (
              <button className="relative mx-4 mt-2 block h-44 w-[calc(100%-2rem)] overflow-hidden rounded-2xl bg-surface2 text-start" onClick={() => onOpen(ids(list), list.indexOf(top.photo))}>
                {topUrl && <img src={topUrl} alt="" className="h-full w-full object-cover" />}
                <span className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/70 to-transparent p-3 pt-8 text-white">
                  <Sparkles size={16} className="text-lemon" /><span className="flex-1 font-semibold">הרגע של היום</span>
                  <Heart size={15} className="fill-[#FF6B6B] text-[#FF6B6B]" /><bdi className="tnum">{top.likes}</bdi>
                </span>
              </button>
            )}

            <div className="mt-2 grid grid-cols-3 gap-1 px-4">
              {list.map((ph, k) => {
                const u = photoUrl(ph.thumb_path)
                const l = likes.get(ph.id) ?? 0, c = comments.get(ph.id) ?? 0
                const by = data?.members.find((m) => m.id === ph.member_id)
                return (
                  <button key={ph.id} className="relative aspect-square overflow-hidden rounded-lg bg-surface2" style={{ touchAction: 'manipulation' }}
                    onClick={() => onTap(ph.id, () => onOpen(ids(list), k))} aria-label={`תמונה של ${by?.name ?? ''}`}>
                    {u && <img src={u} alt="" className="h-full w-full object-cover" loading="lazy" />}
                    {ph.kind === 'video' && (
                      <span className="tnum absolute top-1 end-1 flex items-center gap-0.5 rounded-full bg-black/50 px-1.5 py-0.5 text-[11px] font-bold text-white">
                        <Play size={10} className="fill-white" />{formatDuration(ph.duration)}
                      </span>
                    )}
                    {pop?.id === ph.id && <Heart key={pop.n} size={54} className="heart-pop pointer-events-none absolute inset-0 m-auto fill-white text-white drop-shadow-lg" />}
                    {(l > 0 || c > 0) && (
                      <span className="tnum absolute bottom-1 start-1 flex items-center gap-1 rounded-full bg-black/45 px-1.5 py-0.5 text-[11px] font-bold text-white">
                        {l > 0 && <><Heart size={10} className="fill-white" />{l}</>}{c > 0 && <span className="ms-0.5">· {c}</span>}
                      </span>
                    )}
                    {!who && by && <span className="absolute bottom-1 end-1"><Avatar member={by} size={18} /></span>}
                  </button>
                )
              })}
            </div>
          </section>
        )
      })}

    </div>
  )
}
