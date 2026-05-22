import axios from "axios";
import {
  EmergencyPayload,
  ShelterOfferPayload,
  VolunteerApplicationPayload,
} from "../types";

export type OfflineQueueItemType = "emergency" | "volunteer" | "shelter";
export type OfflineQueueItemStatus = "pending" | "syncing" | "failed";

export interface OfflineQueuePayloadMap {
  emergency: EmergencyPayload;
  volunteer: VolunteerApplicationPayload;
  shelter: ShelterOfferPayload;
}

export type OfflineQueuePayload = OfflineQueuePayloadMap[OfflineQueueItemType];

export interface OfflineQueueItem<T extends OfflineQueueItemType = OfflineQueueItemType> {
  id: string;
  type: T;
  payload: OfflineQueuePayloadMap[T];
  createdAt: string;
  status: OfflineQueueItemStatus;
  retryCount: number;
  lastError?: string;
}

export interface OfflineQueueStore {
  read(): OfflineQueueItem[];
  write(items: OfflineQueueItem[]): void;
}

export interface OfflineSubmitOptions<T extends OfflineQueueItemType> {
  isOnline: boolean;
  hasConsent: boolean;
  type: T;
  payload: OfflineQueuePayloadMap[T];
  submitOnline: (payload: OfflineQueuePayloadMap[T]) => Promise<void>;
  store: OfflineQueueStore;
}

export type OfflineSubmitResult =
  | { kind: "submitted" }
  | { kind: "queued"; item: OfflineQueueItem }
  | { kind: "consent_required" };

export interface SyncResult {
  synced: number;
  failed: number;
}

const OFFLINE_QUEUE_STORAGE_KEY = "geosafe_offline_queue_v1";

const API_BASE_URL =
  (process.env.REACT_APP_API_BASE_URL as string | undefined) ?? "http://localhost:8011";

const publicClient = axios.create({ baseURL: API_BASE_URL });

function createQueueId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `queue-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function sanitizeEmergencyPayload(payload: EmergencyPayload): EmergencyPayload {
  return {
    durum: payload.durum,
    saat: payload.saat,
    harita_link: payload.harita_link,
    enlem: payload.enlem,
    boylam: payload.boylam,
    ...(payload.kategori !== undefined && { kategori: payload.kategori }),
    ...(payload.aciklama !== undefined && { aciklama: payload.aciklama }),
  };
}

function sanitizeVolunteerPayload(
  payload: VolunteerApplicationPayload
): VolunteerApplicationPayload {
  return {
    full_name: payload.full_name,
    contact_info: payload.contact_info,
    district: payload.district,
    neighborhood: payload.neighborhood,
    skills: Array.isArray(payload.skills) ? [...payload.skills] : [],
    availability_note: payload.availability_note,
  };
}

function sanitizeShelterPayload(payload: ShelterOfferPayload): ShelterOfferPayload {
  return {
    host_name: payload.host_name,
    contact_info: payload.contact_info,
    city: payload.city,
    district: payload.district,
    neighborhood: payload.neighborhood,
    address_detail: payload.address_detail,
    capacity: Number(payload.capacity || 1),
    available_from: payload.available_from,
    available_until: payload.available_until,
    duration_note: payload.duration_note,
    household_notes: payload.household_notes,
    suitability_notes: payload.suitability_notes,
  };
}

export function sanitizeQueuePayload<T extends OfflineQueueItemType>(
  type: T,
  payload: OfflineQueuePayloadMap[T]
): OfflineQueuePayloadMap[T] {
  if (type === "emergency") {
    return sanitizeEmergencyPayload(payload as EmergencyPayload) as OfflineQueuePayloadMap[T];
  }
  if (type === "volunteer") {
    return sanitizeVolunteerPayload(
      payload as VolunteerApplicationPayload
    ) as OfflineQueuePayloadMap[T];
  }
  return sanitizeShelterPayload(payload as ShelterOfferPayload) as OfflineQueuePayloadMap[T];
}

export function createLocalStorageQueueStore(
  storage: Pick<Storage, "getItem" | "setItem"> | null = typeof window !== "undefined"
    ? window.localStorage
    : null
): OfflineQueueStore {
  return {
    read() {
      if (!storage) {
        return [];
      }
      try {
        const raw = storage.getItem(OFFLINE_QUEUE_STORAGE_KEY);
        if (!raw) {
          return [];
        }
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    },
    write(items) {
      if (!storage) {
        return;
      }
      storage.setItem(OFFLINE_QUEUE_STORAGE_KEY, JSON.stringify(items));
    },
  };
}

export function createMemoryQueueStore(initial: OfflineQueueItem[] = []): OfflineQueueStore {
  let items = clone(initial);
  return {
    read() {
      return clone(items);
    },
    write(nextItems) {
      items = clone(nextItems);
    },
  };
}

export function listQueueItems(store: OfflineQueueStore) {
  return store.read();
}

export function buildOfflineQueueItem<T extends OfflineQueueItemType>(
  type: T,
  payload: OfflineQueuePayloadMap[T]
): OfflineQueueItem<T> {
  return {
    id: createQueueId(),
    type,
    payload: sanitizeQueuePayload(type, payload),
    createdAt: new Date().toISOString(),
    status: "pending",
    retryCount: 0,
  };
}

export function enqueueOfflineItem<T extends OfflineQueueItemType>(
  store: OfflineQueueStore,
  type: T,
  payload: OfflineQueuePayloadMap[T]
) {
  const nextItem = buildOfflineQueueItem(type, payload);
  const current = store.read();
  store.write([...current, nextItem]);
  return nextItem;
}

export function deleteOfflineItem(store: OfflineQueueStore, id: string) {
  store.write(store.read().filter((item) => item.id !== id));
}

export function maskQueueItemSummary(item: OfflineQueueItem) {
  if (item.type === "emergency") {
    return "Acil durum bildirimi ve konum kaydi";
  }

  if (item.type === "volunteer") {
    const payload = item.payload as VolunteerApplicationPayload;
    const location = [payload.district, payload.neighborhood].filter(Boolean).join(" / ");
    return location ? `Gönüllü başvurusu - ${location}` : "Gönüllü başvurusu";
  }

  const payload = item.payload as ShelterOfferPayload;
  const area = [payload.city, payload.district, payload.neighborhood].filter(Boolean).join(" / ");
  const capacity = payload.capacity ? `Kapasite: ${payload.capacity}` : "Kapasite bilgisi yok";
  return area ? `Barınma teklifi - ${area} - ${capacity}` : `Barınma teklifi - ${capacity}`;
}

export async function submitWithOfflineSupport<T extends OfflineQueueItemType>({
  isOnline,
  hasConsent,
  type,
  payload,
  submitOnline,
  store,
}: OfflineSubmitOptions<T>): Promise<OfflineSubmitResult> {
  if (isOnline) {
    await submitOnline(payload);
    return { kind: "submitted" };
  }

  if (!hasConsent) {
    return { kind: "consent_required" };
  }

  const item = enqueueOfflineItem(store, type, payload);
  return { kind: "queued", item };
}

function getSyncSender(type: OfflineQueueItemType) {
  if (type === "emergency") {
    return (payload: EmergencyPayload) => publicClient.post("/api/v1/emergency", payload);
  }
  if (type === "volunteer") {
    return (payload: VolunteerApplicationPayload) =>
      publicClient.post("/api/v1/volunteers", payload);
  }
  return (payload: ShelterOfferPayload) => publicClient.post("/api/v1/shelter-offers", payload);
}

function normalizeError(error: unknown) {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message || error.message || "Sync hatasi";
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Sync hatasi";
}

export async function syncOfflineQueue(
  store: OfflineQueueStore,
  senders: Partial<{
    [K in OfflineQueueItemType]: (payload: OfflineQueuePayloadMap[K]) => Promise<unknown>;
  }> = {}
): Promise<SyncResult> {
  let items = store.read();
  let synced = 0;
  let failed = 0;

  for (const item of items) {
    const sender =
      senders[item.type] ||
      (getSyncSender(item.type) as (payload: typeof item.payload) => Promise<unknown>);

    const syncingItems = store.read().map((current) =>
      current.id === item.id
        ? { ...current, status: "syncing" as const, lastError: undefined }
        : current
    );
    store.write(syncingItems);

    try {
      await sender(item.payload as never);
      synced += 1;
      store.write(store.read().filter((current) => current.id !== item.id));
    } catch (error) {
      failed += 1;
      const message = normalizeError(error);
      store.write(
        store.read().map((current) =>
          current.id === item.id
            ? {
                ...current,
                status: "failed" as const,
                retryCount: current.retryCount + 1,
                lastError: message,
              }
            : current
        )
      );
    }

    items = store.read();
  }

  return { synced, failed };
}

