import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import './index.css'
import { captureOpen } from './lib/deeplink'
import { captureShare } from './lib/mapsLink'

captureShare()
captureOpen()

// בודקים גרסה חדשה כל דקה וכשחוזרים לאפליקציה, כדי שכולם יקבלו עדכונים מהר
registerSW({
  immediate: true,
  onRegisteredSW(_url, r) {
    if (!r) return
    const check = () => { if (navigator.onLine) void r.update().catch(() => {}) }
    setInterval(check, 60_000)
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check() })
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
