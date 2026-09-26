import { X } from 'lucide-react'
import type { ReactNode } from 'react'

/** מסך מלא עם כותרת וכפתור סגירה */
export function Overlay({ title, onClose, children, actions }: { title: string; onClose: () => void; children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-bg animate-rise" role="dialog" aria-modal="true" aria-label={title}>
      <header className="flex items-center gap-2 border-b border-line bg-surface px-3 pt-safe">
        <button className="btn-icon my-2 shadow-none bg-surface2" onClick={onClose} aria-label="סגור"><X size={22} /></button>
        <h1 className="flex-1 truncate text-xl">{title}</h1>
        {actions}
      </header>
      <div className="flex-1 overflow-y-auto overscroll-contain pb-safe">{children}</div>
    </div>
  )
}
