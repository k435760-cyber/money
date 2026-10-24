// Only public application files are cached. Auth, API responses and personal
// ledger data never enter Cache Storage. Guest data stays in its existing store.
const CACHE = __CACHE_NAME__;
const FILES = __PRECACHE_FILES__;
const ROOT = new URL("./", self.location.href).pathname;
const paths = new Set(
  FILES.map((file) => new URL(file, self.location.href).pathname),
);

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key.startsWith("hanpun-shell-") && key !== CACHE)
          await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});
self.addEventListener("message", (event) => {
  if (event.data?.type === "ACTIVATE_UPDATE") self.skipWaiting();
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  const authRequest =
    url.pathname.startsWith(`${ROOT}auth/`) ||
    url.searchParams.has("code") ||
    url.searchParams.has("error_description");
  if (authRequest) {
    if (request.mode === "navigate")
      event.respondWith(
        (async () => {
          try {
            return await fetch(request);
          } catch {
            return (
              (await caches.match(`${ROOT}offline.html`)) || Response.error()
            );
          }
        })(),
      );
    return;
  }
  if (
    request.mode === "navigate" &&
    [ROOT, `${ROOT}index.html`].includes(url.pathname)
  ) {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          if (response.ok) return response;
        } catch {
          /* An installed guest ledger remains usable offline. */
        }
        return (await caches.match(`${ROOT}index.html`)) || Response.error();
      })(),
    );
    return;
  }
  if (paths.has(url.pathname) && url.pathname !== `${ROOT}index.html`) {
    event.respondWith(
      (async () => (await caches.match(url.pathname)) || fetch(request))(),
    );
  }
});
