const CACHE = "kangu-test-appareils-v2";
const FICHIERS = [
  "./",
  "./index.html",
  "./app.js",
  "./manifest.webmanifest",
  "./icon.svg",
  "./icon-192.png",
  "./icon-512.png",
];

self.addEventListener("install", (evenement) => {
  evenement.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(FICHIERS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (evenement) => {
  evenement.waitUntil(
    caches.keys().then((noms) =>
      Promise.all(noms.filter((n) => n !== CACHE).map((n) => caches.delete(n)))
    ),
  );
  self.clients.claim();
});

// Cache d'abord : nécessaire pour que la page reste utilisable quand le réseau est coupé pendant le test.
self.addEventListener("fetch", (evenement) => {
  evenement.respondWith(
    caches.match(evenement.request).then((reponse) => reponse || fetch(evenement.request)),
  );
});
