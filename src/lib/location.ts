import { useCallback, useEffect, useRef, useState } from 'react'
import { distance, type LatLng } from './geo'
import { useStore } from './store'

export type Consent = 'yes' | 'no' | null
export type GeoState = 'off' | 'waiting' | 'on' | 'denied' | 'unavailable'

const KEY = 'garda-location-consent'
const MIN_MOVE = 25 // מטר
const MIN_INTERVAL = 30_000 // מ"ש

function readConsent(): Consent {
  try { return (localStorage.getItem(KEY) as Consent) ?? null } catch { return null }
}

/**
 * שיתוף מיקום: רק אחרי הסכמה (לחיצה), רק כשהמתג פעיל ולא בשבת.
 * שולחים לשרת רק כשזזים מעל 25 מ' או כל 30 שניות, כדי לחסוך בסוללה.
 */
export function useLocationSharing(paused: boolean) {
  const { api, me, live } = useStore()
  const [consent, setConsentState] = useState<Consent>(readConsent)
  const [state, setState] = useState<GeoState>('off')
  const [pos, setPos] = useState<(LatLng & { heading: number | null; accuracy: number }) | null>(null)
  const last = useRef<{ p: LatLng; t: number } | null>(null)
  const mine = live.locations.find((l) => l.member_id === me?.id)
  const sharing = consent === 'yes' && (mine ? mine.sharing : true)

  const setConsent = useCallback((c: Consent) => {
    try { if (c) localStorage.setItem(KEY, c); else localStorage.removeItem(KEY) } catch { /* ignore */ }
    setConsentState(c)
  }, [])

  useEffect(() => {
    if (!api || !me || !sharing || paused) { setState('off'); return }
    if (!navigator.geolocation) { setState('unavailable'); return }
    setState('waiting')
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const here = { lat: p.coords.latitude, lng: p.coords.longitude }
        setState('on')
        setPos({ ...here, heading: p.coords.heading ?? null, accuracy: p.coords.accuracy })
        const now = Date.now()
        if (last.current && distance(last.current.p, here) < MIN_MOVE && now - last.current.t < MIN_INTERVAL) return
        last.current = { p: here, t: now }
        void api.saveLocation({
          member_id: me.id, lat: here.lat, lng: here.lng, accuracy: p.coords.accuracy,
          heading: Number.isFinite(p.coords.heading) ? p.coords.heading : null, sharing: true,
        }).catch(() => { last.current = null })
      },
      (e) => setState(e.code === e.PERMISSION_DENIED ? 'denied' : 'unavailable'),
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 30_000 },
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [api, me?.id, sharing, paused]) // eslint-disable-line react-hooks/exhaustive-deps

  /** מתג "שתף מיקום" */
  const setSharing = useCallback(async (on: boolean) => {
    if (!api || !me) return
    if (on) setConsent('yes')
    last.current = null
    await api.saveLocation({
      member_id: me.id, lat: mine?.lat ?? pos?.lat ?? null, lng: mine?.lng ?? pos?.lng ?? null,
      accuracy: mine?.accuracy ?? null, heading: null, sharing: on,
    })
  }, [api, me, mine, pos, setConsent])

  return { consent, setConsent, state, pos, sharing, setSharing }
}

export const isIOS = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
export const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true
