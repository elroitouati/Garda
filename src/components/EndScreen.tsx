import { Clapperboard, Play } from 'lucide-react'
import type { ReactNode } from 'react'

const P = { ink: '#16263F', paper: '#FAF5EA', white: '#FFFDF7', red: '#D34838', blue: '#1768B0' }
const cover = `${import.meta.env.BASE_URL}journey/cover.jpg`

/** מסך הסיום של הטיול: קודם הסרט (כמו גלויה מהפתיח), ואחריו האלבום המלא */
export function EndScreen({ watched, started, onPlay, onSkip, album, onApp, faces }: {
  watched: boolean; started: boolean; onPlay: () => void; onSkip: () => void; album: ReactNode; onApp?: () => void; faces: string[]
}) {
  if (!watched) {
    return (
      <div className="journey fixed inset-0 z-[65] overflow-y-auto overscroll-contain" style={{ background: `linear-gradient(#F6DDB8 0%, ${P.paper} 42%)`, color: P.ink }} dir="rtl">
        {onApp && (
          <button className="absolute end-3 top-[calc(var(--safe-top)+10px)] z-10 min-h-[40px] rounded-full px-4 text-[14px] font-semibold" style={{ background: 'rgba(22,38,63,.08)' }} onClick={onApp}>
            לאפליקציה (מנהלים)
          </button>
        )}
        <div className="mx-auto flex min-h-full max-w-[420px] flex-col items-center justify-center px-6 pb-[calc(var(--safe-bottom)+28px)] pt-[calc(var(--safe-top)+64px)] text-center">
          {/* הגלויה: הפריים האחרון של הפתיח, עם כפתור ניגון */}
          <button className="j-pop relative w-[min(70vw,290px)] rounded-[8px] p-[10px] pb-[46px]" onClick={onPlay} aria-label="לצפייה בסרט"
            style={{ background: P.white, rotate: '-2.5deg', boxShadow: '0 30px 60px -24px rgba(22,38,63,.55), 0 2px 6px rgba(22,38,63,.08)', animationDelay: '.05s' }}>
            <span className="relative block aspect-[4/5] overflow-hidden rounded-[4px]">
              <img src={cover} alt="טואטי בגארדה, המסע מתחיל" className="h-full w-full object-cover" />
              <span className="absolute inset-x-0 bottom-[16%] grid place-items-center">
                <span className="end-pulse absolute h-[76px] w-[76px] rounded-full" style={{ background: P.red }} />
                <span className="relative grid h-[76px] w-[76px] place-items-center rounded-full shadow-float" style={{ background: P.red }}>
                  <Play size={32} className="ms-1 fill-white text-white" />
                </span>
              </span>
            </span>
            <span className="absolute inset-x-0 bottom-[12px] font-display text-[19px]" style={{ color: 'rgba(22,38,63,.75)' }}>גארדה <bdi dir="ltr">2026</bdi></span>
          </button>

          <div className="j-rise mt-9 text-[15px] font-bold" style={{ color: P.red, animationDelay: '.2s' }}>סרט משפחתי · <bdi dir="ltr">27.9 – 4.10</bdi></div>
          <h1 className="j-rise mt-1 font-display text-[40px] leading-[1.12] [text-wrap:balance]" style={{ animationDelay: '.3s' }}>הכנו לכם סרטון</h1>
          <p className="j-rise mt-2 max-w-[320px] text-[17px] leading-[1.55]" style={{ color: 'rgba(22,38,63,.72)', animationDelay: '.4s' }}>
            כל הטיול, מההמראה ועד התמונה המשותפת. תגבירו סאונד ותיהנו.
          </p>

          {faces.length > 0 && (
            <div className="j-rise mt-5 flex items-center gap-2" style={{ animationDelay: '.5s' }}>
              <div className="flex" dir="ltr">
                {faces.slice(0, 7).map((u, i) => (
                  <img key={i} src={u} alt="" className="h-8 w-8 rounded-full object-cover" style={{ marginLeft: i ? -9 : 0, boxShadow: `0 0 0 2.5px ${P.paper}` }} />
                ))}
              </div>
              <span className="text-[14px] font-semibold" style={{ color: 'rgba(22,38,63,.7)' }}>כל המשפחה בפנים</span>
            </div>
          )}

          <button className="j-rise mt-7 flex min-h-[58px] w-full items-center justify-center gap-2.5 rounded-2xl text-[19px] font-bold" onClick={onPlay}
            style={{ background: P.red, color: '#fff', boxShadow: '0 14px 30px -12px rgba(211,72,56,.7)', animationDelay: '.6s' }}>
            <Play size={20} className="fill-white" /> לצפייה בסרט
          </button>
          <p className="j-rise mt-3 text-[14px]" style={{ color: 'rgba(22,38,63,.55)', animationDelay: '.7s' }}>אחרי הסרט מחכה לכם האלבום המלא</p>
          {started && <button className="mt-1 min-h-[44px] px-3 text-[14px] font-semibold underline" style={{ color: 'rgba(22,38,63,.6)' }} onClick={onSkip}>כבר ראיתי, לאלבום</button>}
        </div>
      </div>
    )
  }
  return (
    <div className="fixed inset-0 z-[65] flex flex-col bg-bg" dir="rtl">
      <header className="relative shrink-0 border-b border-line pt-safe" style={{ background: `linear-gradient(#F6DDB8, ${P.paper})`, color: P.ink }}>
        {onApp && <button className="absolute end-3 top-[calc(var(--safe-top)+8px)] min-h-[36px] rounded-full px-3 text-[13px] font-semibold" style={{ background: 'rgba(22,38,63,.08)' }} onClick={onApp}>לאפליקציה</button>}
        <div className="flex items-end gap-3 px-4 pb-4 pt-10">
          <button className="w-[62px] shrink-0 rounded-[4px] p-[4px] pb-[10px]" onClick={onPlay} aria-label="לצפייה בסרט" style={{ background: P.white, rotate: '-4deg', boxShadow: '0 10px 20px -10px rgba(22,38,63,.5)' }}>
            <img src={cover} alt="" className="aspect-[4/5] w-full rounded-[2px] object-cover" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-[28px] leading-[1.15]">טואטי <span style={{ color: P.blue }}>בגארדה</span></h1>
            <div className="text-[15px]" style={{ color: 'rgba(22,38,63,.7)' }}>האלבום המלא של הטיול</div>
          </div>
          <button className="flex min-h-[44px] shrink-0 items-center gap-2 rounded-full px-4 text-[15px] font-bold" style={{ background: P.red, color: '#fff' }} onClick={onPlay}>
            <Clapperboard size={18} /> הסרט
          </button>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto overscroll-contain pb-safe pt-3">{album}</div>
    </div>
  )
}
