import { ChevronDown, Heart, MessageCircle, Send, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ago } from '../lib/geo'
import { useStore } from '../lib/store'
import type { Photo, PhotoComment } from '../lib/types'
import { Avatar } from './Avatar'
import { useToast } from './Toast'

/** תגובות כמו בטיקטוק: חלונית מלמטה, לב לכל תגובה ותשובות מקוננות */
export function CommentsSheet({ photo, onClose }: { photo: Photo; onClose: () => void }) {
  const { live, data, me, api, refreshLive } = useStore()
  const toast = useToast()
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [replyTo, setReplyTo] = useState<PhotoComment | null>(null)
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [drag, setDrag] = useState(0)
  const d0 = useRef<number | null>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const all = live.comments.filter((c) => c.photo_id === photo.id)
  const top = all.filter((c) => !c.parent_id)
  const replies = useMemo(() => {
    const m = new Map<string, PhotoComment[]>()
    for (const c of all) if (c.parent_id) m.set(c.parent_id, [...(m.get(c.parent_id) ?? []), c])
    return m
  }, [all])
  const likes = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const l of live.commentLikes) m.set(l.comment_id, [...(m.get(l.comment_id) ?? []), l.member_id])
    return m
  }, [live.commentLikes])
  const member = (id: string) => data?.members.find((m) => m.id === id)

  const prevCount = useRef(all.length)
  useEffect(() => {
    // תגובה חדשה ברמה העליונה: גוללים למטה אליה
    if (all.length > prevCount.current && !replyTo) listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
    prevCount.current = all.length
  }, [all.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const send = async () => {
    const t = draft.trim()
    if (!t || !api || !me || sending) return
    setSending(true); setDraft('')
    const parent = replyTo ? (replyTo.parent_id ?? replyTo.id) : null
    try {
      await api.addComment(photo.id, me.id, t, parent)
      if (parent) setOpen((s) => new Set(s).add(parent))
      setReplyTo(null)
      await refreshLive()
    } catch { setDraft(t); toast('התגובה לא נשלחה. בדוק קליטה.') }
    setSending(false)
  }
  const toggleLike = async (c: PhotoComment) => {
    if (!api || !me) return
    const on = !(likes.get(c.id) ?? []).includes(me.id)
    try { await api.setCommentLike(c.id, me.id, on); await refreshLive() } catch { toast('לא הצלחתי. בדוק קליטה.') }
  }
  const remove = async (c: PhotoComment) => {
    try { await api?.deleteComment(c.id); await refreshLive() } catch { toast('לא הצלחתי למחוק') }
  }

  const row = (c: PhotoComment, small = false) => {
    const m = member(c.member_id)
    const l = likes.get(c.id) ?? []
    const liked = !!me && l.includes(me.id)
    return (
      <div key={c.id} className="flex items-start gap-3">
        {m && <Avatar member={m} size={small ? 30 : 40} />}
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold text-muted">{c.member_id === me?.id ? 'אני' : m?.name}</div>
          <div className={`${small ? 'text-[16px]' : 'text-[17px]'} leading-snug`}><bdi>{c.body}</bdi></div>
          <div className="tnum mt-1 flex items-center gap-4 text-[13px] text-muted">
            <span>{ago(c.created_at)}</span>
            <button className="font-semibold" onClick={() => { setReplyTo(c); inputRef.current?.focus() }}>להשיב</button>
            {(c.member_id === me?.id || me?.is_admin) && (
              <button className="flex items-center gap-1" onClick={() => remove(c)} aria-label="מחק תגובה"><Trash2 size={13} /></button>
            )}
          </div>
        </div>
        <button className="flex min-w-[36px] flex-col items-center pt-1 text-muted" onClick={() => toggleLike(c)} aria-pressed={liked} aria-label={liked ? 'הסר לב מהתגובה' : 'לב לתגובה'}>
          <Heart size={18} className={liked ? 'fill-[#FF5A5F] text-[#FF5A5F]' : ''} />
          <span className="tnum text-[12px]">{l.length || ''}</span>
        </button>
      </div>
    )
  }

  return (
    <>
      <button className="absolute inset-x-0 top-0 h-[34dvh]" onClick={onClose} aria-label="סגור תגובות" />
      <div className="absolute inset-x-0 bottom-0 z-10 flex h-[66dvh] flex-col rounded-t-[22px] bg-surface text-ink animate-rise"
        style={{ transform: drag ? `translateY(${drag}px)` : undefined, transition: drag ? 'none' : 'transform .2s' }}>
        <div className="relative flex shrink-0 items-center justify-center border-b border-line px-4 pb-3 pt-4" style={{ touchAction: 'none' }}
          onPointerDown={(e) => { d0.current = e.clientY; (e.target as HTMLElement).setPointerCapture?.(e.pointerId) }}
          onPointerMove={(e) => { if (d0.current != null) setDrag(Math.max(0, e.clientY - d0.current)) }}
          onPointerUp={() => { if (drag > 90) onClose(); setDrag(0); d0.current = null }}
          onPointerCancel={() => { setDrag(0); d0.current = null }}>
          <span className="absolute top-1.5 h-1 w-10 rounded-full bg-line" aria-hidden />
          <h3 className="tnum text-[17px] font-bold">{all.length ? `${all.length} תגובות` : 'תגובות'}</h3>
          <button className="absolute end-2 top-2 grid h-11 w-11 place-items-center text-muted" onClick={onClose} onPointerDown={(e) => e.stopPropagation()} aria-label="סגור"><X size={22} /></button>
        </div>

        <ul ref={listRef} className="flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-4">
          {top.length === 0 && (
            <li className="flex flex-col items-center gap-2 pt-10 text-center text-muted">
              <MessageCircle size={30} />
              <span>עוד אין תגובות. תהיו הראשונים.</span>
            </li>
          )}
          {top.map((c) => {
            const rs = replies.get(c.id) ?? []
            const expanded = open.has(c.id)
            return (
              <li key={c.id}>
                {row(c)}
                {rs.length > 0 && (
                  <div className="ms-[52px] mt-2">
                    {expanded ? (
                      <div className="space-y-3">{rs.map((r) => row(r, true))}</div>
                    ) : (
                      <button className="flex items-center gap-2 text-[14px] font-semibold text-muted" onClick={() => setOpen((s) => new Set(s).add(c.id))}>
                        <span className="h-px w-6 bg-line" aria-hidden />
                        {rs.length === 1 ? 'לצפות בתשובה' : `לצפות ב-${rs.length} תשובות`} <ChevronDown size={15} />
                      </button>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>

        <div className="shrink-0 border-t border-line px-3 pb-[calc(var(--safe-bottom)+10px)] pt-2">
          {replyTo && (
            <div className="mb-2 flex items-center gap-2 rounded-xl bg-surface2 px-3 py-1.5 text-[14px] text-muted">
              <span className="min-w-0 flex-1 truncate">תשובה ל{member(replyTo.member_id)?.name}: <bdi>{replyTo.body}</bdi></span>
              <button className="grid h-7 w-7 place-items-center" onClick={() => setReplyTo(null)} aria-label="בטל תשובה"><X size={15} /></button>
            </div>
          )}
          <div className="flex items-center gap-2">
            {me && <Avatar member={me} size={38} />}
            <input ref={inputRef} className="min-h-[44px] min-w-0 flex-1 rounded-full bg-surface2 px-4 text-[16px] outline-none placeholder:text-muted" maxLength={300}
              placeholder={replyTo ? `תשובה ל${member(replyTo.member_id)?.name ?? ''}…` : 'נא להוסיף תגובה…'} value={draft} onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void send() }} />
            <button className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-green text-white disabled:opacity-40" disabled={!draft.trim() || sending} onClick={send} aria-label="שלח">
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
