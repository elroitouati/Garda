import { useCallback, useEffect, useRef, useState } from 'react'
import { distance, type LatLng } from './geo'
import { useStore } from './store'

export type Consent = 'yes' | 'no' | null
export type GeoState = 'off' | 'waiting' | 'on' | 'denied' | 'unavailable'

// ההסכמה שמורה לכל בן משפחה בנפרד: מי שנכנס לטלפון של מישהו אחר לא "יורש" את השיתוף שלו
const LEGACY_KEY = 'garda-location-consent'
const keyFor = (memberId: string) => `garda-location-consent-${memberId}`
const MIN_MOVE = 25 // מטר
const MIN_INTERVAL = 30_000 // מ"ש

function readConsent(memberId: string | undefined): Consent {
  if (!memberId) return null
  try {
    const own = localStorage.getItem(keyFor(memberId)) as Consent
    if (own) return own
    // מעבר מהגרסה הקודמת: ההסכמה הכללית שייכת למי שמחובר עכשיו, ורק לו
    const legacy = localStorage.getItem(LEGACY_KEY) as Consent
    if (legacy) { localStorage.setItem(keyFor(memberId), legacy); localStorage.removeItem(LEGACY_KEY) }
    return legacy ?? null
  } catch { return null }
}

/**
 * שיתוף מיקום: רק אחרי הסכמה (לחיצה), רק כשהמתג פעיל ולא בשבת.
 * שולחים לשרת רק כשזזים מעל 25 מ' או כל 30 שניות, כדי לחסוך בסוללה.
 */
export function useLocationSharing(paused: boolean) {
  const { api, me, live, liveReady } = useStore()
  const [consent, setConsentState] = useState<Consent>(() => readConsent(me?.id))
  useEffect(() => { setConsentState(readConsent(me?.id)) }, [me?.id])
  const [state, setState] = useState<GeoState>('off')
  const [pos, setPos] = useState<(LatLng & { heading: number | null; accuracy: number }) | null>(null)
  const last = useRef<{ p: LatLng; t: number } | null>(null)
  const mine = live.locations.find((l) => l.member_id === me?.id)
  // לא מניחים כלום לפני שיודעים מה בחרת: עד שהשרת עונה, לא שולחים מיקום
  const sharing = consent === 'yes' && liveReady && (mine ? mine.sharing : true)
  // עוצרים ומנתקים: אם כבר לא משתפים, לא שולחים יותר כלום
  useEffect(() => { if (!sharing) { last.current = null; setPos(null) } }, [sharing])

  const setConsent = useCallback((c: Consent) => {
    if (!me) return
    try { if (c) localStorage.setItem(keyFor(me.id), c); else localStorage.removeItem(keyFor(me.id)) } catch { /* ignore */ }
    setConsentState(c)
  }, [me?.id]) // eslint-disable-line react-hooks/exhaustive-deps

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
    setConsent(on ? 'yes' : 'no')
    last.current = null
    // השהיה מוחקת גם את המיקום האחרון מהשרת
    await api.saveLocation({ member_id: me.id, lat: null, lng: null, accuracy: null, heading: null, sharing: on })
  }, [api, me, mine, pos, setConsent])

  return { consent, setConsent, state, pos, sharing, setSharing }
}

export const isIOS = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
export const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true
