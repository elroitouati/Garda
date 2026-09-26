import { Phone, X } from 'lucide-react'
import { useStore } from '../lib/store'

/** כרטיס חירום באיטלקית, גופן גדול, זמין גם בלי קליטה */
export function EmergencyCard({ onClose }: { onClose: () => void }) {
  const { data, me } = useStore()
  const contacts = (data?.emergency ?? []).filter((c) => c.household_id === me?.household_id)
  const hotelEss = data?.essentials.find((e) => e.kind === 'hotel')
  const hotelPlace = data?.places.find((p) => p.kind === 'hotel')
  const hotelName = hotelEss?.title ?? hotelPlace?.name ?? ''
  const hotelAddr = hotelEss?.address ?? hotelPlace?.address ?? ''
  const tel = (p: string) => `tel:${p.replace(/[^\d+]/g, '')}`

  return (
    <div className="fixed inset-0 z-[90] overflow-y-auto bg-[#FFFDF8] text-[#1B1A17] pt-safe pb-safe" role="dialog" aria-modal="true" aria-label="כרטיס חירום">
      <div className="mx-auto max-w-lg px-6 pb-10">
        <div className="flex justify-end pt-3">
          <button className="grid h-12 w-12 place-items-center rounded-full bg-black/5" onClick={onClose} aria-label="סגור"><X size={26} /></button>
        </div>
        <div dir="ltr" lang="it" className="text-left">
          <p className="inline-block rounded-full bg-[#C83030] px-3 py-1 text-sm font-bold uppercase tracking-wide text-white">Aiuto · Emergenza</p>
          <h1 className="mt-4 font-sans text-[34px] font-extrabold leading-tight">Vengo da Israele e ho perso la mia famiglia.</h1>
          <p className="mt-1 text-[16px] text-[#6A6458]" dir="rtl" lang="he">אני מישראל ואיבדתי את המשפחה שלי.</p>

          <h2 className="mt-8 font-sans text-[24px] font-bold">Per favore, chiamate i miei genitori:</h2>
          <p className="text-[16px] text-[#6A6458]" dir="rtl" lang="he">בבקשה תתקשרו להורים שלי:</p>
          <ul className="mt-3 space-y-3">
            {contacts.length === 0 && <li className="rounded-2xl bg-black/5 p-4 text-[20px]">—</li>}
            {contacts.map((c) => (
              <li key={c.id} className="rounded-2xl border-2 border-black/10 p-4">
                <div className="text-[24px] font-bold">{c.name_latin || c.name}{c.role ? ` (${c.role})` : ''}</div>
                {c.phone ? (
                  <a href={tel(c.phone)} className="mt-2 flex min-h-[56px] items-center justify-between gap-3 rounded-xl bg-[#2F6B3A] px-4 text-white">
                    <span className="tnum text-[26px] font-bold">{c.phone}</span>
                    <Phone size={26} />
                  </a>
                ) : (
                  <div className="mt-1 text-[18px] text-[#6A6458]" dir="rtl" lang="he">מספר הטלפון עוד לא הוזן</div>
                )}
              </li>
            ))}
          </ul>

          <h2 className="mt-8 font-sans text-[24px] font-bold">Il nostro hotel:</h2>
          <p className="mt-1 text-[24px] font-semibold leading-snug">{hotelName}</p>
          <p className="text-[22px] leading-snug">{hotelAddr}</p>

          <a href="tel:112" className="mt-8 flex min-h-[64px] items-center justify-between rounded-2xl bg-[#C83030] px-5 text-white">
            <span className="text-[24px] font-extrabold">Emergenza · 112</span>
            <Phone size={28} />
          </a>
          <p className="mt-2 text-[15px] text-[#6A6458]" dir="rtl" lang="he">112 הוא מספר החירום באיטליה (משטרה, אמבולנס, כיבוי).</p>
        </div>
      </div>
    </div>
  )
}
