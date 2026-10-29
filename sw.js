/* 浮根警報 · 離線快取：第一次開啟後，比賽現場沒網路也能展示 */
const CACHE = "rootalert-202610292206";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./main.js",
  "./manifest.json",
  "./fonts/bebas-neue.woff2",
  "./fonts/ra-sans-500.woff2",
  "./fonts/ra-sans-700.woff2",
  "./fonts/ra-sans-900.woff2",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./img/app_icon.webp",
  "./img/heart.webp",
  "./img/home.webp",
  "./img/icon1.webp",
  "./img/icon2.webp",
  "./img/mascot_bow.webp",
  "./img/mascot_hug.webp",
  "./img/mascot_peek.webp",
  "./img/mascot_wow.webp"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request).catch(() => caches.match("./index.html")))
  );
});
