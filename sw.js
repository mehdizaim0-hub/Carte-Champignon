/* Service worker : la carte reste utilisable hors-ligne (dernières données et tuiles déjà vues).
   - Fichiers du site : réseau d'abord, cache en secours (les données du bot restent fraîches).
   - Leaflet, polices : cache d'abord, rafraîchi en arrière-plan.
   - Tuiles de fond de carte : cache d'abord, plafonné.
   - API météo / GBIF / Wikipédia : jamais interceptées. */
const V = "v2";
const SHELL = "shell-" + V, LIBS = "libs-" + V, TILES = "tiles-" + V;
const TILE_MAX = 600;
const PRECACHE = ["./", "index.html", "style.css", "species.js", "app.js", "manifest.webmanifest", "icon-192.png", "icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => ![SHELL, LIBS, TILES].includes(k)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(req, name) {
  const c = await caches.open(name);
  try {
    const r = await fetch(req);
    if (r.ok) c.put(req, r.clone());
    return r;
  } catch (err) {
    const hit = await c.match(req, { ignoreSearch: true });
    if (hit) return hit;
    throw err;
  }
}

async function swr(req, name) {
  const c = await caches.open(name);
  const hit = await c.match(req);
  const net = fetch(req).then(r => { if (r.ok || r.type === "opaque") c.put(req, r.clone()); return r; }).catch(() => hit);
  return hit || net;
}

async function tile(req) {
  const c = await caches.open(TILES);
  const hit = await c.match(req);
  if (hit) return hit;
  const r = await fetch(req);
  if (r.ok || r.type === "opaque") {
    c.put(req, r.clone());
    c.keys().then(ks => { if (ks.length > TILE_MAX) ks.slice(0, ks.length - TILE_MAX).forEach(k => c.delete(k)); });
  }
  return r;
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const u = new URL(req.url);
  if (u.origin === location.origin) {
    e.respondWith(networkFirst(req, SHELL));
  } else if (/(^|\.)tile\.openstreetmap\.org$|\.opentopomap\.org$/.test(u.hostname)) {
    e.respondWith(tile(req));
  } else if (/^(unpkg\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)$/.test(u.hostname)) {
    e.respondWith(swr(req, LIBS));
  }
});
