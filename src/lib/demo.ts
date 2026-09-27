// מצב הדגמה לפיתוח בלבד: קורא את ה-seed מה-SQL ומדמה את השרת בזיכרון. PIN: 1234
import seedSql from '../../supabase/migrations/0002_seed.sql?raw'
import type { Api } from './api'
import type { LiveData, Message, TripData } from './types'

function parseValues(src: string): unknown[][] {
  const rows: unknown[][] = []
  let i = 0
  const n = src.length
  while (i < n) {
    while (i < n && src[i] !== '(') i++
    if (i >= n) break
    i++
    const row: unknown[] = []
    for (;;) {
      while (/\s/.test(src[i])) i++
      if (src[i] === "'") {
        let s = ''
        i++
        for (;;) {
          if (src[i] === "'" && src[i + 1] === "'") { s += "'"; i += 2 }
          else if (src[i] === "'") { i++; break }
          else s += src[i++]
        }
        row.push(s)
      } else {
        let tok = ''
        while (src[i] !== ',' && src[i] !== ')') tok += src[i++]
        tok = tok.trim()
        row.push(tok === 'null' ? null : tok === 'true' ? true : tok === 'false' ? false : Number(tok))
      }
      while (/\s/.test(src[i])) i++
      if (src[i] === ',') { i++; continue }
      if (src[i] === ')') { i++; break }
    }
    rows.push(row)
  }
  return rows
}

function parseSeed(): Record<string, Record<string, unknown>[]> {
  const out: Record<string, Record<string, unknown>[]> = {}
  const noComments = seedSql.replace(/--[^\n]*/g, '')
  const re = /insert into public\.(\w+)\s*\(([^)]*)\)\s*values([\s\S]*?);/g
  let m: RegExpExecArray | null
  while ((m = re.exec(noComments))) {
    const cols = m[2].split(',').map((c) => c.trim())
    const rows = parseValues(m[3]).map((vals) => Object.fromEntries(cols.map((c, k) => [c, vals[k]])))
    out[m[1]] = (out[m[1]] ?? []).concat(rows)
  }
  const up = /update public\.members set initials = '(\w+)' where id = '(\w+)'/g
  while ((m = up.exec(noComments))) {
    const mem = out.members.find((x) => x.id === m![2])
    if (mem) mem.initials = m[1]
  }
  return out
}

export function demoApi(): Api {
  const s = parseSeed()
  let uid = 0
  const id = () => `demo-${++uid}`
  const db: TripData = {
    households: s.households as never,
    members: s.members.map((x) => ({ initials: null, guardian_id: null, avatar_path: null, active: true, ...x })) as never,
    places: s.places as never,
    days: s.days as never,
    activities: s.activities.map((x) => ({ id: id(), household_id: null, ...x })) as never,
    essentials: s.essentials.map((x) => ({ id: id(), ...x, fields: JSON.parse(x.fields as string) })) as never,
    emergency: s.emergency_contacts.map((x) => ({ id: id(), ...x })) as never,
    fetchedAt: Date.now(),
  }
  const avatars: Record<string, string> = {}
  const listeners = new Set<() => void>()
  const emit = () => listeners.forEach((f) => f())
  const key = (t: string) => (t === 'emergency_contacts' ? 'emergency' : t) as keyof TripData
  const PIN = { v: '1234' }
  const live: LiveData = { messages: [], reads: [], photos: [] }
  const liveListeners = new Set<() => void>()
  const emitLive = () => liveListeners.forEach((f) => f())
  // הודעה לדוגמה, כדי לראות את הגלויה במצב הדגמה
  setTimeout(() => {
    const demoMsg: Message = {
      id: id(), sender_id: 'sharon', body: 'מתחילים לעלות לשער 5. כולם לבוא עכשיו!', important: true,
      audience: 'all', household_id: null, recipients: null, lat: 45.5211, lng: 10.5387,
      reminded_at: null, created_at: new Date().toISOString(),
    }
    if (localStorage.getItem('garda-demo-me') !== 'sharon') { live.messages.unshift(demoMsg); emitLive() }
  }, 6000)
  return {
    async sessionMember() { return localStorage.getItem('garda-demo-me') },
    async checkPin(pin) {
      if (pin !== PIN.v) return { error: 'bad_pin' }
      return { members: db.members.filter((m) => !m.guardian_id).map(({ id, name, color, initials }) => ({ id, name, color, initials })) }
    },
    async join(pin, memberId) {
      if (pin !== PIN.v) return { error: 'bad_pin' }
      localStorage.setItem('garda-demo-me', memberId)
      return { ok: true }
    },
    async switchMember(memberId) { localStorage.setItem('garda-demo-me', memberId); return { ok: true } },
    async signOut() { localStorage.removeItem('garda-demo-me') },
    async fetchAll() {
      await new Promise((r) => setTimeout(r, 300))
      return structuredClone({ ...db, fetchedAt: Date.now() })
    },
    async sign(_bucket, paths) { return Object.fromEntries(paths.map((p) => [p, avatars[p]])) },
    async uploadAvatar(memberId, blob) {
      const path = `${memberId}/${Date.now()}.jpg`
      avatars[path] = URL.createObjectURL(blob)
      const m = db.members.find((x) => x.id === memberId)
      if (m) m.avatar_path = path
      emit()
    },
    async upsert(table, row) {
      const arr = db[key(table)] as unknown as Record<string, unknown>[]
      const pk = table === 'days' ? 'date' : 'id'
      if (!row[pk]) row[pk] = id()
      const i = arr.findIndex((x) => x[pk] === row[pk])
      if (i >= 0) arr[i] = { ...arr[i], ...row }
      else arr.push(row)
      emit()
    },
    async remove(table, k, value) {
      const arr = db[key(table)] as unknown as Record<string, unknown>[]
      const i = arr.findIndex((x) => x[k] === value)
      if (i >= 0) arr.splice(i, 1)
      emit()
    },
    async setPin(pin) { PIN.v = pin; return { ok: true } },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn) },
    async fetchLive() { return structuredClone(live) },
    async sendMessage(m) {
      live.messages.unshift({ ...m, id: id(), created_at: new Date().toISOString(), reminded_at: null })
      emitLive()
    },
    async markRead(messageId, memberId) {
      live.reads = live.reads.filter((r) => !(r.message_id === messageId && r.member_id === memberId))
      live.reads.push({ message_id: messageId, member_id: memberId, read_at: new Date().toISOString() })
      emitLive()
    },
    async remind(messageId) {
      const m = live.messages.find((x) => x.id === messageId)
      if (m) m.reminded_at = new Date().toISOString()
      emitLive()
    },
    async uploadPhoto(memberId, full, thumb, meta) {
      const pid = id()
      const path = `${memberId}/${pid}.jpg`, thumb_path = `${memberId}/${pid}_t.jpg`
      avatars[path] = URL.createObjectURL(full)
      avatars[thumb_path] = URL.createObjectURL(thumb)
      live.photos.unshift({ id: pid, member_id: memberId, path, thumb_path, ...meta, created_at: new Date().toISOString() })
      emitLive()
    },
    async movePhoto(pid, lat, lng) {
      const p = live.photos.find((x) => x.id === pid)
      if (p) Object.assign(p, { lat, lng, loc_source: 'manual' })
      emitLive()
    },
    async deletePhoto(p) { live.photos = live.photos.filter((x) => x.id !== p.id); emitLive() },
    subscribeLive(fn) { liveListeners.add(fn); return () => liveListeners.delete(fn) },
  }
}
