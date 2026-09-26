// כל החישובים לפי שעון איטליה
export const TZ = 'Europe/Rome'

const fmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
})

function parts(d: Date) {
  const o: Record<string, number> = {}
  for (const p of fmt.formatToParts(d)) if (p.type !== 'literal') o[p.type] = Number(p.value)
  return o as { year: number; month: number; day: number; hour: number; minute: number; second: number }
}

/** התאריך ברומא כ-YYYY-MM-DD */
export function romeDate(d: Date): string {
  const p = parts(d)
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

function offsetMs(d: Date) {
  const p = parts(d)
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(d.getTime() / 1000) * 1000
}

/** תאריך + שעה בשעון רומא → רגע אבסולוטי */
export function romeToDate(date: string, time: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  const guess = Date.UTC(y, m - 1, d, hh, mm)
  const off = offsetMs(new Date(guess))
  return new Date(guess - off)
}

export const hm = (t: string | null | undefined) => (t ? t.slice(0, 5) : '')

// ── שעון מדומה לבדיקות: ?now=2026-09-28T10:30 ──
let fakeOffset = 0
try {
  const q = new URLSearchParams(location.search).get('now')
  if (q === 'real') sessionStorage.removeItem('garda-now')
  else if (q) sessionStorage.setItem('garda-now', q)
  const saved = sessionStorage.getItem('garda-now')
  if (saved) {
    const [date, time = '12:00'] = saved.split('T')
    fakeOffset = romeToDate(date, time).getTime() - Date.now()
  }
} catch { /* ignore */ }
export const now = () => new Date(Date.now() + fakeOffset)
export const isFakeNow = () => fakeOffset !== 0

const WEEKDAYS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳']
export function weekdayLetter(date: string) {
  const [y, m, d] = date.split('-').map(Number)
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
}
export function shortDate(date: string) {
  const [, m, d] = date.split('-').map(Number)
  return `${d}.${m}`
}

export function formatDuration(ms: number): string {
  const totalMin = Math.max(0, Math.round(ms / 60000))
  const d = Math.floor(totalMin / 1440)
  const h = Math.floor((totalMin % 1440) / 60)
  const m = totalMin % 60
  if (d > 0) return h ? `${d} ימים ו-${h} ש׳` : `${d} ימים`
  if (h > 0) return m ? `${h} ש׳ ${m} דק׳` : `${h} ש׳`
  return `${m} דק׳`
}

/** ספירה לאחור H:MM:SS */
export function countdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = s % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h ? `${h}:${pad(m)}:${pad(ss)}` : `${pad(m)}:${pad(ss)}`
}
