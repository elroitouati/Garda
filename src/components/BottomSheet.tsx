import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'

export type Snap = 0 | 1 | 2
const PEEK = 118
const VELOCITY = 0.45 // px/ms — הנפה חזקה קופצת למצב הבא

function safeInsets() {
  const el = document.createElement('div')
  el.style.cssText = 'position:fixed;visibility:hidden;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)'
  document.body.appendChild(el)
  const cs = getComputedStyle(el)
  const r = { top: parseFloat(cs.paddingTop) || 0, bottom: parseFloat(cs.paddingBottom) || 0 }
  el.remove()
  return r
}

type Props = { snap: Snap; onSnap: (s: Snap) => void; children: ReactNode; hidden?: boolean }

export function BottomSheet({ snap, onSnap, children, hidden = false }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [vh, setVh] = useState(() => window.innerHeight)
  const [insets, setInsets] = useState({ top: 0, bottom: 0 })
  const [dragging, setDragging] = useState(false)

  useLayoutEffect(() => {
    setInsets(safeInsets())
    const on = () => setVh(window.innerHeight)
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])

  const heights = [PEEK + insets.bottom, Math.round(vh * 0.52), vh - insets.top - 6]
  const full = heights[2]

  const apply = useCallback((h: number) => {
    if (sheetRef.current) sheetRef.current.style.transform = `translate3d(0, ${full - h}px, 0)`
    document.documentElement.style.setProperty('--sheet-h', `${Math.min(h, heights[1])}px`)
  }, [full, heights[1]]) // eslint-disable-line react-hooks/exhaustive-deps

  // מוסתרת (למשל בזמן מסך הפתיחה): יושבת מתחת למסך ועולה משם
  useLayoutEffect(() => { apply(hidden ? -40 : heights[snap]) }, [snap, apply, hidden]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (snap !== 2 && contentRef.current) contentRef.current.scrollTop = 0 }, [snap])

  const g = useRef<{ id: number; y0: number; x0: number; h0: number; drag: boolean; handle: boolean; samples: [number, number][] } | null>(null)
  const suppressClick = useRef(false)

  const onDown = (e: React.PointerEvent) => {
    const handle = !!(e.target as HTMLElement).closest('[data-sheet-handle]')
    if (snap === 2 && !handle) return // במסך מלא — גלילה בלבד, סוגרים דרך הקו
    if ((e.target as HTMLElement).closest('[data-no-drag]')) return
    g.current = { id: e.pointerId, y0: e.clientY, x0: e.clientX, h0: heights[snap], drag: false, handle, samples: [[e.timeStamp, e.clientY]] }
  }
  const onMove = (e: React.PointerEvent) => {
    const s = g.current
    if (!s || s.id !== e.pointerId) return
    const dy = s.y0 - e.clientY
    const dx = e.clientX - s.x0
    if (!s.drag) {
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) { g.current = null; return }
      if (Math.abs(dy) < 8) return
      s.drag = true
      setDragging(true)
      sheetRef.current?.setPointerCapture(e.pointerId)
    }
    const h = Math.max(heights[0] * 0.75, Math.min(full, s.h0 + dy))
    apply(h)
    s.samples.push([e.timeStamp, e.clientY])
    if (s.samples.length > 6) s.samples.shift()
  }
  const onUp = (e: React.PointerEvent) => {
    const s = g.current
    g.current = null
    if (!s || s.id !== e.pointerId) return
    if (!s.drag) {
      if (s.handle) onSnap(((snap + 1) % 3) as Snap) // לחיצה על הקו: מעבר בין המצבים
      return
    }
    setDragging(false)
    suppressClick.current = true
    setTimeout(() => (suppressClick.current = false), 50)
    const h = s.h0 + (s.y0 - e.clientY)
    const [t0, y0] = s.samples[0]
    const v = (y0 - e.clientY) / Math.max(1, e.timeStamp - t0)
    let target: Snap
    if (v > VELOCITY) target = heights.findIndex((x) => x > h + 4) as Snap
    else if (v < -VELOCITY) target = ([2, 1, 0].find((i) => heights[i] < h - 4) ?? 0) as Snap
    else target = heights.reduce((best, x, i) => (Math.abs(x - h) < Math.abs(heights[best] - h) ? i : best), 0) as Snap
    if (target < 0) target = 2
    if (target === snap) apply(heights[snap])
    else onSnap(target)
  }

  const isFull = snap === 2
  return (
    <div
      ref={sheetRef}
      className={`fixed inset-x-0 bottom-0 z-30 flex flex-col bg-surface shadow-[0_-8px_30px_-12px_rgb(0_0_0/0.35)] ${isFull ? 'rounded-none' : 'rounded-t-[28px]'}`}
      style={{
        height: full,
        transition: dragging ? 'none' : hidden ? 'none' : 'transform .6s cubic-bezier(.16,1,.3,1), border-radius .3s',
        touchAction: isFull ? 'auto' : 'pan-x',
        willChange: 'transform',
      }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={() => { if (g.current?.drag) { setDragging(false); apply(heights[snap]) } g.current = null }}
      onClickCapture={(e) => { if (suppressClick.current) { e.stopPropagation(); e.preventDefault() } }}
    >
      <button
        type="button"
        data-sheet-handle
        className="flex h-7 w-full shrink-0 items-center justify-center"
        style={{ touchAction: 'none' }}
        aria-label={['פתח את החלונית', 'הרחב למסך מלא', 'הקטן את החלונית'][snap]}
      >
        <span className="h-[5px] w-11 rounded-full bg-line" />
      </button>
      <div
        ref={contentRef}
        className={`flex-1 overscroll-contain pb-safe ${isFull ? 'overflow-y-auto' : 'overflow-hidden'}`}
        style={{ touchAction: isFull ? 'pan-y' : 'pan-x' }}
      >
        {children}
      </div>
    </div>
  )
}
