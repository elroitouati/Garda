import { Pause, Play, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useStore } from '../lib/store'
import type { Photo } from '../lib/types'
import { Avatar } from './Avatar'

const STEP = 4500

/** מצגת במסך מלא: מעבר עדין בין תמונות, זום איטי, אפשר לעצור בנגיעה */
export function Slideshow({ photos, onClose }: { photos: Photo[]; onClose: () => void }) {
  const { data, photoUrl, signPhotos } = useStore()
  // מהישנה לחדשה, כמו סיפור של היום
  const list = [...photos].sort((a, b) => a.taken_at.localeCompare(b.taken_at))
  const [i, setI] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [ready, setReady] = useState<Set<string>>(new Set())
  const lock = useRef<{ release: () => Promise<void> } | null>(null)

  useEffect(() => { signPhotos(list.map((p) => p.path)) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // טוען מראש את הנוכחית והבאה, כדי שהמעבר יהיה חלק
  useEffect(() => {
    for (const p of [list[i], list[(i + 1) % list.length]]) {
      const u = p && photoUrl(p.path)
      if (u && !ready.has(p.id)) { const im = new Image(); im.onload = () => setReady((r) => new Set(r).add(p.id)); im.src = u }
    }
  }, [i, list.map((p) => photoUrl(p.path)).join()]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!playing) return
    const t = setTimeout(() => setI((x) => (x + 1) % list.length), STEP)
    return () => clearTimeout(t)
  }, [i, playing, list.length])

  // המסך לא נכבה באמצע
  useEffect(() => {
    (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock
      ?.request('screen').then((l) => { lock.current = l }).catch(() => {})
    return () => { void lock.current?.release().catch(() => {}) }
  }, [])

  const p = list[i]
  if (!p) return null
  const by = data?.members.find((m) => m.id === p.member_id)
  return (
    <div className="fixed inset-0 z-[80] overflow-hidden bg-black" role="dialog" aria-modal="true" aria-label="מצגת" onClick={() => setPlaying((x) => !x)}>
      {list.map((ph, k) => {
        const show = k === i
        const u = photoUrl(ph.path) ?? photoUrl(ph.thumb_path)
        if (!u || (Math.abs(k - i) > 1 && !(i === list.length - 1 && k === 0))) return null
        return (
          <img key={ph.id} src={u} alt="" draggable={false}
            className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-1000 ${show ? 'opacity-100' : 'opacity-0'} ${show && playing ? 'kenburns' : ''}`} />
        )
      })}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex gap-1 px-3 pt-[calc(var(--safe-top)+8px)]">
        {list.length <= 40 && list.map((ph, k) => (
          <span key={ph.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/25">
            <span className={`block h-full bg-white ${k < i ? 'w-full' : k === i && playing ? 'slide-progress' : k === i ? 'w-1/2' : 'w-0'}`} key={`${i}-${playing}`} />
          </span>
        ))}
      </div>
      <div className="absolute inset-x-0 top-0 flex items-center gap-3 px-3 pt-[calc(var(--safe-top)+20px)]">
        {by && <Avatar member={by} size={34} />}
        <div className="flex-1 text-white">
          <div className="font-semibold">{by?.name}</div>
          <div className="tnum text-[13px] opacity-75">
            {new Date(p.taken_at).toLocaleString('he-IL', { timeZone: 'Europe/Rome', weekday: 'short', hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
        <button className="grid h-11 w-11 place-items-center rounded-full bg-white/15 text-white" onClick={(e) => { e.stopPropagation(); onClose() }} aria-label="סגור מצגת"><X size={22} /></button>
      </div>
      {!playing && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="grid h-20 w-20 place-items-center rounded-full bg-black/45 text-white"><Pause size={34} /></span>
        </div>
      )}
      <div className="tnum absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 pb-[calc(var(--safe-bottom)+16px)] text-[14px] text-white/75">
        {playing ? <Play size={14} /> : <Pause size={14} />} {i + 1} / {list.length} · נגיעה לעצירה
      </div>
    </div>
  )
}
