import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { geoSafeAPI } from "../../services";
import { useSSEStream } from "../../hooks/useSSEStream";
import { CriticalStockRecord, Warehouse } from "../../types";
import { EmptyState, ResourceBadge, SectionHeader, StatusCard } from "./opsUi";

// How long (ms) an item stays highlighted after a live update
const RECENTLY_UPDATED_TTL = 8_000;

type RecentlyUpdatedKey = `${number}-${number}`;

export default function OperationsLogisticsPage() {
  const { role } = useAuth();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [criticalStock, setCriticalStock] = useState<CriticalStockRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [stockFilter, setStockFilter] = useState<"all" | "critical" | "available">("all");
  const [recentlyUpdated, setRecentlyUpdated] = useState<Set<RecentlyUpdatedKey>>(new Set());
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Map<RecentlyUpdatedKey, Date>>(new Map());
  const timersRef = useRef<Map<RecentlyUpdatedKey, ReturnType<typeof setTimeout>>>(new Map());

  // GS-022: SSE live updates
  const lastSSEEvent = useSSEStream();

  useEffect(() => {
    let mounted = true;

    const loadLogistics = async () => {
      setLoading(true);
      const [warehouseResult, stockResult] = await Promise.allSettled([
        geoSafeAPI.fetchWarehouses(),
        role === "admin" ? geoSafeAPI.fetchCriticalStockAdmin() : Promise.resolve([]),
      ]);

      if (!mounted) return;
      if (warehouseResult.status === "fulfilled") setWarehouses(warehouseResult.value);
      if (stockResult.status === "fulfilled") setCriticalStock(stockResult.value);
      setLoading(false);
    };

    void loadLogistics();

    return () => {
      mounted = false;
    };
  }, [role]);

  // Handle live inventory_update events
  useEffect(() => {
    if (!lastSSEEvent || lastSSEEvent.type !== "inventory_update") return;

    const { warehouse_id, item_id, quantity, threshold, is_critical,
            item_name, item_sku, item_unit, warehouse_name } = lastSSEEvent.data as {
      warehouse_id: number; item_id: number; quantity: number; threshold: number;
      is_critical: boolean; item_name: string; item_sku: string;
      item_unit: string; warehouse_name: string;
    };

    const key: RecentlyUpdatedKey = `${warehouse_id}-${item_id}`;

    // Update or insert the stock row
    setCriticalStock((prev) => {
      const existing = prev.findIndex(
        (r) => r.warehouse_id === warehouse_id && r.item_id === item_id
      );
      const updated: CriticalStockRecord = {
        warehouse_id, item_id, item_name, item_sku, item_unit,
        warehouse_name, quantity, threshold,
        recommended_action: is_critical
          ? `${warehouse_name} deposunda ${item_name} için ikmal planına bakın.`
          : "",
      };
      if (existing !== -1) {
        const next = [...prev];
        if (is_critical) {
          next[existing] = updated;
        } else {
          next.splice(existing, 1);
        }
        return next;
      }
      return is_critical ? [...prev, updated] : prev;
    });

    // Mark as recently updated for visual highlight
    setRecentlyUpdated((prev) => new Set([...prev, key]));
    setLastUpdatedAt((prev) => new Map([...prev, [key, new Date()]]));

    // Clear highlight after TTL
    const existing = timersRef.current.get(key);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      setRecentlyUpdated((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      timersRef.current.delete(key);
    }, RECENTLY_UPDATED_TTL);
    timersRef.current.set(key, timer);
  }, [lastSSEEvent]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => { timersRef.current.forEach(clearTimeout); };
  }, []);

  const activeWarehouses = warehouses.filter((warehouse) => warehouse.status === "active").length;
  const inactiveWarehouses = warehouses.filter((warehouse) => warehouse.status !== "active").length;
  const criticalWarehouseCount = new Set(criticalStock.map((row) => row.warehouse_id)).size;
  const filteredStock = criticalStock.filter((item) => {
    if (stockFilter === "critical") return item.quantity === 0;
    if (stockFilter === "available") return item.quantity > 0;
    return true;
  });

  return (
    <div className="ops-page-stack">
      <section className="ops-metric-grid" aria-label="Lojistik özeti">
        <StatusCard
          label="Depo Kullanılabilirliği"
          value={loading ? "..." : activeWarehouses}
          detail={`Toplam ${warehouses.length || 0} depo`}
          tone="safe"
        />
        <StatusCard
          label="İzlenecek Depolar"
          value={loading ? "..." : inactiveWarehouses}
          detail="Aktif olmayan depo kayıtları"
          tone={inactiveWarehouses ? "warning" : "neutral"}
        />
        <StatusCard
          label="Kritik Depolar"
          value={loading ? "..." : criticalWarehouseCount}
          detail={role === "admin" ? "Kritik stok bulunan depolar" : "Admin görünümü"}
          tone={criticalWarehouseCount ? "critical" : "neutral"}
        />
      </section>

      <section className="ops-logistics-grid">
        <section className="ops-panel">
          <SectionHeader eyebrow="Kaynak Riski" title="Depo Durumu" />
          {warehouses.length === 0 && !loading ? (
            <EmptyState message="Depo kaydı bulunamadı." />
          ) : (
            <div className="ops-warehouse-list">
              {warehouses.map((warehouse) => (
                <article key={warehouse.id} className="risk-row">
                  <div>
                    <strong>{warehouse.name}</strong>
                    <span>{warehouse.address || "Adres bilgisi bekleniyor."}</span>
                  </div>
                  <ResourceBadge tone={warehouse.status === "active" ? "safe" : "warning"}>
                    {warehouse.status}
                  </ResourceBadge>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="ops-panel">
          {/* GS-022: live indicator */}
          <SectionHeader
            eyebrow="Envanter Durumu"
            title={
              <>
                <span className="live-dot" aria-hidden="true" />
                Öncelikli Stok
                <span className="sr-only">— canlı güncelleme etkin</span>
              </>
            }
          />
          {/* aria-live so screen readers announce incoming changes */}
          <div aria-live="polite" aria-atomic="false" className="sr-only" id="inventory-live-region">
            {lastSSEEvent?.type === "inventory_update"
              ? `Stok güncellendi: ${(lastSSEEvent.data as { item_name: string }).item_name}`
              : ""}
          </div>

          <div className="filter-toolbar" aria-label="Stok filtresi" role="group">
            <button
              type="button"
              className={stockFilter === "all" ? "active" : ""}
              onClick={() => setStockFilter("all")}
              aria-pressed={stockFilter === "all"}
            >
              Tümü ({criticalStock.length})
            </button>
            <button
              type="button"
              className={stockFilter === "critical" ? "active" : ""}
              onClick={() => setStockFilter("critical")}
              aria-pressed={stockFilter === "critical"}
            >
              Sıfır Stok ({criticalStock.filter((item) => item.quantity === 0).length})
            </button>
            <button
              type="button"
              className={stockFilter === "available" ? "active" : ""}
              onClick={() => setStockFilter("available")}
              aria-pressed={stockFilter === "available"}
            >
              Düşük Stok ({criticalStock.filter((item) => item.quantity > 0).length})
            </button>
          </div>
          {role !== "admin" ? (
            <EmptyState message="Kritik stok ayrıntısı için admin rolü gerekir." />
          ) : loading ? (
            <EmptyState message="Stok akışı yükleniyor..." />
          ) : criticalStock.length === 0 ? (
            <EmptyState message="Şu anda kritik stok uyarısı yok." />
          ) : filteredStock.length === 0 ? (
            <EmptyState message="Bu filtrede gösterilecek kalem yok." />
          ) : (
            <div className="inventory-list">
              {filteredStock.map((item) => {
                const key: RecentlyUpdatedKey = `${item.warehouse_id}-${item.item_id}`;
                const isRecent = recentlyUpdated.has(key);
                const updatedAt = lastUpdatedAt.get(key);
                return (
                  <article
                    key={key}
                    className={`inventory-item${isRecent ? " recently-updated" : ""}`}
                    aria-label={`${item.item_name}, ${item.warehouse_name}, miktar: ${item.quantity} ${item.item_unit}`}
                  >
                    <div>
                      <strong>{item.item_name}</strong>
                      <span>
                        {item.warehouse_name}
                        {isRecent && updatedAt ? (
                          <span className="inventory-update-timestamp">
                            {" "}• az önce güncellendi
                          </span>
                        ) : null}
                      </span>
                    </div>
                    <ResourceBadge tone={item.quantity === 0 ? "critical" : "warning"}>
                      {item.quantity}/{item.threshold} {item.item_unit}
                    </ResourceBadge>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </section>
    </div>
  );
}
