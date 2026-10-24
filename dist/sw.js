// Only public application files are cached. Auth, API responses and personal
// ledger data never enter Cache Storage. Guest data stays in its existing store.
const CACHE = "hanpun-shell-f205b40f93a58fba";
const FILES = ["index.html","offline.html","offline.css","favicon.svg","ai-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon-maskable-512.png","icons/apple-touch-icon.png","assets/AgeModal-59972aku.js","assets/Assistant-CFdUxgBf.js","assets/Budget-DIJx9myU.js","assets/Calendar-BS-pytVj.js","assets/Ledger-CSy9RaiK.js","assets/Modal-CwB4xJM6.js","assets/PrivacyPolicy-eorSnZyD.js","assets/assistant-DbOdZt7m.js","assets/book-CsNzRyzp.js","assets/index-CuVHv1r9.css","assets/index-DibFGbgL.js","assets/jsx-runtime-IzPD2q5l.js"];
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
