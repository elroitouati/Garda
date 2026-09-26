import { MAPBOX_TOKEN } from './env'
import type { Place } from './types'

const KEY = 'garda-drive-v1'
let cache: Record<string, number> = {}
try { cache = JSON.parse(localStorage.getItem(KEY) || '{}') } catch { /* ignore */ }

/** זמן נסיעה בדקות (Mapbox Directions, driving) */
export async function driveMinutes(from: Place, to: Place): Promise<number | null> {
  if (from.id === to.id) return 0
  const k = `${from.id}>${to.id}`
  if (cache[k] != null) return cache[k]
  if (!MAPBOX_TOKEN) return null
  try {
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false&access_token=${MAPBOX_TOKEN}`
    const r = await fetch(url)
    const j = await r.json()
    const sec = j?.routes?.[0]?.duration
    if (typeof sec !== 'number') return null
    cache[k] = Math.round(sec / 60)
    localStorage.setItem(KEY, JSON.stringify(cache))
    return cache[k]
  } catch {
    return null
  }
}
