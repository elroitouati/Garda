import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { getApi, type Api } from './api'
import { CONFIGURED } from './env'
import type { Member, TripData } from './types'

type Phase = 'boot' | 'unconfigured' | 'pin' | 'ready'

type Store = {
  phase: Phase
  api: Api | null
  data: TripData | null
  me: Member | null
  meId: string | null
  loadError: string | null
  offline: boolean
  avatarUrl: (m: Member | null | undefined) => string | null
  refresh: () => Promise<void>
  enter: (memberId: string) => Promise<void>
  leave: () => Promise<void>
}

const Ctx = createContext<Store>(null as never)
export const useStore = () => useContext(Ctx)

const SNAP = 'garda-snapshot-v1'
const ME = 'garda-me'
const AVA = 'garda-avatars-v1'

function readJSON<T>(k: string): T | null {
  try { const s = localStorage.getItem(k); return s ? (JSON.parse(s) as T) : null } catch { return null }
}
function writeJSON(k: string, v: unknown) {
  try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* מלא/חסום */ }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>('boot')
  const [api, setApi] = useState<Api | null>(null)
  const [data, setData] = useState<TripData | null>(null)
  const [meId, setMeId] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [offline, setOffline] = useState(!navigator.onLine)
  const [avatars, setAvatars] = useState<Record<string, { url: string; exp: number }>>(() => readJSON(AVA) ?? {})
  const avatarsRef = useRef(avatars)
  avatarsRef.current = avatars

  const signAvatars = useCallback(async (a: Api, d: TripData) => {
    const need = d.members
      .map((m) => m.avatar_path)
      .filter((p): p is string => !!p && !(avatarsRef.current[p]?.exp > Date.now() + 86400000))
    if (!need.length) return
    try {
      const urls = await a.signAvatars(need)
      const exp = Date.now() + 6 * 86400000
      setAvatars((prev) => {
        const next = { ...prev }
        for (const [p, url] of Object.entries(urls)) if (url) next[p] = { url, exp }
        writeJSON(AVA, next)
        return next
      })
    } catch { /* אופליין */ }
  }, [])

  const load = useCallback(async (a: Api) => {
    try {
      const d = await a.fetchAll()
      setData(d)
      writeJSON(SNAP, d)
      setLoadError(null)
      void signAvatars(a, d)
    } catch (e) {
      console.error(e)
      setLoadError(navigator.onLine ? 'server' : 'offline')
    }
  }, [signAvatars])

  // אתחול
  useEffect(() => {
    if (!CONFIGURED) { setPhase('unconfigured'); return }
    let cancelled = false
    ;(async () => {
      const a = await getApi()
      if (cancelled) return
      setApi(a)
      const cachedMe = localStorage.getItem(ME)
      const snap = readJSON<TripData>(SNAP)
      if (cachedMe && snap) {
        // נכנסים מיד מהמטמון (עובד גם בלי קליטה), ומאמתים ברקע
        setMeId(cachedMe); setData(snap); setPhase('ready')
      }
      const who = await a.sessionMember()
      if (cancelled) return
      if (who === 'offline') {
        if (!(cachedMe && snap)) { setLoadError('offline'); setPhase(cachedMe ? 'ready' : 'pin') }
        return
      }
      if (!who) {
        localStorage.removeItem(ME)
        setMeId(null); setPhase('pin')
        return
      }
      localStorage.setItem(ME, who)
      setMeId(who)
      setPhase('ready')
      await load(a)
    })()
    return () => { cancelled = true }
  }, [load])

  // עדכונים חיים ממסך הניהול
  useEffect(() => {
    if (!api || phase !== 'ready') return
    let t: ReturnType<typeof setTimeout> | undefined
    const off = api.subscribe(() => { clearTimeout(t); t = setTimeout(() => load(api), 400) })
    return () => { clearTimeout(t); off() }
  }, [api, phase, load])

  useEffect(() => {
    const on = () => { setOffline(false); if (api && phase === 'ready') void load(api) }
    const offF = () => setOffline(true)
    const vis = () => { if (document.visibilityState === 'visible' && api && phase === 'ready' && navigator.onLine) void load(api) }
    window.addEventListener('online', on)
    window.addEventListener('offline', offF)
    document.addEventListener('visibilitychange', vis)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', offF)
      document.removeEventListener('visibilitychange', vis)
    }
  }, [api, phase, load])

  const enter = useCallback(async (memberId: string) => {
    localStorage.setItem(ME, memberId)
    setMeId(memberId)
    setPhase('ready')
    if (api) await load(api)
  }, [api, load])

  const leave = useCallback(async () => {
    try { await api?.signOut() } catch { /* ignore */ }
    localStorage.removeItem(ME)
    localStorage.removeItem(SNAP)
    setMeId(null); setData(null); setPhase('pin')
  }, [api])

  const refresh = useCallback(async () => { if (api) await load(api) }, [api, load])

  const me = useMemo(() => data?.members.find((m) => m.id === meId) ?? null, [data, meId])
  const avatarUrl = useCallback((m: Member | null | undefined) => (m?.avatar_path ? avatars[m.avatar_path]?.url ?? null : null), [avatars])

  const value = useMemo<Store>(() => ({
    phase, api, data, me, meId, loadError, offline, avatarUrl, refresh, enter, leave,
  }), [phase, api, data, me, meId, loadError, offline, avatarUrl, refresh, enter, leave])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
