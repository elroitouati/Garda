export const wazeLink = (lat: number, lng: number) => `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`
export const googleLink = (lat: number, lng: number) =>
  `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
export const googleSearchLink = (q: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`
