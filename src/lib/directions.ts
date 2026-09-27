import type { Place } from './types'

const KEY = 'garda-drive-v2'
let cache: Record<string, number> = {}
try { cache = JSON.parse(localStorage.getItem(KEY) || '{}') } catch { /* ignore */ }

/** זמן נסיעה בדקות (OSRM, חינמי ובלי מפתח) */
export async function driveMinutes(from: Place, to: Place): Promise<number | null> {
  if (from.id === to.id) return 0
  const k = `${from.id}>${to.id}`
  if (cache[k] != null) return cache[k]
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false`
    const j = await (await fetch(url)).json()
    const sec = j?.routes?.[0]?.duration
    if (typeof sec !== 'number') return null
    cache[k] = Math.round(sec / 60)
    localStorage.setItem(KEY, JSON.stringify(cache))
    return cache[k]
  } catch {
    return null
  }
}
