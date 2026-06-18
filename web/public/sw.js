self.addEventListener('push', (event) => {
  if (!event.data) return
  let payload
  try { payload = event.data.json() } catch { payload = { title: 'Notification', body: event.data.text() } }

  const { title, body, url, tag } = payload
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag: tag ?? 'elv-notification',
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      data: { url: url ?? '/' },
      requireInteraction: true,
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      return clients.openWindow(url)
    })
  )
})
