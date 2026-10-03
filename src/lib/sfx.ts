// אפקטי סאונד קצרים ל"המסע", מסונתזים ב-Web Audio (בלי קבצים)
let ctx: AudioContext | null = null
let on = true

export function sfxEnable(v: boolean) { on = v; ramp(0.3) }
/** חייב לקרות בתוך לחיצה של המשתמש, אחרת הדפדפן חוסם */
export function sfxUnlock() {
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
  } catch { ctx = null }
}

function out(gain: number) {
  if (!ctx || !on) return null
  const g = ctx.createGain()
  g.gain.value = gain
  g.connect(ctx.destination)
  return g
}

function tone(freq: number, dur: number, gain: number, type: OscillatorType = 'sine', slide = 1, delay = 0) {
  const g = out(gain); if (!g || !ctx) return
  const t = ctx.currentTime + delay
  const o = ctx.createOscillator()
  o.type = type
  o.frequency.setValueAtTime(freq, t)
  o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur)
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(gain, t + 0.008)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g); o.start(t); o.stop(t + dur + 0.02)
}

function noise(dur: number, gain: number, from: number, to: number) {
  const g = out(gain); if (!g || !ctx) return
  const t = ctx.currentTime
  const len = Math.floor(ctx.sampleRate * dur)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  const src = ctx.createBufferSource(); src.buffer = buf
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.9
  f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + dur)
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(gain, t + dur * 0.45)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(f); f.connect(g); src.start(t)
}

export const sfx = {
  pop: (hi = false) => tone(hi ? 880 : 620, 0.12, 0.22, 'sine', 1.6),
  tick: () => tone(2200, 0.03, 0.12, 'square', 0.8),
  whoosh: () => noise(1.1, 0.28, 300, 2400),
  thud: () => { tone(150, 0.25, 0.4, 'sine', 0.5); noise(0.18, 0.12, 900, 200) },
  chime: () => { tone(1046, 0.9, 0.16); tone(1318, 0.9, 0.12, 'sine', 1, 0.09); tone(1568, 1.1, 0.1, 'sine', 1, 0.18) },
  slam: () => { tone(98, 0.4, 0.45, 'triangle', 0.6); noise(0.25, 0.2, 1800, 300) },
}

// ── מוזיקת רקע רגועה לסרט (לופ), עם עוצמה שאפשר להנמיך כשסרטון מדבר ──
let music: { src: AudioBufferSourceNode; gain: GainNode } | null = null
let level = 0
let loading: Promise<void> | null = null
let wanted = false
const ramp = (secs: number) => {
  if (!music || !ctx) return
  const g = music.gain.gain, t = ctx.currentTime
  g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(on ? level : 0, t + secs)
}
export function musicStart(url: string, to = 0.5) {
  level = to; wanted = true
  if (music) { ramp(2.5); return }
  if (loading || !ctx) return
  const c = ctx
  loading = fetch(url).then((r) => r.arrayBuffer()).then((b) => c.decodeAudioData(b)).then((buf) => {
    if (music || !wanted) return
    const src = c.createBufferSource(); src.buffer = buf; src.loop = true
    const gain = c.createGain(); gain.gain.value = 0
    src.connect(gain); gain.connect(c.destination); src.start()
    music = { src, gain }
    ramp(3)
  }).catch(() => {}).finally(() => { loading = null })
}
export function musicLevel(to: number, secs = 0.8) { level = to; ramp(secs) }
export function musicStop(secs = 1.2) {
  const m = music; music = null; level = 0; wanted = false
  if (!m || !ctx) return
  const t = ctx.currentTime
  m.gain.gain.cancelScheduledValues(t); m.gain.gain.setValueAtTime(m.gain.gain.value, t); m.gain.gain.linearRampToValueAtTime(0, t + secs)
  m.src.stop(t + secs + 0.05)
}
