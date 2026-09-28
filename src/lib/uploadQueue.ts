// תור העלאה: תמונה שלא עלתה (אין קליטה) נשמרת בטלפון ועולה לבד כשהקליטה חוזרת
import type { Api } from './api'
import type { Prepared } from './photos'

type Item = Prepared & { key: number; memberId: string; addedAt: number }
const DB = 'garda-uploads', STORE = 'queue'

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1)
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'key', autoIncrement: true })
    r.onsuccess = () => res(r.result)
    r.onerror = () => rej(r.error)
  })
}
async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open()
  return new Promise((res, rej) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE))
    req.onsuccess = () => res(req.result)
    req.onerror = () => rej(req.error)
  })
}

export async function enqueue(memberId: string, p: Prepared) {
  await tx('readwrite', (s) => s.add({ ...p, memberId, addedAt: Date.now() }))
}
export async function pendingCount(): Promise<number> {
  try { return await tx('readonly', (s) => s.count()) } catch { return 0 }
}

let flushing = false
/** מעלה את כל מה שבתור. מחזיר כמה עלו */
export async function flush(api: Api): Promise<number> {
  if (flushing || !navigator.onLine) return 0
  flushing = true
  let done = 0
  try {
    const items = await tx<Item[]>('readonly', (s) => s.getAll() as IDBRequest<Item[]>)
    for (const it of items) {
      try {
        await api.uploadPhoto(it.memberId, it.full, it.thumb, it.meta)
        await tx('readwrite', (s) => s.delete(it.key))
        done++
      } catch { break } // עדיין אין קליטה טובה — ננסה אחר כך
    }
  } catch { /* אין IndexedDB */ } finally { flushing = false }
  return done
}
