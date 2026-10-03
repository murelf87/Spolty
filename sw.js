const CACHE = "spotly-movil-v1";
const BASE = new URL("./", self.location).href;
const SHELL = ["./", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./favicon.png"].map((p) => new URL(p, BASE).href);
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || !req.url.startsWith(BASE) || req.headers.has("range")) return;
  e.respondWith(fetch(req).then((res) => {
    if (res.status === 200) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => undefined); }
    return res;
  }).catch(() => caches.match(req).then((r) => r || caches.match(BASE))));
});
