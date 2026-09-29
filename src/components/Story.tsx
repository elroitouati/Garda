import { Heart, Pause, Play, Sparkles, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../lib/store'
import { romeDate, shortDate, weekdayLetter } from '../lib/time'
import type { Photo } from '../lib/types'
import { Avatar } from './Avatar'

const PHOTO_MS = 4500, CARD_MS = 3500
const MAX_ITEMS = 16

/** הסיפור של היום: הרגעים הכי אהובים לפי הסדר שבו צולמו */
export function pickStory(all: Photo[], day: string, reactions: Map<string, number>) {
  const list = all.filter((p) => romeDate(new Date(p.taken_at)) === day)
  const best = list.length > MAX_ITEMS
    ? [...list].sort((a, b) => (reactions.get(b.id) ?? 0) - (reactions.get(a.id) ?? 0)).slice(0, MAX_ITEMS)
    : list
  return best.sort((a, b) => a.taken_at.localeCompare(b.taken_at))
}

type Slide = { kind: 'intro' } | { kind: 'item'; p: Photo } | { kind: 'outro' }

/** סיפור כמו באינסטגרם: פסי התקדמות למעלה, נגיעה בצד מעבירה, נגיעה ארוכה עוצרת */
export function Story({ day, photos, onClose, onFeed }: { day: string; photos: Photo[]; onClose: () => void; onFeed?: () => void }) {
  const { data, live, photoUrl, signPhotos } = useStore()
  const reactions = useMemo(() => {
    const m = new Map<string, number>()
    for (const l of live.likes) m.set(l.photo_id, (m.get(l.photo_id) ?? 0) + 1)
    return m
  }, [live.likes])
  const slides: Slide[] = useMemo(() => [{ kind: 'intro' }, ...photos.map((p) => ({ kind: 'item' as const, p })), { kind: 'outro' }], [photos])
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  const [progress, setProgress] = useState(0)
  const video = useRef<HTMLVideoElement>(null)
  const hold = useRef<number | null>(null)
  const held = useRef(false)
  const s = slides[i]

  const dayObj = data?.days.find((d) => d.date === day)
  const nVideos = photos.filter((p) => p.kind === 'video').length
  const nLikes = photos.reduce((a, p) => a + (reactions.get(p.id) ?? 0), 0)
  const shooters = useMemo(() => {
    const c = new Map<string, number>()
    for (const p of photos) c.set(p.member_id, (c.get(p.member_id) ?? 0) + 1)
    return [...c.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => data?.members.find((m) => m.id === id)).filter((m): m is NonNullable<typeof m> => !!m)
  }, [photos, data])
  const best = useMemo(() => [...photos].sort((a, b) => (reactions.get(b.id) ?? 0) - (reactions.get(a.id) ?? 0))[0], [photos, reactions])

  useEffect(() => { signPhotos(photos.flatMap((p) => [p.thumb_path, p.path])) }, [photos]) // eslint-disable-line react-hooks/exhaustive-deps
  // טוענים מראש את התמונה הבאה
  useEffect(() => {
    const n = slides[i + 1]
    if (n?.kind === 'item' && n.p.kind === 'photo') { const u = photoUrl(n.p.path); if (u) new Image().src = u }
  }, [i]) // eslint-disable-line react-hooks/exhaustive-deps

  const go = (d: number) => {
    setProgress(0)
    setI((x) => {
      const n = x + d
      if (n >= slides.length) { onClose(); return x }
      return Math.max(0, n)
    })
  }

  // שעון לתמונות ולכרטיסים; סרטון מתקדם לפי הנגינה
  useEffect(() => {
    if (paused) return
    if (s.kind === 'item' && s.p.kind === 'video') return
    const total = s.kind === 'item' ? PHOTO_MS : CARD_MS
    const start = performance.now() - progress * total
    let raf = 0
    const tick = () => {
      const p = (performance.now() - start) / total
      if (p >= 1) { go(1); return }
      setProgress(p)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [i, paused]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const v = video.current
    if (!v) return
    if (paused) v.pause(); else v.play().catch(() => { v.muted = true; v.play().catch(() => {}) })
  }, [paused, i])

  // המסך לא נכבה
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null
    ;(navigator as unknown as { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock
      ?.request('screen').then((l) => { lock = l }).catch(() => {})
    return () => { void lock?.release().catch(() => {}) }
  }, [])

  const onDown = () => { held.current = false; hold.current = window.setTimeout(() => { held.current = true; setPaused(true) }, 250) }
  const onUp = (e: React.PointerEvent) => {
    if (hold.current) clearTimeout(hold.current)
    if (held.current) { setPaused(false); return }
    // בעברית "הבא" בצד שמאל
    const x = e.clientX / window.innerWidth
    go(x < 0.35 ? 1 : x > 0.65 ? -1 : 1)
  }

  const bestUrl = best ? photoUrl(best.thumb_path) : null
  return (
    <div className="fixed inset-0 z-[72] select-none bg-black text-white" role="dialog" aria-modal="true" aria-label="הסיפור של היום">
      <div className="absolute inset-0" onPointerDown={onDown} onPointerUp={onUp} onContextMenu={(e) => e.preventDefault()}>
        {s.kind === 'item' && (s.p.kind === 'video' ? (
          <video key={s.p.id} ref={video} src={photoUrl(s.p.path) ?? undefined} poster={photoUrl(s.p.thumb_path) ?? undefined} playsInline autoPlay
            className="h-full w-full object-contain"
            onTimeUpdate={(e) => { const v = e.currentTarget; if (v.duration) setProgress(v.currentTime / v.duration) }}
            onEnded={() => go(1)} />
        ) : (
          <img key={s.p.id} src={photoUrl(s.p.path) ?? photoUrl(s.p.thumb_path) ?? undefined} alt="" draggable={false}
            className="story-zoom h-full w-full object-contain" style={{ animationPlayState: paused ? 'paused' : 'running' }} />
        ))}

        {s.kind === 'intro' && (
          <div className="flex h-full flex-col items-center justify-center gap-5 bg-gradient-to-b from-[#1768B0] to-[#0E3F6B] px-8 text-center">
            <Sparkles size={34} className="text-lemon" />
            <div className="tnum text-lg opacity-80">{weekdayLetter(day)} {shortDate(day)}</div>
            <h2 className="font-display text-[34px] leading-tight">{dayObj?.title ?? 'הסיפור של היום'}</h2>
            <div className="tnum text-[17px] opacity-90">
              {[photos.length - nVideos && `${photos.length - nVideos} תמונות`, nVideos && `${nVideos} סרטונים`, nLikes && `${nLikes} לבבות`].filter(Boolean).join(' · ')}
            </div>
            {shooters.length > 0 && (
              <div className="flex -space-x-3 space-x-reverse">{shooters.slice(0, 6).map((m) => <Avatar key={m.id} member={m} size={44} />)}</div>
            )}
          </div>
        )}

        {s.kind === 'outro' && (
          <div className="flex h-full flex-col items-center justify-center gap-4 bg-gradient-to-b from-[#D34838] to-[#7A2218] px-8 text-center">
            <div className="text-lg opacity-85">הרגע הכי אהוב של היום</div>
            {bestUrl && <img src={bestUrl} alt="" className="aspect-square w-60 max-w-full rounded-3xl object-cover shadow-2xl" />}
            {best && (
              <div className="flex items-center gap-2 text-lg font-semibold">
                <Heart size={20} className="fill-white" /><span className="tnum">{reactions.get(best.id) ?? 0}</span>
                <span className="opacity-80">· צילם/ה {data?.members.find((m) => m.id === best.member_id)?.name}</span>
              </div>
            )}
            {onFeed && (
              <button className="mt-2 rounded-full bg-white px-6 py-3 font-bold text-black" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()} onClick={onFeed}>לכל התמונות והסרטונים</button>
            )}
          </div>
        )}
      </div>

      {/* פסי התקדמות */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex gap-1 px-2 pt-[calc(var(--safe-top)+8px)]" dir="ltr">
        {slides.map((_, k) => (
          <span key={k} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/30">
            <span className="block h-full bg-white" style={{ width: `${k < i ? 100 : k === i ? progress * 100 : 0}%` }} />
          </span>
        ))}
      </div>
      <div className="absolute inset-x-0 top-0 flex items-center gap-2 px-3 pt-[calc(var(--safe-top)+20px)]">
        {s.kind === 'item' && (() => {
          const m = data?.members.find((x) => x.id === s.p.member_id)
          return m ? <><Avatar member={m} size={32} /><span className="font-semibold drop-shadow">{m.name}</span></> : null
        })()}
        <span className="flex-1" />
        <button className="grid h-11 w-11 place-items-center rounded-full bg-black/30" onClick={() => setPaused((p) => !p)} aria-label={paused ? 'המשך' : 'עצור'}>
          {paused ? <Play size={20} /> : <Pause size={20} />}
        </button>
        <button className="grid h-11 w-11 place-items-center rounded-full bg-black/30" onClick={onClose} aria-label="סגור"><X size={22} /></button>
      </div>
    </div>
  )
}
