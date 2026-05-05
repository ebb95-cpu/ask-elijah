self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = {}
  }

  const title = data.title || 'Ask Elijah'
  const options = {
    body: data.body || 'Elijah has something for you.',
    icon: '/logo-email.png',
    badge: '/logo-email.png',
    tag: data.tag || 'ask-elijah',
    data: { url: data.url || '/history' },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/history'
  event.waitUntil(clients.openWindow(url))
})
