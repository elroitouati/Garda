import { Heart, MessageCircle, Volume2, VolumeX, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../lib/store'
import { romeDate } from '../lib/time'
import type { Photo } from '../lib/types'
import { formatDuration } from '../lib/video'
import { Avatar } from './Avatar'
import { useToast } from './Toast'

const when = (iso: string) => new Date(iso).toLocaleString('he-IL', { timeZone: 'Europe/Rome', weekday: 'short', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })

/** פיד במסך מלא: גוללים למטה בין תמונות וסרטונים, לב בלחיצה כפולה */
export function Feed({ startId, onClose, onComments }: {
  startId?: string | null; onClose: () => void; onComments: (p: Photo) => void
}) {
  const { live, data, me, api, photoUrl, signPhotos, refreshLive } = useStore()
  const toast = useToast()
  const items = live.photos
  const [active, setActive] = useState(() => Math.max(0, items.findIndex((p) => p.id === startId)))
  const [muted, setMuted] = useState(true)
  const [pop, setPop] = useState<{ id: string; n: number } | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const videos = useRef(new Map<string, HTMLVideoElement>())
  const tap = useRef<{ id: string; timer: number } | null>(null)

  const likes = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const l of live.likes) m.set(l.photo_id, [...(m.get(l.photo_id) ?? []), l.member_id])
    return m
  }, [live.likes])
  const comments = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of live.comments) m.set(c.photo_id, (m.get(c.photo_id) ?? 0) + 1)
    return m
  }, [live.comments])

  // קופצים לפריט שנבחר
  useEffect(() => {
    const el = boxRef.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)
    el?.scrollIntoView({ block: 'start' })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // מי על המסך עכשיו
  useEffect(() => {
    const box = boxRef.current
    if (!box) return
    const io = new IntersectionObserver((es) => {
      for (const e of es) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.i))
    }, { root: box, threshold: 0.6 })
    box.querySelectorAll('[data-i]').forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [items.length])

  // קבצים מלאים רק לקרובים, כדי לא לבזבז גלישה
  useEffect(() => {
    signPhotos(items.map((p) => p.thumb_path))
  }, [items]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    signPhotos(items.slice(Math.max(0, active - 1), active + 3).map((p) => p.path))
  }, [active, items]) // eslint-disable-line react-hooks/exhaustive-deps

  // רק הסרטון שעל המסך מתנגן
  useEffect(() => {
    videos.current.forEach((v, id) => {
      if (id === items[active]?.id) { v.muted = muted; v.play().catch(() => { v.muted = true; setMuted(true); v.play().catch(() => {}) }) }
      else v.pause()
    })
  }, [active, muted, items, photoUrl(items[active]?.path ?? '')]) // eslint-disable-line react-hooks/exhaustive-deps

  // המסך לא נכבה באמצע צפייה
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null
    ;(navigator as unknown as { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock
      ?.request('screen').then((l) => { lock = l }).catch(() => {})
    return () => { void lock?.release().catch(() => {}) }
  }, [])

  const like = async (p: Photo, on: boolean) => {
    if (!api || !me) return
    try { await api.setLike(p.id, me.id, on); await refreshLive() } catch { toast('לא הצלחתי. בדוק קליטה.') }
  }
  const onTap = (p: Photo) => {
    if (tap.current?.id === p.id) {
      clearTimeout(tap.current.timer); tap.current = null
      setPop((x) => ({ id: p.id, n: (x?.n ?? 0) + 1 }))
      if (!likes.get(p.id)?.includes(me?.id ?? '')) void like(p, true)
      return
    }
    if (tap.current) clearTimeout(tap.current.timer)
    tap.current = { id: p.id, timer: window.setTimeout(() => { tap.current = null; if (p.kind === 'video') setMuted((m) => !m) }, 260) }
  }

  if (!items.length) return null
  const cur = items[active]

  return (
    <div className="feed-in fixed inset-0 z-[69] bg-black text-white" role="dialog" aria-modal="true" aria-label="פיד תמונות וסרטונים">
      <div ref={boxRef} className="no-scrollbar h-full snap-y snap-mandatory overflow-y-scroll overscroll-contain">
        {items.map((p, i) => {
          const near = Math.abs(i - active) <= 1
          const full = near ? photoUrl(p.path) : null
          const thumb = photoUrl(p.thumb_path)
          const by = data?.members.find((m) => m.id === p.member_id)
          const likers = likes.get(p.id) ?? []
          const liked = !!me && likers.includes(me.id)
          const nComments = comments.get(p.id) ?? 0
          const dayTitle = data?.days.find((d) => d.date === romeDate(new Date(p.taken_at)))?.title
          return (
            <section key={p.id} data-i={i} className="relative h-[100dvh] w-full snap-start snap-always overflow-hidden" style={{ touchAction: 'pan-y manipulation' }}>
              <div className="absolute inset-0" onClick={() => onTap(p)}>
                {p.kind === 'video' ? (
                  <video
                    ref={(v) => { if (v) videos.current.set(p.id, v); else videos.current.delete(p.id) }}
                    src={full ?? undefined} poster={thumb ?? undefined}
                    playsInline loop muted={muted} preload={near ? 'auto' : 'none'}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <img src={full ?? thumb ?? undefined} alt={`תמונה של ${by?.name ?? ''}`} className="h-full w-full select-none object-contain" draggable={false} loading={near ? 'eager' : 'lazy'} />
                )}
                {pop?.id === p.id && <Heart key={pop.n} size={120} className="heart-pop pointer-events-none absolute inset-0 m-auto fill-white text-white drop-shadow-lg" />}
              </div>

              {/* פעולות בצד */}
              <div className="absolute bottom-[calc(var(--safe-bottom)+96px)] end-3 flex flex-col items-center gap-5">
                <button className="flex flex-col items-center gap-1" onClick={() => void like(p, !liked)} aria-pressed={liked} aria-label={liked ? 'הסר לב' : 'לב'}>
                  <span className="grid h-12 w-12 place-items-center rounded-full bg-black/35 backdrop-blur-sm">
                    <Heart size={28} className={liked ? 'fill-[#FF5A5F] text-[#FF5A5F]' : 'text-white'} />
                  </span>
                  <bdi className="tnum text-[14px] font-bold drop-shadow">{likers.length || ''}</bdi>
                </button>
                <button className="flex flex-col items-center gap-1" onClick={() => onComments(p)} aria-label="תגובות">
                  <span className="grid h-12 w-12 place-items-center rounded-full bg-black/35 backdrop-blur-sm"><MessageCircle size={26} /></span>
                  <bdi className="tnum text-[14px] font-bold drop-shadow">{nComments || ''}</bdi>
                </button>
              </div>

              {/* מי ומתי */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent px-4 pb-[calc(var(--safe-bottom)+20px)] pt-16">
                <div className="flex items-center gap-2.5 pe-16">
                  {by && <Avatar member={by} size={38} />}
                  <div className="min-w-0 leading-tight">
                    <div className="font-semibold">{by?.id === me?.id ? 'אני' : by?.name}</div>
                    <div className="tnum truncate text-[13px] text-white/75">
                      {when(p.taken_at)}{dayTitle ? <> · <bdi>{dayTitle}</bdi></> : null}{p.kind === 'video' && p.duration ? ` · ${formatDuration(p.duration)}` : ''}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )
        })}
      </div>

      <header className="pointer-events-none absolute inset-x-0 top-0 flex items-center gap-2 bg-gradient-to-b from-black/60 to-transparent px-3 pb-6 pt-[calc(var(--safe-top)+8px)]">
        <button className="pointer-events-auto grid h-11 w-11 place-items-center rounded-full bg-black/35 backdrop-blur-sm" onClick={onClose} aria-label="סגור"><X size={22} /></button>
        <span className="flex-1 text-lg font-semibold drop-shadow">הפיד המשפחתי</span>
        {cur?.kind === 'video' && (
          <button className="pointer-events-auto grid h-11 w-11 place-items-center rounded-full bg-black/35 backdrop-blur-sm" onClick={() => setMuted((m) => !m)} aria-label={muted ? 'הפעל קול' : 'השתק'}>
            {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
        )}
      </header>
      {active === 0 && items.length > 1 && (
        <div className="pointer-events-none absolute inset-x-0 top-[calc(var(--safe-top)+64px)] flex justify-center">
          <span className="animate-rise rounded-full bg-black/45 px-3 py-1 text-[13px] font-semibold backdrop-blur-sm">גוללים למעלה לעוד · לחיצה כפולה = לב</span>
        </div>
      )}
    </div>
  )
}
