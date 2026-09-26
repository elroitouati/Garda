import { Camera, ImagePlus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Avatar } from '../components/Avatar'
import { useToast } from '../components/Toast'
import { useStore } from '../lib/store'
import type { Member } from '../lib/types'

const D = 260 // קוטר העיגול
const OUT = 512

/** צילום סלפי / בחירת תמונה + חיתוך לעיגול */
export function AvatarSetup({ member, onDone, onSkip, title }: { member: Member; onDone: () => void; onSkip?: () => void; title?: string }) {
  const { api, refresh } = useStore()
  const toast = useToast()
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [z, setZ] = useState(1)
  const [off, setOff] = useState({ x: 0, y: 0 })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const camRef = useRef<HTMLInputElement>(null)
  const galRef = useRef<HTMLInputElement>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{ d: number; z: number } | null>(null)

  const onFile = (f: File | undefined) => {
    if (!f) return
    setErr(null)
    const url = URL.createObjectURL(f)
    const im = new Image()
    im.onload = () => { setImg(im); setZ(1); setOff({ x: 0, y: 0 }) }
    im.onerror = () => setErr('לא הצלחתי לפתוח את התמונה. נסה תמונה אחרת.')
    im.src = url
  }

  const s = img ? (D / Math.min(img.naturalWidth, img.naturalHeight)) * z : 1
  const w = img ? img.naturalWidth * s : 0
  const h = img ? img.naturalHeight * s : 0
  const clamp = (o: { x: number; y: number }) => ({
    x: Math.max(-(w - D) / 2, Math.min((w - D) / 2, o.x)),
    y: Math.max(-(h - D) / 2, Math.min((h - D) / 2, o.y)),
  })
  useEffect(() => { setOff((o) => clamp(o)) }, [z]) // eslint-disable-line react-hooks/exhaustive-deps

  const onDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), z }
    }
  }
  const onMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId)
    if (!prev) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()]
      setZ(Math.max(1, Math.min(4, pinch.current.z * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.current.d))))
    } else if (pointers.current.size === 1) {
      setOff((o) => clamp({ x: o.x + e.clientX - prev.x, y: o.y + e.clientY - prev.y }))
    }
  }
  const onUp = (e: React.PointerEvent) => { pointers.current.delete(e.pointerId); if (pointers.current.size < 2) pinch.current = null }

  const save = async () => {
    if (!img || !api) return
    setBusy(true)
    setErr(null)
    try {
      const c = document.createElement('canvas')
      c.width = c.height = OUT
      const k = OUT / D
      c.getContext('2d')!.drawImage(img, (D / 2 - w / 2 + off.x) * k, (D / 2 - h / 2 + off.y) * k, w * k, h * k)
      const blob = await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('blob'))), 'image/jpeg', 0.85))
      await api.uploadAvatar(member.id, blob)
      await refresh()
      toast('התמונה נשמרה')
      onDone()
    } catch (e) {
      console.error(e)
      setErr(navigator.onLine ? 'ההעלאה נכשלה. נסה שוב.' : 'אין קליטה. נסה שוב כשתהיה רשת.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="fixed inset-0 z-[70] flex flex-col items-center overflow-y-auto bg-bg px-6 pt-safe pb-safe">
      <div className="flex w-full max-w-sm flex-1 flex-col items-center pt-10 animate-rise">
        <h1 className="text-center text-[28px]">{title ?? `היי ${member.name}!`}</h1>
        <p className="mt-1 text-center text-muted">{img ? 'גרור והגדל כדי למרכז את הפנים' : 'בחר תמונת פרופיל. היא תופיע על המפה ובכל מקום באפליקציה.'}</p>

        <div className="mt-8">
          {img ? (
            <div
              dir="ltr"
              className="relative overflow-hidden rounded-full bg-surface2 shadow-card"
              style={{ width: D, height: D, touchAction: 'none', cursor: 'grab' }}
              onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
            >
              <img src={img.src} alt="" draggable={false} className="pointer-events-none absolute max-w-none select-none"
                style={{ width: w, height: h, left: D / 2 - w / 2 + off.x, top: D / 2 - h / 2 + off.y }} />
            </div>
          ) : (
            <Avatar member={member} size={D * 0.62} />
          )}
        </div>

        {img && (
          <label className="mt-5 flex w-full items-center gap-3">
            <span className="text-sm text-muted">הגדלה</span>
            <input type="range" min={1} max={4} step={0.01} value={z} onChange={(e) => setZ(Number(e.target.value))} className="flex-1 accent-[rgb(var(--green))]" />
          </label>
        )}

        {err && <p role="alert" className="mt-4 text-center font-semibold text-terra">{err}</p>}

        <div className="mt-auto w-full space-y-3 pb-6 pt-8">
          {img ? (
            <>
              <button className="btn-primary w-full text-lg" disabled={busy} onClick={save}>{busy ? 'שומר…' : 'שמור תמונה'}</button>
              <button className="btn-ghost w-full" disabled={busy} onClick={() => setImg(null)}>תמונה אחרת</button>
            </>
          ) : (
            <>
              <button className="btn-primary w-full text-lg" onClick={() => camRef.current?.click()}><Camera size={20} /> צלם סלפי</button>
              <button className="btn-ghost w-full" onClick={() => galRef.current?.click()}><ImagePlus size={20} /> בחר מהגלריה</button>
              {onSkip && <button className="btn w-full text-muted" onClick={onSkip}>אחר כך</button>}
            </>
          )}
        </div>
        <input ref={camRef} type="file" accept="image/*" capture="user" hidden onChange={(e) => onFile(e.target.files?.[0])} />
        <input ref={galRef} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      </div>
    </main>
  )
}
