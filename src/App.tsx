import { ToastProvider } from './components/Toast'
import { StoreProvider, useStore } from './lib/store'
import { MainScreen } from './screens/MainScreen'
import { PinScreen } from './screens/PinScreen'
import { SetupNeeded } from './screens/SetupNeeded'

function Router() {
  const { phase } = useStore()
  if (phase === 'unconfigured') return <SetupNeeded />
  if (phase === 'pin') return <PinScreen />
  if (phase === 'ready') return <MainScreen />
  return (
    <div className="grid h-full place-items-center bg-bg" aria-busy="true">
      <img src="/favicon.svg" alt="טואטי בגארדה" className="h-20 w-20 animate-pulse rounded-[22px]" />
    </div>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <StoreProvider>
        <Router />
      </StoreProvider>
    </ToastProvider>
  )
}
