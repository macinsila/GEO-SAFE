import axios, { AxiosInstance } from "axios";
import {
  NearestDepotResult,
  ReliefItemName,
  SafeZone,
  Warehouse,
  WarehouseInventoryData,
} from "../types";

const API_BASE_URL =
  (process.env.REACT_APP_API_BASE_URL as string | undefined) ?? "http://localhost:8000";

const TOKEN_KEY = "geosafe_token";

interface ApiEnvelope<T> {
  status?: string;
  message?: string;
  data: T;
}

class GeoSafeAPI {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({ baseURL: API_BASE_URL });

    // Inject Bearer token from localStorage on every request
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

  // ── Safe Zones ────────────────────────────────────────────────────────
  async fetchSafeZones(): Promise<SafeZone[]> {
    const res = await this.client.get<SafeZone[] | ApiEnvelope<SafeZone[]>>(
      "/api/v1/safe-zones"
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
    await this.client.post("/api/v1/emergency", payload);
  }

  async fetchEmergencies(): Promise<EmergencyRecord[]> {
    const res = await this.client.get<ApiEnvelope<EmergencyRecord[]>>("/api/v1/emergency");
    return this.unwrap(res.data);
  }

  async clearEmergencies(): Promise<void> {
    await this.client.delete("/api/v1/emergency");
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

export interface EmergencyPayload {
  durum: string;
  saat: string;
  harita_link: string;
  enlem: number;
  boylam: number;
}

export interface EmergencyRecord {
  id?: number;
  durum: string;
  saat: string;
  harita_link?: string;
  enlem?: number;
  boylam?: number;
}

export const geoSafeAPI = new GeoSafeAPI();
