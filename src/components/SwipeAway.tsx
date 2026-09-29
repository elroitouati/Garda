import { useRef, useState, type ReactNode } from 'react'

/** כרטיס שאפשר להעיף בהחלקה הצידה, כמו התראה */
export function SwipeAway({ children, onGone }: { children: ReactNode; onGone: () => void }) {
  const [dx, setDx] = useState(0)
  const [gone, setGone] = useState(0)
  const s = useRef<{ id: number; x0: number; y0: number; on: boolean } | null>(null)
  const moved = useRef(false)
  return (
    <div data-no-swipe style={{ touchAction: 'pan-y' }}
      onPointerDown={(e) => { s.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, on: false }; moved.current = false }}
      onPointerMove={(e) => {
        const g = s.current
        if (!g || g.id !== e.pointerId) return
        const x = e.clientX - g.x0, y = e.clientY - g.y0
        if (!g.on) {
          if (Math.abs(y) > 10 && Math.abs(y) > Math.abs(x)) { s.current = null; return }
          if (Math.abs(x) < 10) return
          g.on = true; moved.current = true
        }
        setDx(x)
      }}
      onPointerUp={() => {
        const g = s.current
        s.current = null
        if (!g?.on) return
        if (Math.abs(dx) > 100) { setGone(dx > 0 ? 1 : -1); setTimeout(onGone, 220) } else setDx(0)
      }}
      onPointerCancel={() => { s.current = null; setDx(0) }}
      onClickCapture={(e) => { if (moved.current) { e.stopPropagation(); e.preventDefault(); moved.current = false } }}>
      <div style={{
        transform: gone ? `translateX(${gone * 120}%)` : dx ? `translateX(${dx}px)` : undefined,
        opacity: gone ? 0 : 1 - Math.min(0.6, Math.abs(dx) / 400),
        transition: gone ? 'transform .22s ease-in, opacity .22s' : dx ? 'none' : 'transform .25s',
      }}>
        {children}
      </div>
    </div>
  )
}
