/**
 * Fleet Control Service Worker
 *
 * v2 — Cache-busting version bump. Bump this string on every deploy
 *      to force old PWA caches to be evicted (fixes stale iOS Safari).
 *
 * Strategy:
 *   • /api/*       → network only (never cached)
 *   • HTML pages   → network-first, fallback to cache (offline)
 *   • .js / .css   → network-first with cache fallback (new deploys arrive instantly)
 *   • Immutable    → cache-first (icons, manifest, fonts — rarely change)
 */
const CACHE = "fleet-control-v2"; // ← bump on every deploy
const IMMUTABLE_ASSETS = [
  "/icon-192.png",
  "/icon-512.png",
  "/manifest.webmanifest",
];

// ---------------------------------------------------------------------------
// Install — seed the immutable cache, then activate immediately
// ---------------------------------------------------------------------------
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.allSettled(
        IMMUTABLE_ASSETS.map((url) =>
          cache.add(url).catch(() => console.warn(`[SW] Failed to cache ${url}`))
        )
      )
    )
  );
  self.skipWaiting();
});

// ---------------------------------------------------------------------------
// Activate — delete every cache that doesn't match the current CACHE name
// ---------------------------------------------------------------------------
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
  );
  self.clients.claim();
});

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET over HTTP(S)
  if (request.method !== "GET" || !url.protocol.startsWith("http")) return;

  // 1) API calls — network only, never cached
  if (url.pathname.startsWith("/api/")) return;

  // 2) Immutable assets (icons, manifest) — cache-first
  if (
    url.pathname.match(/\.(png|ico|webmanifest)$/) ||
    IMMUTABLE_ASSETS.includes(url.pathname)
  ) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request))
    );
    return;
  }

  // 3) JS / CSS — network-first so new deploys are picked up immediately
  //    Falls back to cache when offline.
  if (url.pathname.match(/\.(js|css|woff2?)$/)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // 4) HTML pages & everything else — network-first, fallback to cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE).then((cache) => cache.put(request, clone));
        return response;
      })
      .catch(() =>
        caches.match(request).then((cached) => cached || new Response("Offline", { status: 503 }))
      )
  );
});

// ---------------------------------------------------------------------------
// Push notifications
// ---------------------------------------------------------------------------
self.addEventListener("push", (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    self.registration.showNotification(data.title || "Fleet Control", {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: data.url ? { url: data.url } : undefined,
    });
  } catch {
    // Ignore malformed push payloads
  }
});

// Notification click: open / focus the app
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || "/";
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientsList) => {
        const matchingClient = clientsList.find((c) => c.url === urlToOpen);
        if (matchingClient) return matchingClient.focus();
        return clients.openWindow(urlToOpen);
      })
  );
});
