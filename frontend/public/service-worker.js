const SW_VERSION = "login-timeout-v1";
const SHELL_CACHE = `geosafe-shell-${SW_VERSION}`;
const PUBLIC_CACHE = `geosafe-public-${SW_VERSION}`;
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
            .filter((key) => ![SHELL_CACHE, PUBLIC_CACHE].includes(key))
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

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  if (hasAuthorizationHeader(request)) {
    return;
  }

  const url = new URL(request.url);

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
