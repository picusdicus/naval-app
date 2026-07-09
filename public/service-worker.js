const CACHE_NAME = 'vecinal-v1'
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
