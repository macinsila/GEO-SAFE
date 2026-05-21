import axios, { AxiosInstance } from "axios";
import {
  CriticalStockRecord,
  EmergencyAdminRecord,
  EmergencyPayload,
  InventoryItemAdmin,
  InventoryMovementAdminRecord,
  NearestDepotResult,
  ReliefItemName,
  SafeZone,
  ShelterOfferAdmin,
  ShelterOfferPayload,
  ShelterOfferPublic,
  VolunteerApplicationAdmin,
  VolunteerApplicationPayload,
  VolunteerApplicationPublic,
  Warehouse,
  WarehouseInventoryAdminRow,
  WarehouseInventoryData,
} from "../types";

const configuredApiBaseUrl = (process.env.REACT_APP_API_BASE_URL as string | undefined)?.trim();
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
        "API adresi ayarlanmamis. Vercel ortam degiskenlerinde REACT_APP_API_BASE_URL Render backend URL'i olmali.",
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
  build: "login-fix-2026-05-21-3",
};

const TOKEN_KEY = "geosafe_token";

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
    const res = await this.client.post<ApiEnvelope<{ access_token: string }>>(
      "/api/v1/auth/token",
      form,
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );
    return this.unwrap(res.data).access_token;
  }

  async register(name: string, email: string, password: string): Promise<void> {
    await this.client.post("/api/v1/auth/register", { name, email, password });
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

  // ── Earthquakes ───────────────────────────────────────────────────────
  async fetchEarthquakes(): Promise<{ result: EarthquakeItem[] }> {
    const res = await this.client.get<ApiEnvelope<{ result: EarthquakeItem[] }>>(
      "/api/v1/earthquakes"
    );
    return this.unwrap(res.data);
  }

  // ── Emergency ─────────────────────────────────────────────────────────
  async sendEmergency(payload: EmergencyPayload): Promise<void> {
    await this.publicClient.post("/api/v1/emergency", payload);
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
