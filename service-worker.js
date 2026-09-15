const CACHE_NAME = "neo-school-india-v2";

const APP_SHELL = [
  "/",
  "/index.html",
  "/manifest.json",
  "/neo-icon-192.png",
  "/neo-icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(APP_SHELL);
    })
  );

  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key.startsWith("neo-school-india-") && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      );
    })
  );

  self.clients.claim();
});

self.addEventListener("fetch", event => {

  if (event.request.method !== "GET") {
    return;
  }

  const url = new URL(event.request.url);
  // CRM responses and admin pages must never enter the offline cache.
  if (url.origin !== self.location.origin || !APP_SHELL.includes(url.pathname)) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {

        const copy = response.clone();

        if (response.ok) caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, copy);
        });

        return response;
      })
      .catch(() => {
        return caches.match(event.request)
          .then(cachedResponse => {
            return cachedResponse || (event.request.mode === "navigate" ? caches.match("/index.html") : Response.error());
          });
      })
  );

});
