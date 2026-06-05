/**
 * GS-033: Offline evacuation base-map — tile pre-caching helper.
 *
 * Computes the OpenStreetMap tile coordinates covering a lat/lon bounding box
 * across a zoom range, then asks the service worker to fetch + store them in the
 * `geosafe-tiles` cache. The SW owns the cache (single writer) and reports
 * progress / size / clears back over a MessageChannel.
 *
 * Tiles are served cache-first by the SW, so a pre-cached area keeps rendering
 * with no network — critical when navigating to a safe zone during an outage.
 */

export interface LatLngBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface PrecacheProgress {
  done: number;
  total: number;
  cached: number;
}

export interface TileCacheInfo {
  count: number;
  max: number;
  estimateBytes: number | null;
}

const TILE_HOST = "https://tile.openstreetmap.org";
// Hard cap so a careless big-area request can't try to cache a million tiles.
const MAX_PLANNED_TILES = 2000;

function lonToTileX(lon: number, z: number): number {
  return Math.floor(((lon + 180) / 360) * 2 ** z);
}

function latToTileY(lat: number, z: number): number {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** z
  );
}

/** Build the canonical tile URLs covering `bounds` for each zoom in [minZoom, maxZoom]. */
export function planTileUrls(
  bounds: LatLngBounds,
  minZoom: number,
  maxZoom: number,
  cap = MAX_PLANNED_TILES
): string[] {
  const urls: string[] = [];
  for (let z = minZoom; z <= maxZoom; z++) {
    const xMin = lonToTileX(bounds.west, z);
    const xMax = lonToTileX(bounds.east, z);
    const yMin = latToTileY(bounds.north, z);
    const yMax = latToTileY(bounds.south, z);
    for (let x = Math.min(xMin, xMax); x <= Math.max(xMin, xMax); x++) {
      for (let y = Math.min(yMin, yMax); y <= Math.max(yMin, yMax); y++) {
        urls.push(`${TILE_HOST}/${z}/${x}/${y}.png`);
        if (urls.length >= cap) return urls;
      }
    }
  }
  return urls;
}

export function estimateTileCount(
  bounds: LatLngBounds,
  minZoom: number,
  maxZoom: number
): number {
  return planTileUrls(bounds, minZoom, maxZoom, Number.MAX_SAFE_INTEGER).length;
}

async function controller(): Promise<ServiceWorker | null> {
  if (!("serviceWorker" in navigator)) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.active;
}

/** Post a message to the SW and resolve when it replies (or rejects on timeout). */
async function request<T>(message: Record<string, unknown>, timeoutMs = 60_000): Promise<T> {
  const sw = await controller();
  if (!sw) {
    throw new Error("Service worker etkin değil");
  }
  return new Promise<T>((resolve, reject) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => reject(new Error("Service worker yanıt vermedi")), timeoutMs);
    channel.port1.onmessage = (event) => {
      clearTimeout(timer);
      resolve(event.data as T);
    };
    sw.postMessage(message, [channel.port2]);
  });
}

/**
 * Pre-cache tiles for an area. `onProgress` fires as the SW reports batches.
 * Resolves with the final summary.
 */
export async function precacheArea(
  bounds: LatLngBounds,
  minZoom: number,
  maxZoom: number,
  onProgress?: (p: PrecacheProgress) => void
): Promise<PrecacheProgress> {
  const urls = planTileUrls(bounds, minZoom, maxZoom);
  const sw = await controller();
  if (!sw) {
    throw new Error("Service worker etkin değil — çevrimdışı harita kullanılamıyor");
  }

  return new Promise<PrecacheProgress>((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = (event) => {
      const data = event.data || {};
      if (data.type === "tile-precache-progress" && onProgress) {
        onProgress({ done: data.done, total: data.total, cached: data.cached });
      } else if (data.type === "tile-precache-done") {
        resolve({ done: data.done, total: data.total, cached: data.cached });
      }
    };
    sw.postMessage({ type: "precache-tiles", urls }, [channel.port2]);
  });
}

export async function getTileCacheInfo(): Promise<TileCacheInfo> {
  const data = await request<{ count: number; max: number; estimateBytes: number | null }>({
    type: "tile-cache-info",
  });
  return { count: data.count, max: data.max, estimateBytes: data.estimateBytes };
}

export async function clearTileCache(): Promise<void> {
  await request({ type: "clear-tile-cache" });
}
