const SW_VERSION = "offline-tiles-v1";
const SHELL_CACHE = `geosafe-shell-${SW_VERSION}`;
const PUBLIC_CACHE = `geosafe-public-${SW_VERSION}`;
// GS-033: map base-tile cache. Versionless name so it survives SW upgrades
// (large, expensive to rebuild). Pre-cached areas + on-demand tiles live here.
const TILE_CACHE = "geosafe-tiles";
const MAX_TILES = 2000; // storage budget — LRU-trimmed (~ a city at z12–16)
const OFFLINE_URL = "/offline.html";

const APP_SHELL_URLS = [
  "/",
  "/index.html",
  OFFLINE_URL,
  "/manifest.json",
  "/icons/icon-192.svg",
  "/icons/icon-512.svg",
];

const SAME_ORIGIN_PUBLIC_API_ALLOWLIST = new Set([
  "/api/v1/warehouses",
  "/api/v1/safe-zones",
  "/api/v1/earthquakes",
  "/health",
]);

const DENYLIST_PATH_PARTS = [
  "/admin",
  "/api/v1/auth",
  "/api/v1/profile",
  "/api/v1/volunteers",
  "/api/v1/shelter-offers",
  "/api/v1/emergency",
  "/api/v1/inventory",
];

function hasAuthorizationHeader(request) {
  return Boolean(request.headers.get("authorization"));
}

function isDeniedPath(pathname) {
  return DENYLIST_PATH_PARTS.some((part) => pathname.includes(part));
}

function isCacheableStaticRequest(request, url) {
  if (url.origin !== self.location.origin) {
    return false;
  }

  if (request.mode === "navigate") {
    return !isDeniedPath(url.pathname);
  }

  return ["style", "script", "image", "font"].includes(request.destination);
}

function isCacheablePublicApiRequest(request, url) {
  if (url.origin !== self.location.origin) {
    return false;
  }

  if (hasAuthorizationHeader(request)) {
    return false;
  }

  if (isDeniedPath(url.pathname)) {
    return false;
  }

  return SAME_ORIGIN_PUBLIC_API_ALLOWLIST.has(url.pathname);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => ![SHELL_CACHE, PUBLIC_CACHE, TILE_CACHE].includes(key))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

async function networkThenCache(request, cacheName) {
  const response = await fetch(request);
  if (response && response.ok) {
    const cache = await caches.open(cacheName);
    await cache.put(request, response.clone());
  }
  return response;
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }
  return networkThenCache(request, cacheName);
}

// ── Offline map tiles (GS-033) ──────────────────────────────────────────────

// OpenStreetMap raster tile hosts (a/b/c.tile.openstreetmap.org).
function isMapTileRequest(url) {
  return /(^|\.)tile\.openstreetmap\.org$/.test(url.hostname);
}

// Leaflet rotates a/b/c subdomains, but the tile bytes are identical. Cache under
// a single canonical host so a tile fetched as `a.tile…` also satisfies `b.tile…`.
function canonicalTileKey(tileUrl) {
  return tileUrl.replace(/https:\/\/[abc]\.tile\.openstreetmap\.org/, "https://tile.openstreetmap.org");
}

// FIFO/LRU trim: Cache API keys() preserves insertion order, so deleting from
// the front evicts the oldest entries once the budget is exceeded.
async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  const removeCount = keys.length - maxEntries;
  for (let i = 0; i < removeCount; i++) {
    await cache.delete(keys[i]);
  }
}

// Cache-first for tiles so a pre-cached area keeps working with no signal.
// On a miss we fetch, store, and trim to the budget. Offline + uncached → fail
// gracefully (Leaflet shows a blank tile rather than throwing).
async function tileCacheFirst(request) {
  const key = canonicalTileKey(request.url);
  const cache = await caches.open(TILE_CACHE);
  const cached = await cache.match(key);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response && (response.ok || response.type === "opaque")) {
      await cache.put(key, response.clone());
      trimCache(TILE_CACHE, MAX_TILES);
    }
    return response;
  } catch (_) {
    return new Response("", { status: 504, statusText: "Tile unavailable offline" });
  }
}

// ── Web Push (GS-021) ─────────────────────────────────────────────────────────

self.addEventListener("push", (event) => {
  let payload = { title: "GeoSafe", body: "Yeni bildirim", url: "/", tag: "geosafe-alert" };
  try {
    if (event.data) {
      payload = { ...payload, ...JSON.parse(event.data.text()) };
    }
  } catch (_) {}

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icons/icon-192.svg",
      badge: "/icons/icon-192.svg",
      tag: payload.tag,
      data: { url: payload.url },
      requireInteraction: true,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});

// ── Offline tile pre-caching messages (GS-033) ──────────────────────────────
//
// The page computes tile URLs for a chosen area and posts them here in batches.
// The SW fetches+stores them (respecting MAX_TILES) and reports progress back so
// the UI can show a download bar. Cache info + clear are handled here too, so the
// SW remains the single owner of the tile cache.

async function precacheTiles(urls, port) {
  const cache = await caches.open(TILE_CACHE);
  let done = 0;
  let cached = 0;
  for (const tileUrl of urls) {
    const key = canonicalTileKey(tileUrl);
    try {
      const match = await cache.match(key);
      if (!match) {
        const res = await fetch(key, { mode: "cors" });
        if (res && (res.ok || res.type === "opaque")) {
          await cache.put(key, res.clone());
          cached++;
        }
      }
    } catch (_) {
      // skip unreachable tile; keep going
    }
    done++;
    if (port && (done % 10 === 0 || done === urls.length)) {
      port.postMessage({ type: "tile-precache-progress", done, total: urls.length, cached });
    }
  }
  await trimCache(TILE_CACHE, MAX_TILES);
  if (port) port.postMessage({ type: "tile-precache-done", done, total: urls.length, cached });
}

async function reportTileCacheInfo(port) {
  if (!port) return;
  const cache = await caches.open(TILE_CACHE);
  const keys = await cache.keys();
  let estimateBytes = null;
  try {
    if (self.navigator && navigator.storage && navigator.storage.estimate) {
      const est = await navigator.storage.estimate();
      estimateBytes = est.usage || null;
    }
  } catch (_) {}
  port.postMessage({ type: "tile-cache-info", count: keys.length, max: MAX_TILES, estimateBytes });
}

async function clearTileCache(port) {
  await caches.delete(TILE_CACHE);
  if (port) port.postMessage({ type: "tile-cache-cleared" });
}

self.addEventListener("message", (event) => {
  const data = event.data || {};
  const port = event.ports && event.ports[0];
  if (data.type === "precache-tiles" && Array.isArray(data.urls)) {
    event.waitUntil(precacheTiles(data.urls, port));
  } else if (data.type === "tile-cache-info") {
    event.waitUntil(reportTileCacheInfo(port));
  } else if (data.type === "clear-tile-cache") {
    event.waitUntil(clearTileCache(port));
  }
});

// ── Fetch ─────────────────────────────────────────────────────────────────────

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  if (hasAuthorizationHeader(request)) {
    return;
  }

  const url = new URL(request.url);

  // GS-033: serve map tiles cache-first (works offline once an area is cached).
  if (isMapTileRequest(url)) {
    event.respondWith(tileCacheFirst(request));
    return;
  }

  if (isDeniedPath(url.pathname)) {
    return;
  }

  if (request.mode === "navigate" && isCacheableStaticRequest(request, url)) {
    event.respondWith(
      fetch(request).catch(async () => {
        const cachedPage = await caches.match(request);
        return cachedPage || caches.match(OFFLINE_URL);
      })
    );
    return;
  }

  if (isCacheableStaticRequest(request, url)) {
    event.respondWith(cacheFirst(request, SHELL_CACHE));
    return;
  }

  if (isCacheablePublicApiRequest(request, url)) {
    event.respondWith(
      networkThenCache(request, PUBLIC_CACHE).catch(async () => {
        const cached = await caches.match(request);
        return cached || Response.error();
      })
    );
  }
});
