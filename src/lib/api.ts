import { supabase } from './supabase'
import type { LiveData, Location, Meeting, Message, Photo, TripData } from './types'

export type PickMember = { id: string; name: string; color: string; initials: string | null }
export type RpcResult = { ok?: boolean; error?: string; members?: PickMember[] }

type Table = 'households' | 'members' | 'places' | 'days' | 'activities' | 'essentials' | 'emergency_contacts'

export interface Api {
  /** member_id של המכשיר, null אם לא מחובר, 'offline' אם אי אפשר לבדוק */
  sessionMember(): Promise<string | null | 'offline'>
  checkPin(pin: string): Promise<RpcResult>
  join(pin: string, memberId: string): Promise<RpcResult>
  switchMember(memberId: string): Promise<RpcResult>
  signOut(): Promise<void>
  fetchAll(): Promise<TripData>
  sign(bucket: 'avatars' | 'photos', paths: string[]): Promise<Record<string, string>>
  uploadAvatar(memberId: string, blob: Blob): Promise<void>
  upsert(table: Table, row: Record<string, unknown>): Promise<void>
  remove(table: Table, key: string, value: string): Promise<void>
  setPin(pin: string): Promise<RpcResult>
  subscribe(onChange: () => void): () => void
  // הודעות ותמונות
  fetchLive(): Promise<LiveData>
  sendMessage(m: Omit<Message, 'id' | 'created_at' | 'reminded_at'>): Promise<void>
  markRead(messageId: string, memberId: string): Promise<void>
  remind(messageId: string): Promise<void>
  uploadPhoto(memberId: string, full: Blob, thumb: Blob, meta: Pick<Photo, 'lat' | 'lng' | 'loc_source' | 'taken_at' | 'width' | 'height'>): Promise<void>
  movePhoto(id: string, lat: number, lng: number): Promise<void>
  deletePhoto(p: Photo): Promise<void>
  subscribeLive(onChange: () => void): () => void
  // מיקום, מפגש, Push
  saveLocation(l: Omit<Location, 'updated_at'>): Promise<void>
  createMeeting(m: Omit<Meeting, 'id' | 'created_at' | 'active'>): Promise<void>
  cancelMeeting(id: string): Promise<void>
  savePush(memberId: string, sub: PushSubscriptionJSON): Promise<void>
  setMyEmergencyPhone(phone: string): Promise<RpcResult>
}

function must<T>(r: { data: T | null; error: unknown }): T {
  if (r.error) throw r.error
  return r.data as T
}

const realApi = (): Api => {
  const sb = supabase!
  return {
    async sessionMember() {
      const { data } = await sb.auth.getSession()
      if (!data.session) return null
      if (!navigator.onLine) return 'offline'
      const r = await sb.from('devices').select('member_id').eq('user_id', data.session.user.id).maybeSingle()
      if (r.error) return 'offline'
      return r.data?.member_id ?? null
    },
    async checkPin(pin) {
      const { data } = await sb.auth.getSession()
      if (!data.session) {
        const s = await sb.auth.signInAnonymously()
        if (s.error) return { error: 'auth' }
      }
      const r = await sb.rpc('check_pin', { pin })
      if (r.error) return { error: 'network' }
      return r.data as RpcResult
    },
    async join(pin, memberId) {
      const r = await sb.rpc('join_family', { pin, member_id: memberId })
      if (r.error) return { error: 'network' }
      return r.data as RpcResult
    },
    async switchMember(memberId) {
      const r = await sb.rpc('switch_member', { member_id: memberId })
      if (r.error) return { error: 'network' }
      return r.data as RpcResult
    },
    async signOut() {
      const { data } = await sb.auth.getSession()
      if (data.session) await sb.from('devices').delete().eq('user_id', data.session.user.id)
      await sb.auth.signOut()
    },
    async fetchAll() {
      const [households, members, places, days, activities, essentials, emergency] = await Promise.all([
        sb.from('households').select('*').order('sort'),
        sb.from('members').select('*').order('sort'),
        sb.from('places').select('*').order('sort'),
        sb.from('days').select('*').order('date'),
        sb.from('activities').select('*').order('day').order('start_time').order('sort'),
        sb.from('essentials').select('*').order('sort'),
        sb.from('emergency_contacts').select('*').order('sort'),
      ])
      const shabbat = await sb.from('shabbat').select('*').maybeSingle()
      return {
        households: must(households), members: must(members), places: must(places), days: must(days),
        activities: must(activities), essentials: must(essentials), emergency: must(emergency),
        shabbat: shabbat.data ?? null, fetchedAt: Date.now(),
      }
    },
    async sign(bucket, paths) {
      if (!paths.length) return {}
      const r = await sb.storage.from(bucket).createSignedUrls(paths, 60 * 60 * 24 * 7)
      const out: Record<string, string> = {}
      for (const x of r.data ?? []) if (x.path && x.signedUrl) out[x.path] = x.signedUrl
      return out
    },
    async uploadAvatar(memberId, blob) {
      const path = `${memberId}/${Date.now()}.jpg`
      must(await sb.storage.from('avatars').upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' }))
      must(await sb.rpc('set_avatar', { member_id: memberId, path }))
    },
    async upsert(table, row) {
      must(await sb.from(table).upsert(row))
    },
    async remove(table, key, value) {
      must(await sb.from(table).delete().eq(key, value))
    },
    async setPin(pin) {
      const r = await sb.rpc('admin_set_pin', { new_pin: pin })
      if (r.error) return { error: 'network' }
      return r.data as RpcResult
    },
    subscribe(onChange) {
      const ch = sb.channel('trip-changes')
      for (const table of ['members', 'households', 'places', 'days', 'activities'])
        ch.on('postgres_changes', { event: '*', schema: 'public', table }, onChange)
      ch.subscribe()
      return () => { sb.removeChannel(ch) }
    },
    async fetchLive() {
      const since = new Date(Date.now() - 4 * 86400000).toISOString()
      const [messages, reads, photos, locations, meetings] = await Promise.all([
        sb.from('messages').select('*').gte('created_at', since).order('created_at', { ascending: false }),
        sb.from('message_reads').select('*').gte('read_at', since),
        sb.from('photos').select('*').order('taken_at', { ascending: false }),
        sb.from('locations').select('*'),
        sb.from('meetings').select('*').eq('active', true).gte('meet_at', new Date(Date.now() - 3 * 3600_000).toISOString()).order('created_at', { ascending: false }),
      ])
      return { messages: must(messages), reads: must(reads), photos: must(photos), locations: locations.data ?? [], meetings: meetings.data ?? [] }
    },
    async sendMessage(m) {
      must(await sb.from('messages').insert(m))
    },
    async markRead(messageId, memberId) {
      must(await sb.from('message_reads').upsert({ message_id: messageId, member_id: memberId, read_at: new Date().toISOString() }))
    },
    async remind(messageId) {
      must(await sb.rpc('remind_message', { message_id: messageId }))
    },
    async uploadPhoto(memberId, full, thumb, meta) {
      const id = crypto.randomUUID()
      const path = `${memberId}/${id}.jpg`
      const thumb_path = `${memberId}/${id}_t.jpg`
      const opts = { contentType: 'image/jpeg', cacheControl: '31536000' }
      must(await sb.storage.from('photos').upload(path, full, opts))
      must(await sb.storage.from('photos').upload(thumb_path, thumb, opts))
      must(await sb.from('photos').insert({ id, member_id: memberId, path, thumb_path, ...meta }))
    },
    async movePhoto(id, lat, lng) {
      must(await sb.from('photos').update({ lat, lng, loc_source: 'manual' }).eq('id', id))
    },
    async deletePhoto(p) {
      must(await sb.from('photos').delete().eq('id', p.id))
      await sb.storage.from('photos').remove([p.path, p.thumb_path])
    },
    async saveLocation(l) {
      must(await sb.from('locations').upsert({ ...l, updated_at: new Date().toISOString() }))
    },
    async createMeeting(m) {
      must(await sb.from('meetings').insert(m))
    },
    async cancelMeeting(id) {
      must(await sb.from('meetings').update({ active: false }).eq('id', id))
    },
    async savePush(memberId, sub) {
      must(await sb.from('push_subscriptions').upsert({ endpoint: sub.endpoint, member_id: memberId, p256dh: sub.keys?.p256dh, auth: sub.keys?.auth }))
    },
    async setMyEmergencyPhone(phone) {
      const r = await sb.rpc('set_my_emergency_phone', { phone })
      if (r.error) return { error: 'network' }
      return r.data as RpcResult
    },
    subscribeLive(onChange) {
      const ch = sb.channel('live-changes')
      for (const table of ['messages', 'message_reads', 'photos', 'locations', 'meetings'])
        ch.on('postgres_changes', { event: '*', schema: 'public', table }, onChange)
      ch.subscribe()
      return () => { sb.removeChannel(ch) }
    },
  }
}

let _api: Api | null = null
export async function getApi(): Promise<Api> {
  if (_api) return _api
  // בדיקה ישירה של import.meta.env כדי שהבילד ימחק את מצב ההדגמה
  if (import.meta.env.VITE_DEMO === '1') {
    const m = await import('./demo')
    _api = m.demoApi()
  } else {
    _api = realApi()
  }
  return _api
}
