import { Check, Download, Heart, LocateFixed, MapPin, MessageCircle, Send, Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { cachedFile, fetchPhotoFile, saveFiles } from '../lib/photos'
import { useStore } from '../lib/store'
import type { Photo } from '../lib/types'
import { Avatar } from './Avatar'
import { useToast } from './Toast'

const CHUNK = 20
const when = (iso: string) => new Date(iso).toLocaleString('he-IL', { timeZone: 'Europe/Rome', weekday: 'short', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })

export function Gallery({ photos, start, onClose, onPlace }: {
  photos: Photo[]; start: number; onClose: () => void; onPlace: (p: Photo) => void
}) {
  const { data, me, api, photoUrl, signPhotos, refreshLive, live } = useStore()
  const toast = useToast()
  const [i, setI] = useState(Math.min(start, photos.length - 1))
  const [dx, setDx] = useState(0)
  const [ready, setReady] = useState(0) // לשמירת הכל: כמה קבצים כבר הורדו
  const [prep, setPrep] = useState<'idle' | 'loading' | 'ready'>('idle')
  const [chunk, setChunk] = useState(0)
  const [, bump] = useState(0)
  const drag = useRef<{ x: number; id: number } | null>(null)
  const lastTap = useRef(0)
  const [burst, setBurst] = useState(0)
  const [showComments, setShowComments] = useState(false)
  const [draft, setDraft] = useState('')
  const stripRef = useRef<HTMLDivElement>(null)
  const p = photos[i]

  useEffect(() => { if (!photos.length) onClose() }, [photos.length]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { signPhotos(photos.flatMap((x) => [x.thumb_path])) }, [photos]) // eslint-disable-line react-hooks/exhaustive-deps

  // טוענים מראש את התמונה הנוכחית והשכנות, כדי ש"שמור" יפתח שיתוף מיד
  useEffect(() => {
    if (!p) return
    const near = [photos[i - 1], p, photos[i + 1]].filter(Boolean) as Photo[]
    signPhotos(near.map((x) => x.path))
    for (const x of near) {
      const u = photoUrl(x.path)
      if (u && !cachedFile(x)) void fetchPhotoFile(x, u).then(() => bump((n) => n + 1)).catch(() => {})
    }
    stripRef.current?.querySelector(`[data-i="${i}"]`)?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [i, p && photoUrl(p.path)]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!p) return null
  const author = data?.members.find((m) => m.id === p.member_id)
  const mine = p.member_id === me?.id || me?.is_admin
  const full = photoUrl(p.path)
  const thumb = photoUrl(p.thumb_path)
  const go = (d: number) => setI((x) => Math.max(0, Math.min(photos.length - 1, x + d)))

  // לבבות ותגובות
  const likers = live.likes.filter((l) => l.photo_id === p.id).map((l) => data?.members.find((m) => m.id === l.member_id)).filter((m): m is NonNullable<typeof m> => !!m)
  const liked = !!me && likers.some((m) => m.id === me.id)
  const comments = live.comments.filter((c) => c.photo_id === p.id)
  const toggleLike = async (on = !liked) => {
    if (!api || !me || on === liked) return
    try { await api.setLike(p.id, me.id, on); await refreshLive() } catch { toast('לא הצלחתי. בדוק קליטה.') }
  }
  const sendComment = async () => {
    const t = draft.trim()
    if (!t || !api || !me) return
    setDraft('')
    try { await api.addComment(p.id, me.id, t); await refreshLive() } catch { setDraft(t); toast('התגובה לא נשלחה. בדוק קליטה.') }
  }

  const saveOne = async () => {
    try {
      const f = cachedFile(p) ?? (full ? await fetchPhotoFile(p, full) : null)
      if (!f) { toast('התמונה עוד נטענת. נסה שוב בעוד רגע.'); return }
      const r = await saveFiles([f])
      if (r === 'shared') toast('נשמר')
      else if (r === 'downloaded') toast('התמונה הורדה')
    } catch { toast('השמירה נכשלה. נסה שוב.') }
  }

  const chunks = Math.ceil(photos.length / CHUNK)
  const part = photos.slice(chunk * CHUNK, chunk * CHUNK + CHUNK)
  const prepareAll = async () => {
    setPrep('loading'); setReady(0)
    signPhotos(part.map((x) => x.path))
    let n = 0
    for (const x of part) {
      for (let tries = 0; tries < 20 && !photoUrl(x.path); tries++) await new Promise((r) => setTimeout(r, 150))
      const u = photoUrl(x.path) ?? (api ? (await api.sign('photos', [x.path]))[x.path] : null)
      if (u) await fetchPhotoFile(x, u).catch(() => {})
      setReady(++n)
    }
    setPrep('ready')
  }
  const saveAll = async () => {
    const list = part.map(cachedFile).filter((f): f is File => !!f)
    try {
      const r = await saveFiles(list)
      if (r !== 'cancelled') {
        toast(r === 'shared' ? `נשמרו ${list.length} תמונות` : `${list.length} תמונות הורדו`)
        if (chunk + 1 < chunks) { setChunk(chunk + 1); setPrep('idle') } else setPrep('idle')
      }
    } catch { toast('השמירה נכשלה. נסה שוב.') }
  }

  const range = chunks > 1 ? ` (${chunk * CHUNK + 1}–${chunk * CHUNK + part.length})` : ''

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black text-white" role="dialog" aria-modal="true" aria-label="גלריה">
      <header className="flex items-center gap-3 px-3 pt-[calc(var(--safe-top)+8px)] pb-2">
        <button className="grid h-11 w-11 place-items-center rounded-full bg-white/10" onClick={onClose} aria-label="סגור"><X size={22} /></button>
        {author && <Avatar member={author} size={36} />}
        <div className="min-w-0 flex-1 leading-tight">
          <div className="font-semibold">{author?.id === me?.id ? 'אני' : author?.name}</div>
          <div className="tnum text-[13px] text-white/70">
            {when(p.taken_at)}{p.loc_source === 'schedule' ? ' · מיקום לפי הלו"ז' : ''}
          </div>
        </div>
        <span className="tnum text-[14px] text-white/70">{i + 1}/{photos.length}</span>
      </header>

      <div
        className="relative flex-1 overflow-hidden"
        style={{ touchAction: 'pan-y' }}
        onPointerDown={(e) => { drag.current = { x: e.clientX, id: e.pointerId } }}
        onPointerMove={(e) => { if (drag.current?.id === e.pointerId) setDx(e.clientX - drag.current.x) }}
        onPointerUp={() => {
          if (Math.abs(dx) > 60) go(dx > 0 ? 1 : -1)
          else if (Math.abs(dx) < 8) {
            // הקשה כפולה = לב
            const now = Date.now()
            if (now - lastTap.current < 320) { setBurst((b) => b + 1); void toggleLike(true); lastTap.current = 0 } else lastTap.current = now
          }
          setDx(0); drag.current = null
        }}
        onPointerCancel={() => { setDx(0); drag.current = null }}
      >
        <img
          key={p.id}
          src={full ?? thumb ?? undefined}
          alt={`תמונה של ${author?.name ?? ''}`}
          className="absolute inset-0 m-auto h-full w-full select-none object-contain"
          style={{ transform: `translateX(${dx}px)`, transition: dx ? 'none' : 'transform .25s' }}
          draggable={false}
        />
        {!full && !thumb && <div className="absolute inset-0 grid place-items-center text-white/60">טוען…</div>}
        {burst > 0 && <Heart key={burst} size={110} className="heart-pop pointer-events-none absolute inset-0 m-auto fill-white text-white drop-shadow-lg" />}
      </div>

      {/* לבבות ותגובות */}
      <div className="flex items-center gap-2 px-3 pt-2">
        <button className="flex min-h-[44px] items-center gap-2 rounded-full bg-white/10 px-4 font-semibold" onClick={() => toggleLike()} aria-pressed={liked} aria-label={liked ? 'הסר לב' : 'לב'}>
          <Heart size={20} className={liked ? 'fill-[#FF5A5F] text-[#FF5A5F]' : ''} /><bdi className="tnum">{likers.length || ''}</bdi>
        </button>
        {likers.length > 0 && (
          <span className="flex -space-x-2 space-x-reverse" aria-label={`אהבו: ${likers.map((m) => m.name).join(', ')}`}>
            {likers.slice(0, 5).map((m) => <Avatar key={m.id} member={m} size={26} />)}
          </span>
        )}
        <span className="flex-1" />
        <button className="flex min-h-[44px] items-center gap-2 rounded-full bg-white/10 px-4 font-semibold" onClick={() => setShowComments(true)}>
          <MessageCircle size={19} />{comments.length ? <bdi className="tnum">{comments.length}</bdi> : 'תגובה'}
        </button>
      </div>
      {comments.length > 0 && !showComments && (
        <button className="mx-3 mt-1 truncate text-start text-[15px] text-white/85" onClick={() => setShowComments(true)}>
          <b>{data?.members.find((m) => m.id === comments[comments.length - 1].member_id)?.name}</b> <bdi>{comments[comments.length - 1].body}</bdi>
        </button>
      )}

      <div ref={stripRef} className="no-scrollbar flex gap-1.5 overflow-x-auto px-3 py-2" style={{ touchAction: 'pan-x' }}>
        {photos.map((x, k) => {
          const u = photoUrl(x.thumb_path)
          return (
            <button key={x.id} data-i={k} onClick={() => setI(k)} aria-label={`תמונה ${k + 1}`}
              className={`h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-white/10 ${k === i ? 'ring-2 ring-white' : 'opacity-60'}`}>
              {u && <img src={u} alt="" className="h-full w-full object-cover" />}
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-2 gap-2 px-3 pb-[calc(var(--safe-bottom)+12px)] pt-1">
        <button className="btn bg-white text-black" onClick={saveOne}><Download size={18} /> שמור לגלריה</button>
        {prep === 'ready' ? (
          <button className="btn bg-[#7BD389] text-black" onClick={saveAll}><Check size={18} /> שמור את כל {part.length}{range}</button>
        ) : (
          <button className="btn bg-white/15 text-white" disabled={prep === 'loading'} onClick={prepareAll}>
            {prep === 'loading' ? <span className="tnum">מכין {ready}/{part.length}…</span> : <>שמור את כל {photos.length > CHUNK ? part.length : photos.length}{range}</>}
          </button>
        )}
        {mine && (
          <>
            <button className="btn bg-white/10 text-white" onClick={() => onPlace(p)}>
              {p.loc_source === 'schedule' ? <><LocateFixed size={18} /> מקם על המפה</> : <><MapPin size={18} /> שנה מיקום</>}
            </button>
            <button className="btn bg-white/10 text-[#FF9C8A]" onClick={async () => {
              if (!confirm('למחוק את התמונה לכולם?')) return
              try { await api?.deletePhoto(p); await refreshLive(); toast('נמחקה'); if (i >= photos.length - 1) go(-1) } catch { toast('המחיקה נכשלה') }
            }}><Trash2 size={18} /> מחק</button>
          </>
        )}
      </div>
      {showComments && (
        <div className="absolute inset-0 z-10 flex flex-col justify-end bg-black/50" onClick={() => setShowComments(false)}>
          <div className="max-h-[70dvh] rounded-t-[28px] bg-[#1A2236] p-4 pb-[calc(var(--safe-bottom)+12px)] animate-rise" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg text-white">תגובות</h3>
              <button className="grid h-11 w-11 place-items-center text-white/70" onClick={() => setShowComments(false)} aria-label="סגור"><X size={20} /></button>
            </div>
            <ul className="max-h-[42dvh] space-y-3 overflow-y-auto">
              {comments.length === 0 && <li className="text-white/60">עוד אין תגובות. תהיו הראשונים.</li>}
              {comments.map((c) => {
                const m = data?.members.find((x) => x.id === c.member_id)
                const mine = c.member_id === me?.id
                return (
                  <li key={c.id} className="flex items-start gap-2.5">
                    {m && <Avatar member={m} size={32} />}
                    <div className="min-w-0 flex-1 rounded-2xl bg-white/10 px-3 py-2 text-white">
                      <div className="text-[13px] font-bold opacity-80">{m?.name}</div>
                      <div className="text-[16px] leading-snug"><bdi>{c.body}</bdi></div>
                    </div>
                    {(mine || me?.is_admin) && (
                      <button className="grid h-9 w-9 place-items-center text-white/50" aria-label="מחק תגובה" onClick={async () => { try { await api?.deleteComment(c.id); await refreshLive() } catch { /* ignore */ } }}><Trash2 size={15} /></button>
                    )}
                  </li>
                )
              })}
            </ul>
            <div className="mt-3 flex gap-2">
              <input className="input flex-1 border-white/15 bg-white/10 text-white placeholder:text-white/40" maxLength={300} placeholder="כתוב תגובה…" value={draft}
                onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void sendComment() }} />
              <button className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#1768B0] text-white disabled:opacity-40" disabled={!draft.trim()} onClick={sendComment} aria-label="שלח"><Send size={18} /></button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
