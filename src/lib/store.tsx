import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { getApi, type Api } from './api'
import { CONFIGURED } from './env'
import type { LiveData, Member, TripData } from './types'

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
  live: LiveData
  /** true אחרי שהנתונים החיים נטענו מהשרת לפחות פעם אחת */
  liveReady: boolean
  refreshLive: () => Promise<void>
  /** כתובת חתומה לקובץ בדלי photos (null עד שנחתם) */
  photoUrl: (path: string) => string | null
  signPhotos: (paths: string[]) => void
  refresh: () => Promise<void>
  enter: (memberId: string) => Promise<void>
  leave: () => Promise<void>
}

const Ctx = createContext<Store>(null as never)
export const useStore = () => useContext(Ctx)

const SNAP = 'garda-snapshot-v1'
const ME = 'garda-me'
const AVA = 'garda-signed-v2'

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

  const [liveReady, setLiveReady] = useState(false)
  const [live, setLive] = useState<LiveData>({ messages: [], reads: [], photos: [], locations: [], meetings: [], likes: [], comments: [] })

  // מטמון כתובות חתומות לשני הדליים (בתוקף 7 ימים, מתחדש יום לפני)
  const signing = useRef(new Set<string>())
  const signPaths = useCallback(async (a: Api, bucket: 'avatars' | 'photos', paths: string[]) => {
    const need = [...new Set(paths)].filter((p) => {
      const k = `${bucket}:${p}`
      return !(avatarsRef.current[k]?.exp > Date.now() + 86400000) && !signing.current.has(k)
    })
    if (!need.length) return
    need.forEach((p) => signing.current.add(`${bucket}:${p}`))
    try {
      for (let i = 0; i < need.length; i += 100) {
        const urls = await a.sign(bucket, need.slice(i, i + 100))
        const exp = Date.now() + 6 * 86400000
        setAvatars((prev) => {
          const next = { ...prev }
          for (const [p, url] of Object.entries(urls)) if (url) next[`${bucket}:${p}`] = { url, exp }
          writeJSON(AVA, next)
          return next
        })
      }
    } catch { /* אופליין */ } finally {
      need.forEach((p) => signing.current.delete(`${bucket}:${p}`))
    }
  }, [])
  const signAvatars = useCallback((a: Api, d: TripData) =>
    signPaths(a, 'avatars', d.members.map((m) => m.avatar_path).filter((p): p is string => !!p)), [signPaths])

  const loadLive = useCallback(async (a: Api) => {
    try {
      const l = await a.fetchLive()
      setLive(l)
      setLiveReady(true)
      void signPaths(a, 'photos', l.photos.slice(0, 60).map((p) => p.thumb_path))
    } catch (e) { console.warn('live', e) }
  }, [signPaths])

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

  // הודעות ותמונות: טעינה + עדכונים חיים
  useEffect(() => {
    if (!api || phase !== 'ready') return
    void loadLive(api)
    let t: ReturnType<typeof setTimeout> | undefined
    const off = api.subscribeLive(() => { clearTimeout(t); t = setTimeout(() => loadLive(api), 250) })
    const poll = setInterval(() => { if (document.visibilityState === 'visible') void loadLive(api) }, 20000)
    return () => { clearTimeout(t); off(); clearInterval(poll) }
  }, [api, phase, loadLive])

  useEffect(() => {
    const on = () => { setOffline(false); if (api && phase === 'ready') void load(api) }
    const offF = () => setOffline(true)
    const vis = () => { if (document.visibilityState === 'visible' && api && phase === 'ready' && navigator.onLine) { void load(api); void loadLive(api) } }
    window.addEventListener('online', on)
    window.addEventListener('offline', offF)
    document.addEventListener('visibilitychange', vis)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', offF)
      document.removeEventListener('visibilitychange', vis)
    }
  }, [api, phase, load, loadLive])

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
  const avatarUrl = useCallback((m: Member | null | undefined) => (m?.avatar_path ? avatars[`avatars:${m.avatar_path}`]?.url ?? null : null), [avatars])
  const photoUrl = useCallback((path: string) => avatars[`photos:${path}`]?.url ?? null, [avatars])
  const signPhotos = useCallback((paths: string[]) => { if (api) void signPaths(api, 'photos', paths) }, [api, signPaths])
  const refreshLive = useCallback(async () => { if (api) await loadLive(api) }, [api, loadLive])

  const value = useMemo<Store>(() => ({
    phase, api, data, me, meId, loadError, offline, avatarUrl, refresh, enter, leave, live, liveReady, refreshLive, photoUrl, signPhotos,
  }), [phase, api, data, me, meId, loadError, offline, avatarUrl, refresh, enter, leave, live, liveReady, refreshLive, photoUrl, signPhotos])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
