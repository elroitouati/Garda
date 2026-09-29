import { ChevronLeft, Heart, MessageCircle, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../lib/store'
import { romeDate, shortDate, weekdayLetter } from '../lib/time'
import type { Member, Photo } from '../lib/types'
import { Avatar } from './Avatar'

/** אחרי צאת השבת האחרונה (3.10 בערב) ה-Wrapped נפתח לכולם; מנהלים רואים תצוגה מקדימה */
export const WRAPPED_FROM = new Date('2026-10-03T19:40:00+02:00')

type Card = { bg: string; body: React.ReactNode }

export function Wrapped({ onClose, preview }: { onClose: () => void; preview?: boolean }) {
  const { live, data, photoUrl, signPhotos } = useStore()
  const [i, setI] = useState(0)
  const member = (id: string) => data?.members.find((m) => m.id === id)

  const stats = useMemo(() => {
    const photos = live.photos
    const videos = photos.filter((p) => p.kind === 'video')
    const react = new Map<string, number>()
    for (const l of live.likes) react.set(l.photo_id, (react.get(l.photo_id) ?? 0) + 1)
    const comm = new Map<string, number>()
    for (const c of live.comments) comm.set(c.photo_id, (comm.get(c.photo_id) ?? 0) + 1)
    const by = new Map<string, number>()
    for (const p of photos) by.set(p.member_id, (by.get(p.member_id) ?? 0) + 1)
    const shooters = [...by.entries()].sort((a, b) => b[1] - a[1]).map(([id, n]) => ({ m: member(id), n })).filter((x): x is { m: Member; n: number } => !!x.m)
    const commenters = new Map<string, number>()
    for (const c of live.comments) commenters.set(c.member_id, (commenters.get(c.member_id) ?? 0) + 1)
    const topCommenter = [...commenters.entries()].sort((a, b) => b[1] - a[1])[0]
    const emoji = new Map<string, number>()
    for (const l of live.likes) emoji.set(l.emoji ?? '❤️', (emoji.get(l.emoji ?? '❤️') ?? 0) + 1)
    const topEmoji = [...emoji.entries()].sort((a, b) => b[1] - a[1])[0]
    const loved = [...photos].sort((a, b) => (react.get(b.id) ?? 0) - (react.get(a.id) ?? 0))[0] as Photo | undefined
    const talked = [...photos].sort((a, b) => (comm.get(b.id) ?? 0) - (comm.get(a.id) ?? 0))[0] as Photo | undefined
    const days = (data?.days ?? []).map((d) => {
      const list = photos.filter((p) => romeDate(new Date(p.taken_at)) === d.date)
      const top = [...list].sort((a, b) => (react.get(b.id) ?? 0) - (react.get(a.id) ?? 0))[0]
      return { d, n: list.length, top }
    }).filter((x) => x.n > 0)
    return { photos, videos, react, comm, shooters, topCommenter, topEmoji, loved, talked, days, likes: live.likes.length, comments: live.comments.length }
  }, [live, data]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const ps = [stats.loved, stats.talked, ...stats.days.map((x) => x.top)].filter(Boolean) as Photo[]
    signPhotos(ps.flatMap((p) => [p.thumb_path, p.path]))
  }, [stats]) // eslint-disable-line react-hooks/exhaustive-deps

  const big = (n: number | string, label: string) => (
    <div className="text-center"><div className="tnum font-display text-[64px] leading-none">{n}</div><div className="mt-1 text-lg opacity-85">{label}</div></div>
  )
  const pic = (p: Photo | undefined, cls = 'w-64') => {
    const u = p && (photoUrl(p.path) ?? photoUrl(p.thumb_path))
    return u ? <img src={u} alt="" className={`aspect-[4/5] max-w-full rounded-3xl object-cover shadow-2xl ${cls}`} /> : null
  }

  const cards: Card[] = [
    { bg: 'from-[#1768B0] to-[#0B3A66]', body: (
      <>
        <img src={`${import.meta.env.BASE_URL}pwa-192.png`} alt="" className="h-24 w-24 rounded-[26px] ring-4 ring-white/30" />
        <h2 className="font-display text-[40px] leading-tight">טואטי בגארדה</h2>
        <p className="text-xl opacity-90">הטיול במספרים</p>
        <p className="tnum opacity-75">27.9 – 4.10.2026</p>
      </>
    ) },
    { bg: 'from-[#D34838] to-[#6E1E14]', body: (
      <>
        <p className="text-xl opacity-90">ביחד צילמנו</p>
        {big(stats.photos.length - stats.videos.length, 'תמונות')}
        {stats.videos.length > 0 && big(stats.videos.length, 'סרטונים')}
        <p className="tnum text-lg opacity-85">{stats.likes} לבבות · {stats.comments} תגובות</p>
      </>
    ) },
  ]
  if (stats.shooters.length) cards.push({ bg: 'from-[#2E8B57] to-[#134A2C]', body: (
    <>
      <p className="text-xl opacity-90">הצלם/ת של הטיול</p>
      <Avatar member={stats.shooters[0].m} size={120} />
      <h2 className="font-display text-[38px]">{stats.shooters[0].m.name}</h2>
      <p className="tnum text-lg opacity-85">{stats.shooters[0].n} תמונות וסרטונים</p>
      <div className="mt-2 space-y-2">
        {stats.shooters.slice(1, 4).map(({ m, n }, k) => (
          <div key={m.id} className="flex items-center gap-2 text-lg"><span className="tnum w-6 opacity-70">{k + 2}.</span><Avatar member={m} size={32} />{m.name}<span className="tnum opacity-70">· {n}</span></div>
        ))}
      </div>
    </>
  ) })
  if (stats.loved && (stats.react.get(stats.loved.id) ?? 0) > 0) cards.push({ bg: 'from-[#B8467A] to-[#5A1C3A]', body: (
    <>
      <p className="text-xl opacity-90">הרגע הכי אהוב</p>
      {pic(stats.loved)}
      <p className="flex items-center gap-2 text-lg"><Heart size={20} className="fill-white" /><span className="tnum">{stats.react.get(stats.loved.id)}</span> · {member(stats.loved.member_id)?.name}</p>
    </>
  ) })
  if (stats.talked && (stats.comm.get(stats.talked.id) ?? 0) > 1 && stats.talked.id !== stats.loved?.id) cards.push({ bg: 'from-[#476E7A] to-[#1D3238]', body: (
    <>
      <p className="text-xl opacity-90">הכי דיברו על זה</p>
      {pic(stats.talked, 'w-56')}
      <p className="flex items-center gap-2 text-lg"><MessageCircle size={20} /><span className="tnum">{stats.comm.get(stats.talked.id)}</span> תגובות</p>
    </>
  ) })
  if (stats.topEmoji || stats.topCommenter) cards.push({ bg: 'from-[#B7791F] to-[#5C3A08]', body: (
    <>
      {stats.topEmoji && <><p className="text-xl opacity-90">האימוג'י של המשפחה</p><div className="text-[96px] leading-none">{stats.topEmoji[0]}</div><p className="tnum opacity-85">{stats.topEmoji[1]} פעמים</p></>}
      {stats.topCommenter && member(stats.topCommenter[0]) && (
        <div className="mt-6 flex flex-col items-center gap-2">
          <p className="text-lg opacity-90">הכי הרבה תגובות כתב/ה</p>
          <Avatar member={member(stats.topCommenter[0])!} size={64} />
          <p className="text-xl font-semibold">{member(stats.topCommenter[0])!.name} <span className="tnum opacity-75">· {stats.topCommenter[1]}</span></p>
        </div>
      )}
    </>
  ) })
  if (stats.days.length) cards.push({ bg: 'from-[#1F8A8A] to-[#0C3F3F]', body: (
    <>
      <p className="text-xl opacity-90">יום אחרי יום</p>
      <div className="grid w-full max-w-sm grid-cols-3 gap-2">
        {stats.days.map(({ d, n, top }) => {
          const u = top && photoUrl(top.thumb_path)
          return (
            <div key={d.date} className="overflow-hidden rounded-2xl bg-white/10 text-start">
              {u ? <img src={u} alt="" className="aspect-square w-full object-cover" /> : <div className="aspect-square" />}
              <div className="p-1.5 leading-tight"><div className="tnum text-[12px] opacity-75">{weekdayLetter(d.date)} {shortDate(d.date)} · {n}</div><div className="truncate text-[13px] font-semibold">{d.title}</div></div>
            </div>
          )
        })}
      </div>
    </>
  ) })
  cards.push({ bg: 'from-[#1768B0] to-[#D34838]', body: (
    <>
      <h2 className="font-display text-[38px] leading-tight">תודה על טיול מדהים</h2>
      <p className="text-xl opacity-90">משפחת טואטי ❤️ אגם גארדה</p>
      <button className="mt-4 rounded-full bg-white px-6 py-3 font-bold text-black" onClick={onClose}>סגור</button>
    </>
  ) })

  const c = cards[Math.min(i, cards.length - 1)]
  return (
    <div className={`fixed inset-0 z-[73] flex flex-col bg-gradient-to-b ${c.bg} text-white transition-colors`} role="dialog" aria-modal="true" aria-label="Wrapped של הטיול">
      <div className="flex gap-1 px-2 pt-[calc(var(--safe-top)+8px)]" dir="ltr">
        {cards.map((_, k) => <span key={k} className={`h-[3px] flex-1 rounded-full ${k <= i ? 'bg-white' : 'bg-white/30'}`} />)}
      </div>
      <div className="flex items-center px-3 pt-2">
        {preview && <span className="rounded-full bg-black/25 px-3 py-1 text-[13px] font-semibold">תצוגה מקדימה · מתעדכן עד סוף הטיול</span>}
        <span className="flex-1" />
        <button className="grid h-11 w-11 place-items-center rounded-full bg-black/25" onClick={onClose} aria-label="סגור"><X size={22} /></button>
      </div>
      <div key={i} className="flex flex-1 flex-col items-center justify-center gap-4 overflow-y-auto px-6 pb-6 text-center animate-rise"
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('button')) return
          // נגיעה בצד ימין חוזרת, כל השאר מתקדם
          const back = e.clientX > window.innerWidth * 0.65
          setI((x) => Math.max(0, Math.min(cards.length - 1, x + (back ? -1 : 1))))
        }}>
        {c.body}
      </div>
      {i < cards.length - 1 && (
        <div className="flex justify-center pb-[calc(var(--safe-bottom)+16px)] text-[14px] opacity-75"><span className="flex items-center gap-1">נגיעה להמשך <ChevronLeft size={16} /></span></div>
      )}
    </div>
  )
}
