import type { Api } from './api'
import { isIOS, isStandalone } from './location'

export const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

export type PushStatus = 'unsupported' | 'needs-install' | 'default' | 'granted' | 'denied' | 'no-server'

export function pushStatus(): PushStatus {
  if (!VAPID_PUBLIC) return 'no-server'
  if (isIOS() && !isStandalone()) return 'needs-install'
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported'
  return Notification.permission === 'granted' ? 'granted' : Notification.permission === 'denied' ? 'denied' : 'default'
}

function key(b64: string) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

/** קוראים מתוך לחיצה (דרישה של iOS) */
export async function enablePush(api: Api, memberId: string): Promise<PushStatus> {
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return perm === 'denied' ? 'denied' : 'default'
  const reg = await navigator.serviceWorker.ready
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key(VAPID_PUBLIC!) }))
  await api.savePush(memberId, sub.toJSON())
  return 'granted'
}

/** מרענן את הרישום בשרת (למשל אחרי החלפת משתמש) */
export async function syncPush(api: Api, memberId: string) {
  if (pushStatus() !== 'granted') return
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) await api.savePush(memberId, sub.toJSON())
  } catch { /* ignore */ }
}
