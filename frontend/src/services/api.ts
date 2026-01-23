/**
 * API Service
 * Handles all communication with GeoSafe backend
 * Centralizes API calls so they're easy to update
 */

import axios, { AxiosInstance } from "axios";
import { Warehouse, SafeZone } from "../types";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:8000";

class GeoSafeAPI {
  private client: AxiosInstance;

  constructor() {
    // Create axios instance with base URL
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  /**
   * Fetch all warehouses
   * @returns Array of warehouses with their locations
   */
  async fetchWarehouses(): Promise<Warehouse[]> {
    try {
      const response = await this.client.get<Warehouse[]>(
        "/api/warehouses"
      );
      console.log("Warehouses fetched:", response.data);
      return response.data;
    } catch (error) {
      console.error("Error fetching warehouses:", error);
      throw error;
    }
  }

  /**
   * Fetch all safe zones
   * @returns Array of safe zones with their boundaries
   */
  async fetchSafeZones(): Promise<SafeZone[]> {
    try {
      const response = await this.client.get<SafeZone[]>(
        "/api/safe-zones"
      );
      console.log("Safe zones fetched:", response.data);
      return response.data;
    } catch (error) {
      console.error("Error fetching safe zones:", error);
      throw error;
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get("/health");
      return response.status === 200;
    } catch (error) {
      console.error("Health check failed:", error);
      return false;
    }
  }
}

// Export singleton instance
export const geoSafeAPI = new GeoSafeAPI();
