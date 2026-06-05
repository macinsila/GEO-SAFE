import axios, { AxiosInstance } from "axios";
import {
  Announcement,
  AnnouncementAdmin,
  AnnouncementCreate,
  AnnouncementUpdate,
  Channel,
  ChannelMessage,
  ChatMessage,
  ChatMessageCreate,
  ChatPresence,
  CriticalStockRecord,
  GeofenceSubscription,
  GeofenceSubscriptionUpdate,
  EmergencyAdminRecord,
  EmergencyPayload,
  ImportReport,
  InventoryItemAdmin,
  InventoryMovementAdminRecord,
  KPISummary,
  NearestDepotResult,
  ReliefItemName,
  SafeZone,
  SafeZoneImportRow,
  ShelterOfferAdmin,
  ShelterOfferPayload,
  ShelterOfferPublic,
  VolunteerApplicationAdmin,
  VolunteerApplicationPayload,
  VolunteerApplicationPublic,
  VolunteerMatchCandidate,
  VolunteerTask,
  VolunteerTaskCreate,
  Warehouse,
  WarehouseImportRow,
  WarehouseInventoryAdminRow,
  WarehouseInventoryData,
} from "../types";

const configuredApiBaseUrl = (
  (process.env.REACT_APP_API_BASE_URL as string | undefined) ||
  (process.env.REACT_APP_API_URL as string | undefined)
)?.trim();
const apiEnvName = process.env.REACT_APP_API_BASE_URL ? "REACT_APP_API_BASE_URL" : "REACT_APP_API_URL";
const API_TIMEOUT_MS = 60000;

const isLocalHostname = (hostname: string): boolean =>
  ["localhost", "127.0.0.1", "::1", ""].includes(hostname);

const isLocalApiUrl = (url: string): boolean => {
  try {
    return isLocalHostname(new URL(url).hostname);
  } catch {
    return false;
  }
};

const getApiConfig = (): { baseUrl: string; error: string | null } => {
  const frontendHostname = typeof window === "undefined" ? "localhost" : window.location.hostname;
  const isLocalFrontend = isLocalHostname(frontendHostname);

  if (!configuredApiBaseUrl) {
    if (isLocalFrontend) {
      return { baseUrl: "http://localhost:8000", error: null };
    }

    return {
      baseUrl: "",
      error:
        "API adresi ayarlanmamış. Vercel ortam değişkenlerinde REACT_APP_API_BASE_URL Render backend URL'i olmalı. Eski REACT_APP_API_URL adı da desteklenir.",
    };
  }

  if (!isLocalFrontend && isLocalApiUrl(configuredApiBaseUrl)) {
    return {
      baseUrl: "",
      error:
        "Canli sitede API adresi localhost olamaz. Vercel'de REACT_APP_API_BASE_URL Render backend URL'i olarak ayarlanmali.",
    };
  }

  return { baseUrl: configuredApiBaseUrl.replace(/\/+$/, ""), error: null };
};

const { baseUrl: API_BASE_URL, error: API_CONFIG_ERROR } = getApiConfig();
export const API_DIAGNOSTICS = {
  baseUrl: API_BASE_URL || "not-configured",
  env: API_BASE_URL ? apiEnvName : "not-configured",
  build: "login-fix-2026-05-21-3",
};

const TOKEN_KEY = "geosafe_token";
const AUTH_EXPIRED_EVENT = "geosafe-auth-expired";
const AUTH_NOTICE_KEY = "geosafe_auth_notice";

interface ApiEnvelope<T> {
  status?: string;
  message?: string;
  data: T;
}

class GeoSafeAPI {
  private client: AxiosInstance;
  private publicClient: AxiosInstance;

  constructor() {
    this.client = axios.create({ baseURL: API_BASE_URL, timeout: API_TIMEOUT_MS });
    this.publicClient = axios.create({ baseURL: API_BASE_URL, timeout: API_TIMEOUT_MS });

    this.client.interceptors.request.use((config) => {
      if (API_CONFIG_ERROR) {
        return Promise.reject(new Error(API_CONFIG_ERROR));
      }

      return config;
    });

    this.publicClient.interceptors.request.use((config) => {
      if (API_CONFIG_ERROR) {
        return Promise.reject(new Error(API_CONFIG_ERROR));
      }

      return config;
    });

    // Inject Bearer token from localStorage on every authenticated request
    this.client.interceptors.request.use((config) => {
      const token = localStorage.getItem(TOKEN_KEY);
      if (token) {
        config.headers = config.headers ?? {};
        config.headers["Authorization"] = `Bearer ${token}`;
      }
      return config;
    });

    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          localStorage.removeItem(TOKEN_KEY);
          sessionStorage.setItem(
            AUTH_NOTICE_KEY,
            "Oturum süreniz doldu. Güvenliğiniz için yeniden giriş yapmanız gerekiyor."
          );
          window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
          if (window.location.pathname !== "/login") {
            window.location.assign("/login");
          }
        }
        return Promise.reject(error);
      }
    );
  }

  private unwrap<T>(payload: T | ApiEnvelope<T>): T {
    if (payload && typeof payload === "object" && "data" in (payload as object)) {
      return (payload as ApiEnvelope<T>).data;
    }
    return payload as T;
  }

  // ── Auth ──────────────────────────────────────────────────────────────
  async login(email: string, password: string): Promise<string> {
    const form = new URLSearchParams();
    form.append("username", email);
    form.append("password", password);
    const res = await this.publicClient.post<ApiEnvelope<{ access_token: string }>>(
      "/api/v1/auth/token",
      form,
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );
    return this.unwrap(res.data).access_token;
  }

  async register(name: string, email: string, password: string): Promise<void> {
    await this.publicClient.post("/api/v1/auth/register", { name, email, password });
  }

  // ── Profile ───────────────────────────────────────────────────────────
  async fetchProfile(): Promise<Record<string, string>> {
    const res = await this.client.get<ApiEnvelope<Record<string, string>>>(
      "/api/v1/profile"
    );
    return this.unwrap(res.data);
  }

  async updateProfile(data: Record<string, string>): Promise<void> {
    await this.client.put("/api/v1/profile", data);
  }

  async fetchQRIdentity(): Promise<{ qr_payload: Record<string, unknown>; display_name: string; issued_at: string }> {
    const res = await this.client.get<ApiEnvelope<{ qr_payload: Record<string, unknown>; display_name: string; issued_at: string }>>(
      "/api/v1/qr/identity"
    );
    return this.unwrap(res.data);
  }

  // ── Warehouses ────────────────────────────────────────────────────────
  async fetchWarehouses(): Promise<Warehouse[]> {
    const res = await this.client.get<Warehouse[] | ApiEnvelope<Warehouse[]>>(
      "/api/v1/warehouses"
    );
    return this.unwrap<Warehouse[]>(res.data);
  }

  async fetchAdminWarehouses(): Promise<Warehouse[]> {
    const res = await this.client.get<ApiEnvelope<Warehouse[]>>(
      "/api/v1/warehouses/admin"
    );
    return this.unwrap<Warehouse[]>(res.data);
  }

  async fetchWarehouseInventory(warehouseId: number): Promise<WarehouseInventoryData> {
    const res = await this.client.get<ApiEnvelope<WarehouseInventoryData>>(
      `/api/v1/warehouses/${warehouseId}/inventory`
    );
    return this.unwrap(res.data);
  }

  async updateWarehouseInventory(
    warehouseId: number,
    items: { item_id: number; quantity: number }[]
  ): Promise<void> {
    await this.client.put(`/api/v1/warehouses/${warehouseId}/inventory`, { items });
  }

  async fetchInventoryItemsAdmin(): Promise<InventoryItemAdmin[]> {
    const res = await this.client.get<ApiEnvelope<InventoryItemAdmin[]>>(
      "/api/v1/inventory/items/admin"
    );
    return this.unwrap(res.data);
  }

  async createInventoryItemAdmin(payload: {
    sku: string;
    name: string;
    unit: string;
    description?: string;
    low_stock_threshold?: number | null;
    is_active?: boolean;
  }): Promise<InventoryItemAdmin> {
    const res = await this.client.post<ApiEnvelope<InventoryItemAdmin>>(
      "/api/v1/inventory/items/admin",
      payload
    );
    return this.unwrap(res.data);
  }

  async updateInventoryItemAdmin(
    itemId: number,
    payload: Partial<{
      sku: string;
      name: string;
      unit: string;
      description: string;
      low_stock_threshold: number | null;
      is_active: boolean;
    }>
  ): Promise<InventoryItemAdmin> {
    const res = await this.client.patch<ApiEnvelope<InventoryItemAdmin>>(
      `/api/v1/inventory/items/admin/${itemId}`,
      payload
    );
    return this.unwrap(res.data);
  }

  async deleteInventoryItemAdmin(itemId: number): Promise<void> {
    await this.client.delete(`/api/v1/inventory/items/admin/${itemId}`);
  }

  async fetchWarehouseInventoryAdmin(): Promise<WarehouseInventoryAdminRow[]> {
    const res = await this.client.get<ApiEnvelope<WarehouseInventoryAdminRow[]>>(
      "/api/v1/inventory/warehouses/admin"
    );
    return this.unwrap(res.data);
  }

  async updateWarehouseInventoryAdmin(
    warehouseId: number,
    itemId: number,
    payload: { quantity: number; movement_type?: string; note?: string }
  ): Promise<WarehouseInventoryAdminRow> {
    const res = await this.client.patch<ApiEnvelope<WarehouseInventoryAdminRow>>(
      `/api/v1/inventory/warehouses/admin/${warehouseId}/items/${itemId}`,
      payload
    );
    return this.unwrap(res.data);
  }

  async fetchInventoryMovementsAdmin(): Promise<InventoryMovementAdminRecord[]> {
    const res = await this.client.get<ApiEnvelope<InventoryMovementAdminRecord[]>>(
      "/api/v1/inventory/movements/admin"
    );
    return this.unwrap(res.data);
  }

  async fetchCriticalStockAdmin(): Promise<CriticalStockRecord[]> {
    const res = await this.client.get<ApiEnvelope<CriticalStockRecord[]>>(
      "/api/v1/inventory/critical/admin"
    );
    return this.unwrap(res.data);
  }

  // ── Safe Zones ────────────────────────────────────────────────────────
  async fetchSafeZones(): Promise<SafeZone[]> {
    const res = await this.client.get<SafeZone[] | ApiEnvelope<SafeZone[]>>(
      "/api/v1/safe-zones"
    );
    return this.unwrap<SafeZone[]>(res.data);
  }

  async fetchAdminSafeZones(): Promise<SafeZone[]> {
    const res = await this.client.get<ApiEnvelope<SafeZone[]>>(
      "/api/v1/safe-zones/admin"
    );
    return this.unwrap<SafeZone[]>(res.data);
  }

  async fetchSafeZoneCount(): Promise<number> {
    return (await this.fetchSafeZones()).length;
  }

  // ── Inventory (SafeZone) ──────────────────────────────────────────────
  async fetchZoneInventory(zoneId: number): Promise<Record<string, unknown>> {
    const res = await this.client.get<ApiEnvelope<Record<string, unknown>>>(
      `/api/v1/inventory/safe-zone/${zoneId}`
    );
    return this.unwrap(res.data);
  }

  async updateZoneInventory(
    zoneId: number,
    data: { water?: string; food?: string; med?: string; blanket?: number; ext?: number }
  ): Promise<void> {
    await this.client.put(`/api/v1/inventory/safe-zone/${zoneId}`, data);
  }

  // ── Spatial ───────────────────────────────────────────────────────────
  async fetchNearestDepot(
    lat: number,
    lon: number,
    itemName: ReliefItemName,
    radiusKm = 10
  ): Promise<NearestDepotResult[]> {
    const res = await this.client.get<NearestDepotResult[] | ApiEnvelope<NearestDepotResult[]>>(
      "/api/v1/spatial/nearest-depot",
      { params: { lat, lon, item_name: itemName, radius_km: radiusKm } }
    );
    return this.unwrap<NearestDepotResult[]>(res.data);
  }

  async fetchNearestSafeZone(lat: number, lon: number, limit = 5): Promise<NearestSafeZoneResult[]> {
    const res = await this.client.get<NearestSafeZoneResult[] | ApiEnvelope<NearestSafeZoneResult[]>>(
      "/api/v1/spatial/nearest-safe-zone",
      { params: { lat, lon, limit } }
    );
    return this.unwrap<NearestSafeZoneResult[]>(res.data);
  }

  // ── Earthquakes ───────────────────────────────────────────────────────
  async fetchEarthquakes(): Promise<{ result: EarthquakeItem[] }> {
    const res = await this.client.get<ApiEnvelope<{ result: EarthquakeItem[] }>>(
      "/api/v1/earthquakes"
    );
    return this.unwrap(res.data);
  }

  // ── Emergency ─────────────────────────────────────────────────────────
  async sendEmergency(payload: EmergencyPayload): Promise<{ id: number }> {
    const res = await this.publicClient.post<ApiEnvelope<{ id: number }>>("/api/v1/emergency", payload);
    return this.unwrap(res.data);
  }

  async fetchEmergenciesAdmin(status?: string): Promise<EmergencyAdminRecord[]> {
    const params = status ? { status } : undefined;
    const res = await this.client.get<ApiEnvelope<EmergencyAdminRecord[]>>(
      "/api/v1/emergency/admin",
      { params }
    );
    return this.unwrap(res.data);
  }

  async updateEmergencyStatus(id: number, status: string): Promise<EmergencyAdminRecord> {
    const res = await this.client.patch<ApiEnvelope<EmergencyAdminRecord>>(
      `/api/v1/emergency/admin/${id}/status`,
      { status }
    );
    return this.unwrap(res.data);
  }

  async clearEmergencies(): Promise<void> {
    await this.client.delete("/api/v1/emergency");
  }

  // ── Volunteers ─────────────────────────────────────────────────────
  async submitVolunteerApplication(
    payload: VolunteerApplicationPayload
  ): Promise<VolunteerApplicationPublic> {
    const res = await this.publicClient.post<ApiEnvelope<VolunteerApplicationPublic>>(
      "/api/v1/volunteers",
      payload
    );
    return this.unwrap(res.data);
  }

  async fetchVolunteerApplicationsAdmin(status?: string): Promise<VolunteerApplicationAdmin[]> {
    const params = status ? { status } : undefined;
    const res = await this.client.get<ApiEnvelope<VolunteerApplicationAdmin[]>>(
      "/api/v1/volunteers/admin",
      { params }
    );
    return this.unwrap(res.data);
  }

  async updateVolunteerStatus(id: number, status: string): Promise<VolunteerApplicationAdmin> {
    const res = await this.client.patch<ApiEnvelope<VolunteerApplicationAdmin>>(
      `/api/v1/volunteers/admin/${id}/status`,
      { status }
    );
    return this.unwrap(res.data);
  }

  // ── Shelter Offers ──────────────────────────────────────────────────
  async submitShelterOffer(payload: ShelterOfferPayload): Promise<ShelterOfferPublic> {
    const res = await this.publicClient.post<ApiEnvelope<ShelterOfferPublic>>(
      "/api/v1/shelter-offers",
      payload
    );
    return this.unwrap(res.data);
  }

  async fetchShelterOffersAdmin(status?: string): Promise<ShelterOfferAdmin[]> {
    const params = status ? { status } : undefined;
    const res = await this.client.get<ApiEnvelope<ShelterOfferAdmin[]>>(
      "/api/v1/shelter-offers/admin",
      { params }
    );
    return this.unwrap(res.data);
  }

  async updateShelterStatus(id: number, status: string): Promise<ShelterOfferAdmin> {
    const res = await this.client.patch<ApiEnvelope<ShelterOfferAdmin>>(
      `/api/v1/shelter-offers/admin/${id}/status`,
      { status }
    );
    return this.unwrap(res.data);
  }

  // ── Announcements ─────────────────────────────────────────────────────
  async fetchAnnouncements(kategori?: string): Promise<Announcement[]> {
    const params = kategori ? { kategori } : undefined;
    const res = await this.publicClient.get<ApiEnvelope<Announcement[]>>(
      "/api/v1/announcements",
      { params }
    );
    return this.unwrap(res.data);
  }

  async fetchAnnouncementsAdmin(status?: string, kategori?: string): Promise<AnnouncementAdmin[]> {
    const params: Record<string, string> = {};
    if (status) params.status = status;
    if (kategori) params.kategori = kategori;
    const res = await this.client.get<ApiEnvelope<AnnouncementAdmin[]>>(
      "/api/v1/announcements/admin",
      { params: Object.keys(params).length ? params : undefined }
    );
    return this.unwrap(res.data);
  }

  async createAnnouncement(payload: AnnouncementCreate): Promise<AnnouncementAdmin> {
    const res = await this.client.post<ApiEnvelope<AnnouncementAdmin>>(
      "/api/v1/announcements",
      payload
    );
    return this.unwrap(res.data);
  }

  async updateAnnouncement(id: number, payload: AnnouncementUpdate): Promise<AnnouncementAdmin> {
    const res = await this.client.patch<ApiEnvelope<AnnouncementAdmin>>(
      `/api/v1/announcements/${id}`,
      payload
    );
    return this.unwrap(res.data);
  }

  async deleteAnnouncement(id: number): Promise<void> {
    await this.client.delete(`/api/v1/announcements/${id}`);
  }

  // ── Emergency Photo Upload (GS-042) ─────────────────────────────────
  async uploadEmergencyImage(reportId: number, file: File): Promise<string> {
    const formData = new FormData();
    formData.append("file", file);
    const res = await this.publicClient.post<ApiEnvelope<{ id: number; image_url: string }>>(
      `/api/v1/emergency/${reportId}/image`,
      formData,
    );
    return this.unwrap(res.data).image_url;
  }

  // ── Volunteer Tasks (GS-050) ─────────────────────────────────────────
  async fetchVolunteerTasksAdmin(status?: string, urgency?: string): Promise<VolunteerTask[]> {
    const params: Record<string, string> = {};
    if (status) params.status = status;
    if (urgency) params.urgency = urgency;
    const res = await this.client.get<ApiEnvelope<VolunteerTask[]>>(
      "/api/v1/volunteer-tasks/admin",
      { params: Object.keys(params).length ? params : undefined }
    );
    return this.unwrap(res.data);
  }

  async fetchOpenVolunteerTasks(): Promise<VolunteerTask[]> {
    const res = await this.client.get<ApiEnvelope<VolunteerTask[]>>("/api/v1/volunteer-tasks");
    return this.unwrap(res.data);
  }

  async fetchMyVolunteerTasks(): Promise<VolunteerTask[]> {
    const res = await this.client.get<ApiEnvelope<VolunteerTask[]>>("/api/v1/volunteer-tasks/my");
    return this.unwrap(res.data);
  }

  async createVolunteerTask(payload: VolunteerTaskCreate): Promise<VolunteerTask> {
    const res = await this.client.post<ApiEnvelope<VolunteerTask>>("/api/v1/volunteer-tasks", payload);
    return this.unwrap(res.data);
  }

  async assignVolunteerTask(taskId: number, assignedToId: number | null): Promise<VolunteerTask> {
    const res = await this.client.patch<ApiEnvelope<VolunteerTask>>(
      `/api/v1/volunteer-tasks/admin/${taskId}/assign`,
      { assigned_to_id: assignedToId }
    );
    return this.unwrap(res.data);
  }

  async updateVolunteerTaskStatus(taskId: number, status: string): Promise<VolunteerTask> {
    const res = await this.client.patch<ApiEnvelope<VolunteerTask>>(
      `/api/v1/volunteer-tasks/admin/${taskId}/status`,
      { status }
    );
    return this.unwrap(res.data);
  }

  async claimVolunteerTask(taskId: number): Promise<VolunteerTask> {
    const res = await this.client.patch<ApiEnvelope<VolunteerTask>>(
      `/api/v1/volunteer-tasks/${taskId}/claim`
    );
    return this.unwrap(res.data);
  }

  async completeVolunteerTask(taskId: number): Promise<VolunteerTask> {
    const res = await this.client.patch<ApiEnvelope<VolunteerTask>>(
      `/api/v1/volunteer-tasks/${taskId}/complete`
    );
    return this.unwrap(res.data);
  }

  async fetchTaskCandidates(taskId: number): Promise<VolunteerMatchCandidate[]> {
    const res = await this.client.get<ApiEnvelope<VolunteerMatchCandidate[]>>(
      `/api/v1/volunteer-tasks/${taskId}/candidates`
    );
    return this.unwrap(res.data);
  }

  // ── Heatmap (GS-063) ─────────────────────────────────────────────────
  async fetchHeatmapPoints(
    source: "incidents" | "checkins" | "both" = "incidents",
    days = 30,
  ): Promise<[number, number, number][]> {
    const res = await this.client.get<ApiEnvelope<[number, number, number][]>>(
      "/api/v1/spatial/heatmap",
      { params: { source, days } },
    );
    return this.unwrap(res.data);
  }

  // ── Chat (GS-110) ────────────────────────────────────────────────────
  async fetchChatHistory(room = "ops", limit = 50): Promise<ChatMessage[]> {
    const res = await this.client.get<ApiEnvelope<ChatMessage[]>>(
      "/api/v1/chat/messages",
      { params: { room, limit } }
    );
    return this.unwrap(res.data);
  }

  async sendChatMessage(payload: ChatMessageCreate): Promise<ChatMessage> {
    const res = await this.client.post<ApiEnvelope<ChatMessage>>(
      "/api/v1/chat/messages",
      payload
    );
    return this.unwrap(res.data);
  }

  async searchChatMessages(room: string, q: string, limit = 50): Promise<ChatMessage[]> {
    const res = await this.client.get<ApiEnvelope<ChatMessage[]>>(
      "/api/v1/chat/messages",
      { params: { room, limit, q } }
    );
    return this.unwrap(res.data);
  }

  async markChatRead(room: string, lastMessageId: number): Promise<void> {
    await this.client.post(`/api/v1/chat/messages/${room}/read`, {
      last_message_id: lastMessageId,
    });
  }

  async getChatReadReceipt(room: string): Promise<number> {
    const res = await this.client.get<ApiEnvelope<{ room: string; last_read_message_id: number }>>(
      `/api/v1/chat/messages/${room}/read`
    );
    return this.unwrap(res.data).last_read_message_id;
  }

  async joinChatPresence(room: string): Promise<ChatPresence> {
    const res = await this.client.post<ApiEnvelope<ChatPresence>>(
      `/api/v1/chat/presence/${room}`
    );
    return this.unwrap(res.data);
  }

  async leaveChatPresence(room: string): Promise<void> {
    await this.client.delete(`/api/v1/chat/presence/${room}`);
  }

  // ── Geofence alerts (GS-023) ──────────────────────────────────────────
  async fetchGeofenceSubscription(): Promise<GeofenceSubscription> {
    const res = await this.client.get<ApiEnvelope<GeofenceSubscription>>(
      "/api/v1/geofence/subscription"
    );
    return this.unwrap(res.data);
  }

  async updateGeofenceSubscription(
    payload: GeofenceSubscriptionUpdate
  ): Promise<GeofenceSubscription> {
    const res = await this.client.put<ApiEnvelope<GeofenceSubscription>>(
      "/api/v1/geofence/subscription",
      payload
    );
    return this.unwrap(res.data);
  }

  // ── Neighborhood channels (GS-111) ────────────────────────────────────
  async fetchChannels(lat?: number, lon?: number): Promise<Channel[]> {
    const params: Record<string, number> = {};
    if (lat !== undefined && lon !== undefined) {
      params.lat = lat;
      params.lon = lon;
    }
    const res = await this.client.get<ApiEnvelope<Channel[]>>("/api/v1/channels", {
      params,
    });
    return this.unwrap(res.data);
  }

  async joinChannel(slug: string): Promise<void> {
    await this.client.post(`/api/v1/channels/${slug}/join`);
  }

  async leaveChannel(slug: string): Promise<void> {
    await this.client.post(`/api/v1/channels/${slug}/leave`);
  }

  async fetchChannelMessages(slug: string, limit = 50): Promise<ChannelMessage[]> {
    const res = await this.client.get<ApiEnvelope<ChannelMessage[]>>(
      `/api/v1/channels/${slug}/messages`,
      { params: { limit } }
    );
    return this.unwrap(res.data);
  }

  async sendChannelMessage(slug: string, body: string): Promise<ChannelMessage> {
    const res = await this.client.post<ApiEnvelope<ChannelMessage>>(
      `/api/v1/channels/${slug}/messages`,
      { body }
    );
    return this.unwrap(res.data);
  }

  async reportChannelMessage(messageId: number, reason?: string): Promise<void> {
    await this.client.post(`/api/v1/channels/messages/${messageId}/report`, {
      reason: reason ?? null,
    });
  }

  async removeChannelMessage(messageId: number): Promise<void> {
    await this.client.delete(`/api/v1/channels/messages/${messageId}`);
  }

  // ── KPI (GS-080) ─────────────────────────────────────────────────────
  async fetchKPISummary(): Promise<KPISummary> {
    const res = await this.client.get<ApiEnvelope<KPISummary>>("/api/v1/kpi/summary");
    return this.unwrap(res.data);
  }

  // ── GS-061: Bulk import ────────────────────────────────────────────────
  async importWarehouses(rows: WarehouseImportRow[], dryRun = false): Promise<ImportReport> {
    const res = await this.client.post<ApiEnvelope<ImportReport>>(
      `/api/v1/admin/import/warehouses${dryRun ? "?dry_run=true" : ""}`,
      rows
    );
    return this.unwrap(res.data);
  }

  async importSafeZones(rows: SafeZoneImportRow[], dryRun = false): Promise<ImportReport> {
    const res = await this.client.post<ApiEnvelope<ImportReport>>(
      `/api/v1/admin/import/safe-zones${dryRun ? "?dry_run=true" : ""}`,
      rows
    );
    return this.unwrap(res.data);
  }

  // ── Health ────────────────────────────────────────────────────────────
  async healthCheck(): Promise<boolean> {
    try {
      const res = await this.client.get("/health");
      return res.status === 200;
    } catch {
      return false;
    }
  }
}

export interface EarthquakeItem {
  mag: number;
  title: string;
  date: string;
  depth: number;
}

// Legacy alias kept for compatibility with EmergencyPage component
export interface EmergencyRecord {
  id?: number;
  durum: string;
  saat: string;
  harita_link?: string;
  enlem?: number;
  boylam?: number;
}

export const geoSafeAPI = new GeoSafeAPI();
