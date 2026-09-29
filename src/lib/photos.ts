import imageCompression from 'browser-image-compression'
import exifr from 'exifr'
import type { Timed } from './schedule'
import type { Photo, Place } from './types'
import { prepareVideoFile } from './video'

export type Prepared = {
  full: Blob
  thumb: Blob
  meta: Pick<Photo, 'lat' | 'lng' | 'loc_source' | 'taken_at' | 'width' | 'height'> & Partial<Pick<Photo, 'kind' | 'duration'>>
}

function currentPosition(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((res) => {
    if (!navigator.geolocation) return res(null)
    navigator.geolocation.getCurrentPosition(
      (p) => res({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => res(null),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 120000 },
    )
  })
}

/** בלי GPS: משבצים לפי שעת הצילום ללו"ז של אותו יום */
function fromSchedule(t: Date, list: Timed[], hotel: Place | undefined) {
  const withPlace = list.filter((a) => a.place)
  const during = withPlace.find((a) => a.start <= t && t < a.end)
  const before = [...withPlace].reverse().find((a) => a.start <= t && a.day === during?.day)
    ?? [...withPlace].reverse().find((a) => a.start <= t && t.getTime() - a.end.getTime() < 6 * 3600_000)
  const p = (during ?? before)?.place ?? hotel
  return p ? { lat: p.lat, lng: p.lng } : null
}

/** מיקום לסרטון: GPS רק כשצולם עכשיו והשיתוף פעיל, אחרת לפי הלו"ז */
async function placeVideo(taken: Date, source: 'camera' | 'gallery', list: Timed[], hotel: Place | undefined, allowGps: boolean) {
  if (source === 'camera' && allowGps) {
    const pos = await currentPosition()
    if (pos) return { lat: pos.lat, lng: pos.lng, loc_source: 'device' as const }
  }
  const p = fromSchedule(taken, list, hotel)
  return { lat: p?.lat ?? 45.5362, lng: p?.lng ?? 10.5357, loc_source: 'schedule' as const }
}

export async function prepareVideo(file: File, source: 'camera' | 'gallery', list: Timed[], hotel: Place | undefined, allowGps: boolean, onProgress: (p: number) => void): Promise<Prepared> {
  const taken = source === 'camera' ? new Date() : new Date(file.lastModified || Date.now())
  const [v, place] = await Promise.all([prepareVideoFile(file, onProgress), placeVideo(taken, source, list, hotel, allowGps)])
  return {
    full: v.full, thumb: v.thumb,
    meta: { ...place, taken_at: taken.toISOString(), width: v.width, height: v.height, kind: 'video', duration: Math.round(v.duration * 10) / 10 },
  }
}

/** allowGps: רק כששיתוף המיקום שלי פעיל משתמשים ב-GPS; אחרת התמונה ממוקמת לפי הלו"ז */
export async function preparePhoto(file: File, source: 'camera' | 'gallery', list: Timed[], hotel: Place | undefined, allowGps: boolean): Promise<Prepared> {
  let lat: number | null = null, lng: number | null = null
  let loc: Photo['loc_source'] = 'device'
  let taken = new Date(file.lastModified || Date.now())

  // GPS ושעה מתוך ה-EXIF (באייפון הדפדפן בדרך כלל מוחק את המיקום)
  try {
    const ex = await exifr.parse(file, { gps: true, pick: ['DateTimeOriginal', 'latitude', 'longitude'] })
    if (ex?.DateTimeOriginal instanceof Date && !isNaN(+ex.DateTimeOriginal)) taken = ex.DateTimeOriginal
    if (allowGps && typeof ex?.latitude === 'number' && typeof ex?.longitude === 'number') { lat = ex.latitude; lng = ex.longitude; loc = 'exif' }
  } catch { /* אין EXIF */ }

  if (lat == null && source === 'camera' && allowGps) {
    const pos = await currentPosition()
    if (pos) { lat = pos.lat; lng = pos.lng; loc = 'device'; taken = new Date() }
  }
  if (lat == null) {
    const p = fromSchedule(taken, list, hotel)
    lat = p?.lat ?? 45.5362; lng = p?.lng ?? 10.5357; loc = 'schedule'
  }

  const [full, thumb] = await Promise.all([
    imageCompression(file, { maxWidthOrHeight: 2048, maxSizeMB: 1.6, initialQuality: 0.86, fileType: 'image/jpeg', useWebWorker: true }),
    imageCompression(file, { maxWidthOrHeight: 360, maxSizeMB: 0.08, initialQuality: 0.8, fileType: 'image/jpeg', useWebWorker: true }),
  ])
  let width: number | null = null, height: number | null = null
  try { const bmp = await createImageBitmap(full); width = bmp.width; height = bmp.height; bmp.close() } catch { /* ignore */ }
  return { full, thumb, meta: { lat, lng: lng!, loc_source: loc, taken_at: taken.toISOString(), width, height } }
}

// ── שמירה לגלריה ────────────────────────────────────────────
// אתר לא יכול לכתוב לגלריה של האייפון. פותחים את חלון השיתוף, ומשם "שמור תמונה".
const files = new Map<string, File>()

const fileName = (p: Photo) => `garda-${p.taken_at.slice(0, 10)}-${p.id.slice(0, 6)}.${p.kind === 'video' ? p.path.split('.').pop() : 'jpg'}`

export async function fetchPhotoFile(p: Photo, url: string): Promise<File> {
  const hit = files.get(p.id)
  if (hit) return hit
  const blob = await (await fetch(url)).blob()
  const f = new File([blob], fileName(p), { type: p.kind === 'video' ? blob.type || 'video/mp4' : 'image/jpeg' })
  files.set(p.id, f)
  return f
}
export const cachedFile = (p: Photo) => files.get(p.id) ?? null

export type SaveResult = 'shared' | 'downloaded' | 'cancelled'

/** קוראים מתוך לחיצה, עם קבצים שכבר הורדו (אחרת iOS מאבד את ההרשאה לשיתוף) */
export async function saveFiles(list: File[]): Promise<SaveResult> {
  if (navigator.canShare?.({ files: list })) {
    try {
      await navigator.share({ files: list })
      return 'shared'
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled'
      throw e
    }
  }
  for (const f of list) {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(f)
    a.download = f.name
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(a.href), 4000)
  }
  return 'downloaded'
}
