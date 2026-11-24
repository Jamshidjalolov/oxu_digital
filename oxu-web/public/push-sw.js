function safeLocalUrl(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u0020\u007f]|%5c|%0[0-9a-f]|%7f/i.test(value)) return '/'
  try {
    const url = new URL(value, self.location.origin)
    if (url.origin !== self.location.origin || url.pathname.startsWith('//')) return '/'
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return '/'
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data?.json() || {}
  } catch {
    payload = {}
  }
  const notificationId = typeof payload.notificationId === 'string' ? payload.notificationId : null
  event.waitUntil(self.registration.showNotification(typeof payload.title === 'string' ? payload.title : 'OXU Digital', {
    body: typeof payload.body === 'string' ? payload.body : '',
    icon: '/oxu-logo.png',
    ...(notificationId ? { tag: `oxu-${notificationId}` } : {}),
    data: { url: safeLocalUrl(payload.url), notificationId },
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL(safeLocalUrl(event.notification.data?.url), self.location.origin)
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const localWindows = windows.filter((client) => {
      try { return new URL(client.url).origin === self.location.origin } catch { return false }
    })
    const exact = localWindows.find((client) => client.url === url.href)
    if (exact) {
      await exact.focus()
      return
    }
    for (const client of localWindows) {
      try {
        const navigated = await client.navigate(url.href)
        if (navigated) {
          await navigated.focus()
          return
        }
      } catch {
        continue
      }
    }
    await self.clients.openWindow(url.href)
  })())
})
