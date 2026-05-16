/**
 * Type definitions for GeoSafe
 * These interfaces match our backend schemas
 */

/**
 * GeoJSON Point geometry
 * Used for warehouse locations
 */
export interface PointGeometry {
  type: "Point";
  coordinates: [number, number]; // [longitude, latitude]
}

/**
 * GeoJSON Polygon geometry
 * Used for safe zone boundaries
 */
export interface PolygonGeometry {
  type: "Polygon";
  coordinates: [number, number][][]; // Ring of [longitude, latitude] pairs
}

/**
 * Warehouse entity
 */
export interface Warehouse {
  id: number;
  name: string;
  location?: PointGeometry | null; // Optional for SQLite compatibility
  address?: string;
  capacity?: number;
  status: string;
  data?: any; // JSON metadata with location coordinates
  created_at: string;
}

/**
 * Safe Zone entity
 */
export interface SafeZone {
  id: number;
  name: string;
  geometry?: PolygonGeometry | null; // Optional for SQLite compatibility
  capacity?: number;
  capacity_type: string;
  status: string;
  data?: any; // JSON metadata with bounds
  created_at: string;
}

/**
 * Click event on map
 * Returns coordinates of where user clicked
 */
export interface MapClickEvent {
  lat: number;
  lng: number;
  timestamp: Date;
}

/**
 * API response for list endpoints
 */
export interface ApiListResponse<T> {
  data: T[];
  total: number;
  error?: string;
}

export type ReliefItemName =
  | "battaniye"
  | "kuru_gida"
  | "ilac"
  | "su"
  | "yangin_malzemesi";

export interface NearestDepotInfo {
  id: number;
  name: string;
  address?: string;
  status: string;
}

export interface NearestDepotItemInfo {
  id: number;
  name: string;
  unit: string;
  quantity: number;
}

export interface NearestDepotResult {
  depot: NearestDepotInfo;
  distance_km: number;
  item: NearestDepotItemInfo;
}

export interface WarehouseInventoryItem {
  id: number;
  item_id: number;
  item_name: string;
  item_sku: string;
  item_unit: string;
  quantity: number;
  threshold?: number;
  capacity_pct: number;
  low_stock: boolean;
}

export interface WarehouseInventoryData {
  warehouse_id: number;
  capacity: number;
  items: WarehouseInventoryItem[];
}

export interface InventoryItemAdmin {
  id: number;
  sku: string;
  name: string;
  description?: string | null;
  unit: string;
  low_stock_threshold?: number | null;
  is_active: boolean;
  created_at: string;
  updated_at?: string | null;
}

export interface WarehouseInventoryAdminRow {
  warehouse_id: number;
  warehouse_name: string;
  item_id: number;
  item_name: string;
  item_sku: string;
  item_unit: string;
  quantity: number;
  threshold: number;
  is_critical: boolean;
}

export interface InventoryMovementAdminRecord {
  id: number;
  warehouse_id?: number | null;
  warehouse_name?: string | null;
  item_id: number;
  item_name: string;
  item_sku: string;
  quantity_change: number;
  old_quantity?: number | null;
  new_quantity?: number | null;
  movement_type: string;
  note?: string | null;
  created_at: string;
  actor_id?: number | null;
  actor_name?: string | null;
  actor_role?: string | null;
}

export interface CriticalStockRecord {
  warehouse_id: number;
  warehouse_name: string;
  item_id: number;
  item_name: string;
  item_sku: string;
  item_unit: string;
  quantity: number;
  threshold: number;
  recommended_action: string;
}

export interface VolunteerApplicationPayload {
  full_name: string;
  contact_info: string;
  district?: string;
  neighborhood?: string;
  skills: string[];
  availability_note?: string;
}

export interface VolunteerApplicationPublic {
  id: number;
  status: string;
  created_at: string;
}

export interface VolunteerApplicationAdmin extends VolunteerApplicationPublic {
  full_name: string;
  contact_info: string;
  district?: string;
  neighborhood?: string;
  skills?: string[] | null;
  availability_note?: string;
  updated_at?: string;
}

export interface ShelterOfferPayload {
  host_name: string;
  contact_info: string;
  city?: string;
  district?: string;
  neighborhood?: string;
  address_detail?: string;
  capacity: number;
  available_from?: string;
  available_until?: string;
  duration_note?: string;
  household_notes?: string;
  suitability_notes?: string;
}

export interface ShelterOfferPublic {
  id: number;
  status: string;
  created_at: string;
}

export interface ShelterOfferAdmin extends ShelterOfferPublic {
  host_name: string;
  contact_info: string;
  city?: string;
  district?: string;
  neighborhood?: string;
  address_detail?: string;
  capacity: number;
  available_from?: string;
  available_until?: string;
  duration_note?: string;
  household_notes?: string;
  suitability_notes?: string;
  updated_at?: string;
}

/**
 * Emergency record as seen by admin (includes status for Sprint 3A moderation)
 */
export interface EmergencyAdminRecord {
  id: number;
  durum: string;
  saat: string;
  harita_link?: string;
  enlem?: number;
  boylam?: number;
  status: string;
  created_at?: string;
}

export interface EmergencyPayload {
  durum: string;
  saat: string;
  harita_link: string;
  enlem: number;
  boylam: number;
}

