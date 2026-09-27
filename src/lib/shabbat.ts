import type { Shabbat } from './types'

export type ShabbatPhase = 'none' | 'friday' | 'shabbat'

/** friday = ביום הדלקת הנרות, לפני הזמן; shabbat = מכניסת שבת ועד צאתה */
export function shabbatPhase(s: Shabbat | null | undefined, t: Date): ShabbatPhase {
  if (!s) return 'none'
  const c = new Date(s.candles).getTime(), h = new Date(s.havdalah).getTime(), n = t.getTime()
  if (n >= c && n < h) return 'shabbat'
  if (n < c && c - n < 16 * 3600_000) return 'friday'
  return 'none'
}

export const romeHM = (iso: string) => new Date(iso).toLocaleTimeString('he-IL', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' })
