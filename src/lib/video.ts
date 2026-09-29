// סרטונים לאלבום: דוחסים בטלפון לפני ההעלאה (720p, בערך 15MB לדקה),
// כדי שהאחסון החינמי יספיק וכדי שסרטון מאייפון ינוגן גם באנדרואיד.

export const MAX_VIDEO_SEC = 60
const SMALL_OK = 12 * 1024 * 1024 // mp4 קטן עולה כמו שהוא
const HARD_LIMIT = 45 * 1024 * 1024 // מגבלת הקובץ בשרת היא 50MB
const LONG_SIDE = 1280
const VIDEO_BPS = 2_000_000

export class VideoError extends Error {
  code: 'too_long' | 'too_big' | 'unreadable'
  constructor(code: VideoError['code']) { super(code); this.code = code }
}

export const isVideoFile = (f: File) => f.type.startsWith('video/') || /\.(mp4|mov|m4v|webm|3gp)$/i.test(f.name)

// ── שחרור נגינה עם קול ─────────────────────────────────────
// באייפון אפשר לנגן עם קול (ולכן להקליט את הקול) רק אם האלמנט "שוחרר" בלחיצה של המשתמש.
type Unlocked = { video: HTMLVideoElement; ctx: AudioContext | null; source: MediaElementAudioSourceNode | null }
let unlocked: Unlocked | null = null

/** לקרוא מתוך onClick של כפתור ההעלאה */
export function unlockMedia() {
  if (unlocked) { void unlocked.ctx?.resume().catch(() => {}); return }
  const video = document.createElement('video')
  video.playsInline = true
  video.setAttribute('playsinline', '')
  let ctx: AudioContext | null = null
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (AC) { ctx = new AC(); void ctx.resume().catch(() => {}) }
  } catch { ctx = null }
  video.play().catch(() => {})
  unlocked = { video, ctx, source: null }
}

function element(): Unlocked {
  if (!unlocked) unlockMedia()
  return unlocked!
}

function waitFor(el: HTMLMediaElement, ev: string, ms: number) {
  return new Promise<void>((res, rej) => {
    const t = setTimeout(() => { el.removeEventListener(ev, ok); rej(new Error('timeout ' + ev)) }, ms)
    const ok = () => { clearTimeout(t); el.removeEventListener(ev, ok); res() }
    el.addEventListener(ev, ok)
  })
}

const even = (n: number) => Math.max(2, Math.round(n / 2) * 2)

function canvasBlob(c: HTMLCanvasElement, q: number) {
  return new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('toBlob'))), 'image/jpeg', q))
}

function pickMime(): string | null {
  if (typeof MediaRecorder === 'undefined') return null
  const list = [
    'video/mp4;codecs=avc1.42E01F,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4',
    'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm',
  ]
  return list.find((m) => { try { return MediaRecorder.isTypeSupported(m) } catch { return false } }) ?? null
}

export type VideoResult = { full: Blob; thumb: Blob; duration: number; width: number; height: number }

/** onProgress: 0..1 בזמן הדחיסה (הדחיסה לוקחת בערך את אורך הסרטון) */
export async function prepareVideoFile(file: File, onProgress: (p: number) => void): Promise<VideoResult> {
  const u = element()
  const video = u.video
  const url = URL.createObjectURL(file)
  try {
    video.muted = true
    video.preload = 'auto'
    video.src = url
    await waitFor(video, 'loadeddata', 20000).catch(() => { throw new VideoError('unreadable') })
    let duration = video.duration
    if (duration === Infinity) {
      // WebM בלי אורך בכותרת: קופצים לסוף כדי שהדפדפן יחשב אותו
      video.currentTime = 1e7
      await waitFor(video, 'seeked', 8000).catch(() => {})
      duration = video.duration
    }
    if (!isFinite(duration) || duration <= 0) throw new VideoError('unreadable')
    if (duration > MAX_VIDEO_SEC + 0.5) throw new VideoError('too_long')
    const vw = video.videoWidth || 720, vh = video.videoHeight || 1280

    // תמונה קטנה לרשת ולמפה
    video.currentTime = Math.min(0.5, duration / 3)
    await waitFor(video, 'seeked', 5000).catch(() => {})
    const ts = 360 / Math.max(vw, vh)
    const tc = document.createElement('canvas')
    tc.width = even(vw * ts); tc.height = even(vh * ts)
    tc.getContext('2d')!.drawImage(video, 0, 0, tc.width, tc.height)
    const thumb = await canvasBlob(tc, 0.8)

    const mime = pickMime()
    const smallMp4 = file.type === 'video/mp4' && file.size <= SMALL_OK
    const canRecord = !!mime && typeof HTMLCanvasElement.prototype.captureStream === 'function'
    if (smallMp4 || !canRecord) {
      if (file.size > HARD_LIMIT) throw new VideoError('too_big')
      onProgress(1)
      return { full: file, thumb, duration, width: vw, height: vh }
    }

    // דחיסה: מנגנים את הסרטון, מציירים ל-canvas קטן יותר ומקליטים
    const s = Math.min(1, LONG_SIDE / Math.max(vw, vh))
    const w = even(vw * s), h = even(vh * s)
    const canvas = document.createElement('canvas')
    canvas.width = w; canvas.height = h
    const c2d = canvas.getContext('2d')!
    const stream = canvas.captureStream(30)
    let withSound = false
    if (u.ctx) {
      try {
        await u.ctx.resume()
        u.source ??= u.ctx.createMediaElementSource(video)
        const dest = u.ctx.createMediaStreamDestination()
        u.source.disconnect()
        u.source.connect(dest)
        dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t))
        withSound = u.ctx.state === 'running'
      } catch { withSound = false }
    }
    const rec = new MediaRecorder(stream, { mimeType: mime!, videoBitsPerSecond: VIDEO_BPS, audioBitsPerSecond: 96_000 })
    const chunks: Blob[] = []
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data) }
    const stopped = new Promise<void>((res) => { rec.onstop = () => res() })

    video.currentTime = 0
    await waitFor(video, 'seeked', 5000).catch(() => {})
    // הקול עובר רק למקליט, לא לרמקול
    video.muted = !withSound
    try { await video.play() } catch {
      // הדפדפן לא נתן לנגן עם קול: מקליטים בלי קול
      video.muted = true
      await video.play()
    }
    rec.start(1000)
    let done = false
    const draw = () => {
      if (done) return
      c2d.drawImage(video, 0, 0, w, h)
      onProgress(Math.min(0.99, video.currentTime / duration))
      if (video.ended || video.currentTime >= MAX_VIDEO_SEC) { finish(); return }
      requestAnimationFrame(draw)
    }
    const finish = () => {
      if (done) return
      done = true
      video.pause()
      if (rec.state !== 'inactive') rec.stop()
    }
    video.onended = finish
    requestAnimationFrame(draw)
    await stopped
    video.onended = null
    const full = new Blob(chunks, { type: mime!.split(';')[0] })
    if (!full.size) throw new VideoError('unreadable')
    if (full.size > HARD_LIMIT) throw new VideoError('too_big')
    onProgress(1)
    return { full, thumb, duration, width: w, height: h }
  } finally {
    video.removeAttribute('src')
    video.load()
    URL.revokeObjectURL(url)
  }
}

export const videoExt = (type: string) => (type.includes('webm') ? 'webm' : type.includes('quicktime') ? 'mov' : 'mp4')

export const formatDuration = (sec: number | null) => {
  if (!sec) return ''
  const s = Math.round(sec)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
