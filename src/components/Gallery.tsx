import { Check, Download, LocateFixed, MapPin, Trash2, X } from 'lucide-react'
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
  const { data, me, api, photoUrl, signPhotos, refreshLive } = useStore()
  const toast = useToast()
  const [i, setI] = useState(Math.min(start, photos.length - 1))
  const [dx, setDx] = useState(0)
  const [ready, setReady] = useState(0) // לשמירת הכל: כמה קבצים כבר הורדו
  const [prep, setPrep] = useState<'idle' | 'loading' | 'ready'>('idle')
  const [chunk, setChunk] = useState(0)
  const [, bump] = useState(0)
  const drag = useRef<{ x: number; id: number } | null>(null)
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
        onPointerUp={() => { if (Math.abs(dx) > 60) go(dx > 0 ? 1 : -1); setDx(0); drag.current = null }}
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
      </div>

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
    </div>
  )
}
