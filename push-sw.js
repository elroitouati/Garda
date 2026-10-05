// Web Push: מוצג גם כשהאפליקציה סגורה
self.addEventListener('push', (event) => {
  let d = {}
  try { d = event.data ? event.data.json() : {} } catch { d = { body: event.data && event.data.text() } }
  event.waitUntil(self.registration.showNotification(d.title || 'טואטי בגארדה', {
    body: d.body || '',
    tag: d.tag,
    renotify: true,
    requireInteraction: !!d.important,
    icon: 'pwa-192.png',
    badge: 'pwa-192.png',
    dir: 'rtl',
    lang: 'he',
    vibrate: d.important ? [300, 120, 300, 120, 600] : [100],
    data: { url: d.url || './' },
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || './'
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) if ('focus' in c) { c.postMessage({ type: 'garda-open', url }); return c.focus() }
    return self.clients.openWindow(url)
  }))
})
