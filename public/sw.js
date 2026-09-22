/* 最小SW: アプリシェルのオフラインキャッシュ */
const CACHE = "mmd-viewer-v1";
const ASSETS = ["./", "index.html", "manifest.webmanifest"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(clients.claim());
});
self.addEventListener("fetch", (e) => {
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request)));
});
