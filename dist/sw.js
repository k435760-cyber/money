// Only public application files are cached. Auth, API responses and personal
// ledger data never enter Cache Storage. Guest data stays in its existing store.
const CACHE = "hanpun-shell-6d2a849ff41baab4";
const FILES = ["index.html","offline.html","offline.css","favicon.svg","ai-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon-maskable-512.png","icons/apple-touch-icon.png","assets/AgeModal-7J03O9c0.js","assets/Assistant-DpQ33aFF.js","assets/Budget-CHBZjg0M.js","assets/Calendar-DBnaud4S.js","assets/Ledger-Bw4Qwgb0.js","assets/Modal-Bn8N0Dj7.js","assets/PrivacyPolicy-eorSnZyD.js","assets/assistant-C6yDRq_t.js","assets/book-B_aJ0-Dy.js","assets/index-BZVhgLhI.js","assets/index-DOWF1AJt.css","assets/jsx-runtime-IzPD2q5l.js"];
const ROOT = new URL("./", self.location.href).pathname;
const paths = new Set(
  FILES.map((file) => new URL(file, self.location.href).pathname),
);

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(FILES);
    // Cloudflare canonicalizes /index.html to / and /offline.html to /offline.
    // Navigation requests cannot consume a cached redirected response. Store
    // an ordinary same-origin response while retaining its security headers.
    for (const file of FILES) {
      const response = await cache.match(file);
      if (response?.redirected) await cache.put(file, new Response(response.body, {
        status: response.status, statusText: response.statusText, headers: response.headers,
      }));
    }
  })());
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
