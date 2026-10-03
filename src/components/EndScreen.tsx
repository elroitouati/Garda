import { Clapperboard, Play } from 'lucide-react'
import type { ReactNode } from 'react'

const P = { ink: '#16263F', paper: '#FAF5EA', red: '#D34838', lemon: '#F2C230' }
const poster = `${import.meta.env.BASE_URL}journey/intro-poster.jpg`

/** מסך הסיום של הטיול: קודם הסרט, ואחריו האלבום המלא */
export function EndScreen({ watched, started, onPlay, onSkip, album, onApp }: {
  watched: boolean; started: boolean; onPlay: () => void; onSkip: () => void; album: ReactNode; onApp?: () => void
}) {
  if (!watched) {
    return (
      <div className="journey fixed inset-0 z-[65] overflow-hidden" style={{ background: P.ink, color: P.paper }} dir="rtl">
        <img src={poster} alt="" className="j-kenburns absolute inset-0 h-full w-full object-cover opacity-60" />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(22,38,63,.97) 30%, rgba(22,38,63,.35) 70%, rgba(22,38,63,.6))' }} />
        {onApp && <button className="absolute end-3 top-[calc(var(--safe-top)+10px)] z-10 min-h-[40px] rounded-full px-4 text-[14px] font-semibold" style={{ background: 'rgba(250,245,234,.16)' }} onClick={onApp}>לאפליקציה (מנהלים)</button>}
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center px-6 pb-[calc(var(--safe-bottom)+40px)] text-center">
          <div className="j-rise text-[15px] font-bold" style={{ color: P.lemon }}>טואטי בגארדה · <bdi dir="ltr">27.9 – 4.10.2026</bdi></div>
          <h1 className="j-rise mt-2 font-display text-[44px] leading-[1.1] [text-wrap:balance]" style={{ animationDelay: '.15s' }}>הכנו לכם סרטון 🎬</h1>
          <p className="j-rise mt-3 max-w-[340px] text-[18px] leading-[1.55] opacity-90" style={{ animationDelay: '.3s' }}>כל הטיול, מההמראה ועד התמונה המשותפת. תגבירו סאונד ותיהנו.</p>
          <button className="j-pop mt-8 flex min-h-[64px] w-full max-w-[340px] items-center justify-center gap-3 rounded-full text-[20px] font-bold shadow-float" style={{ background: P.red, color: '#fff', animationDelay: '.5s' }} onClick={onPlay}>
            <Play size={24} className="fill-white" /> לצפייה בסרט
          </button>
          <p className="j-rise mt-4 text-[14px] opacity-70" style={{ animationDelay: '.7s' }}>אחרי הסרט מחכה לכם האלבום המלא 📸</p>
          {started && <button className="mt-2 min-h-[44px] px-3 text-[14px] font-semibold underline opacity-70" onClick={onSkip}>כבר ראיתי, לאלבום</button>}
        </div>
      </div>
    )
  }
  return (
    <div className="fixed inset-0 z-[65] flex flex-col bg-bg" dir="rtl">
      <header className="relative shrink-0 overflow-hidden pt-safe" style={{ background: P.ink, color: P.paper }}>
        <img src={poster} alt="" className="absolute inset-0 h-full w-full object-cover opacity-35" style={{ objectPosition: '50% 35%' }} />
        <div className="relative flex items-end gap-3 px-4 pb-4 pt-6">
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-bold" style={{ color: P.lemon }}><bdi dir="ltr">27.9 – 4.10.2026</bdi></div>
            <h1 className="font-display text-[30px] leading-[1.15]">טואטי בגארדה</h1>
            <div className="text-[15px] opacity-85">האלבום המלא של הטיול</div>
          </div>
          <button className="flex min-h-[44px] shrink-0 items-center gap-2 rounded-full px-4 text-[15px] font-bold" style={{ background: P.red, color: '#fff' }} onClick={onPlay}>
            <Clapperboard size={18} /> הסרט
          </button>
        </div>
        {onApp && <button className="absolute end-3 top-[calc(var(--safe-top)+8px)] min-h-[36px] rounded-full px-3 text-[13px] font-semibold" style={{ background: 'rgba(250,245,234,.16)' }} onClick={onApp}>לאפליקציה</button>}
      </header>
      <div className="flex-1 overflow-y-auto overscroll-contain pb-safe pt-3">{album}</div>
    </div>
  )
}
