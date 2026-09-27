import type { Member, Message, MessageRead } from './types'

/** מי אמור לקבל את ההודעה (בלי השולח ובלי ילדים בלי טלפון) */
export function recipientsOf(m: Message, members: Member[]): Member[] {
  const sender = members.find((x) => x.id === m.sender_id)
  return members.filter((x) => {
    if (!x.active || x.guardian_id || x.id === m.sender_id) return false
    if (m.audience === 'household') return x.household_id === (m.household_id ?? sender?.household_id)
    if (m.audience === 'custom') return (m.recipients ?? []).includes(x.id)
    return true
  })
}

export function isForMe(m: Message, me: Member, members: Member[]) {
  return m.sender_id !== me.id && recipientsOf(m, members).some((x) => x.id === me.id)
}

export function readOf(m: Message, memberId: string, reads: MessageRead[]) {
  return reads.find((r) => r.message_id === m.id && r.member_id === memberId) ?? null
}

/** האם צריך להקפיץ את ההודעה עכשיו */
export function shouldPop(m: Message, me: Member, members: Member[], reads: MessageRead[], now = Date.now()) {
  if (!isForMe(m, me, members)) return false
  const r = readOf(m, me.id, reads)
  if (r && !(m.reminded_at && m.reminded_at > r.read_at)) return false
  const age = now - new Date(m.reminded_at ?? m.created_at).getTime()
  return m.important ? age < 48 * 3600_000 : age < 30 * 60_000
}

export const QUICK_MESSAGES = ['אין תור פה, בואו!', 'אנחנו בדרך', 'חוזרים לרכב', 'מחכים לכם', 'הכל בסדר אצלנו', 'מישהו ראה את…?']

// ── צליל ורטט ──
let ctx: AudioContext | null = null
/** iOS דורש לפתוח את האודיו מתוך נגיעה של המשתמש */
export function unlockAudio() {
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    if (ctx.state === 'suspended') void ctx.resume()
  } catch { /* ignore */ }
}

export function alertFeedback(important: boolean) {
  try { navigator.vibrate?.(important ? [300, 120, 300, 120, 600] : [90]) } catch { /* ignore */ }
  if (!ctx || ctx.state !== 'running') return
  const notes = important ? [880, 660, 880, 660, 988] : [784, 988]
  const t0 = ctx.currentTime
  notes.forEach((f, i) => {
    const o = ctx!.createOscillator(), g = ctx!.createGain()
    o.type = 'sine'; o.frequency.value = f
    const t = t0 + i * (important ? 0.22 : 0.14)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(important ? 0.5 : 0.18, t + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t + (important ? 0.2 : 0.12))
    o.connect(g).connect(ctx!.destination)
    o.start(t); o.stop(t + 0.25)
  })
}

export function timeHM(iso: string) {
  return new Date(iso).toLocaleTimeString('he-IL', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' })
}
