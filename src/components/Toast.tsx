import { CircleCheck } from 'lucide-react'
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

const Ctx = createContext<(msg: string) => void>(() => {})
export const useToast = () => useContext(Ctx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<{ text: string; id: number } | null>(null)
  const show = useCallback((text: string) => {
    const id = Date.now()
    setMsg({ text, id })
    setTimeout(() => setMsg((m) => (m?.id === id ? null : m)), 2200)
  }, [])
  return (
    <Ctx.Provider value={show}>
      {children}
      {msg && (
        <div className="pointer-events-none fixed inset-x-0 z-[80] flex justify-center px-4" style={{ top: 'calc(var(--safe-top) + 12px)' }}>
          <div key={msg.id} role="status" className="animate-rise flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-[15px] font-semibold text-bg shadow-float">
            <CircleCheck size={18} className="text-[#7BD389]" />
            {msg.text}
          </div>
        </div>
      )}
    </Ctx.Provider>
  )
}
