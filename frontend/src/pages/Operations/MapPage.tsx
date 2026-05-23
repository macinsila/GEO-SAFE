import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { Map } from "../../components";
import { geoSafeAPI } from "../../services";
import { CriticalStockRecord, MapClickEvent, SafeZone, Warehouse } from "../../types";
import { MiniMetric, ResourceBadge, SectionHeader } from "./opsUi";

export default function OperationsMapPage() {
  const { role } = useAuth();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [safeZones, setSafeZones] = useState<SafeZone[]>([]);
  const [criticalStock, setCriticalStock] = useState<CriticalStockRecord[]>([]);
  const [, setClickedCoord] = useState<MapClickEvent | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadMapMetrics = async () => {
      const [warehouseResult, zoneResult, stockResult] = await Promise.allSettled([
        geoSafeAPI.fetchWarehouses(),
        geoSafeAPI.fetchSafeZones(),
        role === "admin" ? geoSafeAPI.fetchCriticalStockAdmin() : Promise.resolve([]),
      ]);

      if (!mounted) return;
      if (warehouseResult.status === "fulfilled") setWarehouses(warehouseResult.value);
      if (zoneResult.status === "fulfilled") setSafeZones(zoneResult.value);
      if (stockResult.status === "fulfilled") setCriticalStock(stockResult.value);
    };

    void loadMapMetrics();

    return () => {
      mounted = false;
    };
  }, [role]);

  const activeSafeZones = safeZones.filter((zone) => zone.status === "active").length;
  const inactiveSafeZones = safeZones.length - activeSafeZones;
  const activeWarehouses = warehouses.filter((warehouse) => warehouse.status === "active").length;
  const criticalWarehouseCount = new Set(criticalStock.map((item) => item.warehouse_id)).size;

  return (
    <section className="ops-panel map-panel">
      <SectionHeader
        eyebrow="Harita Analizi"
        title="Canlı Operasyon Haritası"
        meta="Barınma / Depolar / Rota desteği"
      />
      <div className="map-command-row">
        <ResourceBadge tone="safe">Barınma alanları</ResourceBadge>
        <ResourceBadge tone="info">Depo işaretleri</ResourceBadge>
        <ResourceBadge tone="warning">Rota bulucu</ResourceBadge>
      </div>
      <div className="map-floating-metrics" aria-label="Harita operasyon ölçümleri">
        <MiniMetric label="Aktif Alan" value={activeSafeZones} tone="safe" />
        <MiniMetric label="Aktif Depo" value={activeWarehouses} tone="info" />
        <MiniMetric
          label="Kritik Depo"
          value={criticalWarehouseCount}
          tone={criticalWarehouseCount ? "critical" : "safe"}
        />
        <MiniMetric
          label="Riskli Alan"
          value={inactiveSafeZones}
          tone={inactiveSafeZones ? "warning" : "neutral"}
        />
      </div>
      <Map onClickCoordinates={setClickedCoord} />
    </section>
  );
}
