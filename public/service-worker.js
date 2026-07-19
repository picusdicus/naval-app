const CACHE_NAME = 'vecinal-v2'
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/src/main.jsx',
  '/src/index.css',
  '/logo.png',
  '/favicon.svg',
]

// Instalar service worker y cachear assets estáticos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // Algunos assets pueden fallar (ej: JS bundles que cambian en dev)
        // pero continuamos con la instalación
      })
    }),
  )
  self.skipWaiting()
})

// Activar service worker y limpiar caches antiguos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName)
          }
        }),
      )
    }),
  )
  self.clients.claim()
})

// Estrategia de fetch: Network first, fallback a cache, luego offline page
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Solo manejar requests del mismo origin
  if (url.origin !== self.location.origin) {
    return
  }

  // La API nunca se cachea: son datos vivos (eventos del panel, agenda
  // pública, sesión...). Cachearlos haría que el gestor publicase un evento y
  // siguiera viendo la lista anterior. Va directa a la red.
  if (url.pathname.startsWith('/api/')) {
    return
  }

  // Solo se cachean lecturas: un POST/PUT/DELETE nunca debe salir de la caché.
  if (request.method !== 'GET') {
    return
  }

  // Para HTML: network first
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache la respuesta exitosa
          if (response.ok) {
            const responseClone = response.clone()
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone)
            })
          }
          return response
        })
        .catch(() => {
          // Si falla, intentar cache
          return caches
            .match(request)
            .then((cachedResponse) => {
              return cachedResponse
            })
            .catch(() => {
              // Si no está en cache, mostrar offline page
              return caches.match('/offline.html')
            })
        }),
    )
    return
  }

  // Para otros assets: cache first, fallback a network
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse
      }
      return fetch(request).then((response) => {
        if (response.ok) {
          const responseClone = response.clone()
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone)
          })
        }
        return response
      })
    }),
  )
})

// Notificaciones push (digest diario de eventos). El payload lo construye
// api/_push-send.js: { titulo, cuerpo, icono, url }.
self.addEventListener('push', (event) => {
  let datos = {}
  try {
    datos = event.data ? event.data.json() : {}
  } catch {
    // Payload no-JSON: se muestra la notificación genérica.
  }
  event.waitUntil(
    self.registration.showNotification(datos.titulo || 'En Navalcarnero', {
      body: datos.cuerpo || 'Hay novedades en la agenda de eventos.',
      icon: datos.icono || '/logo.png',
      badge: '/logo.png',
      data: { url: datos.url || '/eventos' },
    }),
  )
})

// Al tocar la notificación: enfocar una pestaña abierta de la app (navegándola
// a la URL del evento) o abrir una nueva.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/eventos'
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((ventanas) => {
        for (const ventana of ventanas) {
          if (new URL(ventana.url).origin === self.location.origin && 'focus' in ventana) {
            if ('navigate' in ventana) ventana.navigate(url)
            return ventana.focus()
          }
        }
        return self.clients.openWindow(url)
      }),
  )
})
