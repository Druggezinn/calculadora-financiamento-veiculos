const CACHE_NAME = "autofin-shell-v2";
const CORE_URLS = [
  "/",
  "/manifest.webmanifest",
  "/manus-storage/autofin-180_c359514d.png",
  "/manus-storage/autofin-192_0fc769aa.png",
  "/manus-storage/autofin-512_ea62cbb7.png",
];

async function generatedAssets() {
  const response = await fetch("/", { cache: "no-store" });
  const documentText = await response.text();
  const assetPaths = [...documentText.matchAll(/(?:src|href)="([^"?]+\/assets\/[^"?]+\.(?:js|css))[^\"]*"/g)]
    .map(match => new URL(match[1], self.location.origin).pathname)
    .filter(path => path.startsWith("/assets/"));
  return [...new Set([...CORE_URLS, ...assetPaths])];
}

self.addEventListener("install", event => {
  event.waitUntil(
    generatedAssets()
      .then(urls => caches.open(CACHE_NAME).then(cache => cache.addAll(urls)))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  const cacheResponse = response => {
    if (response.ok) {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
    }
    return response;
  };

  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).then(cacheResponse).catch(() => caches.match("/")));
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      const networkFetch = fetch(event.request)
        .then(cacheResponse)
        .catch(() => cached ?? caches.match("/"));

      return cached ?? networkFetch;
    }),
  );
});
