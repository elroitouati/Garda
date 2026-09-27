export type LatLng = { lat: number; lng: number }

/** מרחק במטרים */
export function distance(a: LatLng, b: LatLng) {
  const R = 6371e3, r = Math.PI / 180
  const dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export function formatDistance(m: number) {
  if (m < 1000) return `${Math.round(m / 10) * 10} מ׳`
  return `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} ק״מ`
}

export function ago(iso: string, now = Date.now()) {
  const min = Math.floor((now - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'עכשיו'
  if (min < 60) return `לפני ${min} דק׳`
  const h = Math.floor(min / 60)
  return h < 24 ? `לפני ${h} ש׳` : 'לפני יותר מיום'
}

/** חי = עודכן ב-3 הדקות האחרונות; מתעמעם אחרי 15 */
export const isLive = (iso: string) => Date.now() - new Date(iso).getTime() < 3 * 60000
export const isStale = (iso: string) => Date.now() - new Date(iso).getTime() > 15 * 60000
