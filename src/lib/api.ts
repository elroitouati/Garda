import { supabase } from './supabase'
import type { TripData } from './types'

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
  signAvatars(paths: string[]): Promise<Record<string, string>>
  uploadAvatar(memberId: string, blob: Blob): Promise<void>
  upsert(table: Table, row: Record<string, unknown>): Promise<void>
  remove(table: Table, key: string, value: string): Promise<void>
  setPin(pin: string): Promise<RpcResult>
  subscribe(onChange: () => void): () => void
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
      return {
        households: must(households), members: must(members), places: must(places), days: must(days),
        activities: must(activities), essentials: must(essentials), emergency: must(emergency),
        fetchedAt: Date.now(),
      }
    },
    async signAvatars(paths) {
      if (!paths.length) return {}
      const r = await sb.storage.from('avatars').createSignedUrls(paths, 60 * 60 * 24 * 7)
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
