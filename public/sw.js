/* ME-CONNECT service worker: makes the app installable and keeps the app shell available offline.
   It never touches the API: only this site's own files and the Google Fonts are handled, so people
   never see stale or someone else's data. `__BUILD_ID__` is replaced with the build time on every
   `npm run build` (see vite.config.ts), which gives each deploy its own cache; the old one is deleted
   when the new worker takes over. */
const CACHE = 'me-connect-__BUILD_ID__'
const SHELL = ['/', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png']

self.addEventListener('install', (event) => {
  /* skipWaiting: a new version takes over as soon as it is downloaded, so nobody is stuck on an old build */
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

const keepable = (response) => response && (response.ok || response.type === 'opaque')

/* Pages: the network first, so a new deploy shows straight away; the saved shell when there is no network. */
async function page(request) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(CACHE)
      cache.put('/', response.clone())
    }
    return response
  } catch {
    return (await caches.match('/')) || new Response('You are offline.', { status: 503, headers: { 'Content-Type': 'text/plain' } })
  }
}

/* Built files have a hash in their name and never change: take them from the cache when there. */
async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (keepable(response)) (await caches.open(CACHE)).put(request, response.clone())
  return response
}

/* Everything else (icons, fonts): show what is saved and refresh it in the background. */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE)
  const cached = await cache.match(request)
  const fresh = fetch(request)
    .then((response) => {
      if (keepable(response)) cache.put(request, response.clone())
      return response
    })
    .catch(() => cached)
  return cached || fresh
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  const own = url.origin === self.location.origin
  const fonts = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com'
  /* the backend (another origin, or /api on this one) is never cached */
  if ((!own && !fonts) || (own && url.pathname.startsWith('/api/'))) return
  /* OneSignal has its OWN worker on its own scope (/push/onesignal/); leave those files to it. */
  if (own && url.pathname.startsWith('/push/')) return

  if (request.mode === 'navigate') return event.respondWith(page(request))
  if (own && url.pathname.startsWith('/assets/')) return event.respondWith(cacheFirst(request))
  event.respondWith(staleWhileRevalidate(request))
})
