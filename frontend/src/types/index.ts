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
