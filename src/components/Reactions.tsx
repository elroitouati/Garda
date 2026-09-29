import { Heart } from 'lucide-react'
import { useRef, useState } from 'react'
import { useStore } from '../lib/store'
import { REACTIONS, type Photo, type Reaction } from '../lib/types'
import { useToast } from './Toast'

/** הרגשות על תמונה: מי הגיב ומה, והתגובה שלי */
export function useReactions(photoId: string) {
  const { live, me } = useStore()
  const list = live.likes.filter((l) => l.photo_id === photoId)
  const mine = (list.find((l) => l.member_id === me?.id)?.emoji ?? (list.some((l) => l.member_id === me?.id) ? '❤️' : null)) as Reaction | null
  const counts = new Map<string, number>()
  for (const l of list) counts.set(l.emoji ?? '❤️', (counts.get(l.emoji ?? '❤️') ?? 0) + 1)
  const topEmojis = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([e]) => e)
  return { list, mine, total: list.length, topEmojis }
}

/** לחיצה = לב; לחיצה ארוכה = לבחור אימוג'י */
export function ReactionButton({ photo, layout }: { photo: Photo; layout: 'column' | 'row' }) {
  const { me, api, refreshLive } = useStore()
  const toast = useToast()
  const { mine, total, topEmojis } = useReactions(photo.id)
  const [picker, setPicker] = useState(false)
  const timer = useRef<number | null>(null)
  const long = useRef(false)

  const set = async (e: Reaction | null) => {
    setPicker(false)
    if (!api || !me) return
    try { await api.setReaction(photo.id, me.id, e); await refreshLive() } catch { toast('לא הצלחתי. בדוק קליטה.') }
  }
  const down = () => {
    long.current = false
    timer.current = window.setTimeout(() => { long.current = true; setPicker(true); navigator.vibrate?.(15) }, 450)
  }
  const up = () => { if (timer.current) clearTimeout(timer.current) }
  const click = () => { if (long.current) return; void set(mine ? null : '❤️') }

  const icon = mine && mine !== '❤️'
    ? <span className="text-[26px] leading-none">{mine}</span>
    : <Heart size={layout === 'column' ? 28 : 20} className={mine ? 'fill-[#FF5A5F] text-[#FF5A5F]' : ''} />
  const others = topEmojis.filter((e) => e !== '❤️').slice(0, 2)

  return (
    <div className="relative">
      <button
        className={layout === 'column' ? 'flex flex-col items-center gap-1' : 'flex min-h-[44px] items-center gap-2 rounded-full bg-white/10 px-4 font-semibold'}
        onPointerDown={down} onPointerUp={up} onPointerLeave={up} onPointerCancel={up} onClick={click}
        onContextMenu={(e) => e.preventDefault()}
        aria-pressed={!!mine} aria-label={mine ? 'הסר תגובה' : 'לב (לחיצה ארוכה לאימוג\'י)'}>
        {layout === 'column' ? <span className="grid h-12 w-12 place-items-center rounded-full bg-black/35 backdrop-blur-sm">{icon}</span> : icon}
        <span className="tnum flex items-center gap-0.5 text-[14px] font-bold drop-shadow">
          {others.length > 0 && <span className="text-[13px]">{others.join('')}</span>}{total || ''}
        </span>
      </button>
      {picker && (
        <>
          <button className="fixed inset-0 z-20 cursor-default" onClick={() => setPicker(false)} aria-label="סגור" />
          <div className={`absolute z-30 flex gap-1 rounded-full bg-white p-1.5 shadow-float animate-rise ${layout === 'column' ? 'bottom-0 end-14' : 'bottom-12 start-0'}`} role="menu">
            {REACTIONS.map((e) => (
              <button key={e} role="menuitem" onClick={() => set(mine === e ? null : e)}
                className={`grid h-11 w-11 place-items-center rounded-full text-[26px] transition active:scale-125 ${mine === e ? 'bg-black/10' : ''}`}>{e}</button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
