import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { geoSafeAPI } from "../../services";
import {
  AnnouncementAdmin,
  AnnouncementCreate,
  CriticalStockRecord,
  EmergencyAdminRecord,
  ImportReport,
  InventoryItemAdmin,
  InventoryMovementAdminRecord,
  SafeZone,
  SafeZoneImportRow,
  ShelterOfferAdmin,
  VolunteerApplicationAdmin,
  Warehouse,
  WarehouseImportRow,
  WarehouseInventoryData,
} from "../../types";

type AdminTab = "warehouses" | "safezones" | "emergency" | "volunteers" | "shelters" | "announcements" | "import" | "activity";

type InventoryEditRow = {
  item_id: number;
  item_name: string;
  item_unit: string;
  quantity: number;
  originalQuantity: number;
};

type ItemDraft = {
  sku: string;
  name: string;
  unit: string;
  description: string;
  low_stock_threshold: string;
  is_active: boolean;
};

const STATUS_STYLE: Record<string, React.CSSProperties> = {
  active: { background: "#2E7D32", color: "#fff" },
  inactive: { background: "#616161", color: "#fff" },
  risky: { background: "#C62828", color: "#fff" },
  maintenance: { background: "#E65100", color: "#fff" },
  pending: { background: "#F9A825", color: "#fff" },
  approved: { background: "#2E7D32", color: "#fff" },
  rejected: { background: "#C62828", color: "#fff" },
  reviewing: { background: "#1565C0", color: "#fff" },
  resolved: { background: "#2E7D32", color: "#fff" },
  dismissed: { background: "#616161", color: "#fff" },
  spam: { background: "#6A1B9A", color: "#fff" },
  draft: { background: "#78909C", color: "#fff" },
  published: { background: "#2E7D32", color: "#fff" },
  archived: { background: "#455A64", color: "#fff" },
  verified: { background: "#00838F", color: "#fff" },
};

const TH: React.CSSProperties = {
  padding: "10px 12px",
  textAlign: "left",
  fontWeight: 600,
  fontSize: 13,
  color: "#555",
  whiteSpace: "nowrap",
};

const TD: React.CSSProperties = {
  padding: "10px 12px",
  verticalAlign: "middle",
  borderTop: "1px solid #eee",
  fontSize: 13,
};

function parseThreshold(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isNaN(parsed) ? null : Math.max(0, parsed);
}

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLE[status] ?? { background: "#9E9E9E", color: "#fff" };
  return (
    <span
      style={{
        ...style,
        padding: "3px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      {status}
    </span>
  );
}

function SummaryCard({
  label,
  value,
  sub,
  warn,
}: {
  label: string;
  value: number;
  sub?: string;
  warn?: boolean;
}) {
  return (
    <div
      style={{
        background: warn && value > 0 ? "#FFF8E1" : "#fff",
        border: `1px solid ${warn && value > 0 ? "#F9A825" : "#e0e0e0"}`,
        borderRadius: 8,
        padding: "16px 20px",
        flex: "1 1 160px",
        boxShadow: "0 1px 4px rgba(0,0,0,.06)",
      }}
    >
      <div
        style={{
          fontSize: 28,
          fontWeight: 700,
          color: warn && value > 0 ? "#E65100" : "#1a237e",
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 14, color: "#555", marginTop: 4 }}>{label}</div>
      {sub ? <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{sub}</div> : null}
    </div>
  );
}

function SectionCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        background: "#fff",
        borderRadius: 8,
        boxShadow: "0 1px 4px rgba(0,0,0,.08)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "14px 18px",
          borderBottom: "1px solid #eaeaea",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <strong style={{ color: "#1a237e", fontSize: 15 }}>{title}</strong>
        {action}
      </div>
      <div style={{ padding: 16 }}>{children}</div>
    </section>
  );
}

interface Props {
  onNavigateToMap?: () => void;
}

export default function AdminDashboard({ onNavigateToMap }: Props) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const goHome = onNavigateToMap ?? (() => navigate("/ops"));

  const [activeTab, setActiveTab] = useState<AdminTab>("warehouses");

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [safeZoneCount, setSafeZoneCount] = useState(0);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | null>(null);
  const [warehouseInventory, setWarehouseInventory] = useState<WarehouseInventoryData | null>(null);
  const [inventoryRows, setInventoryRows] = useState<InventoryEditRow[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItemAdmin[]>([]);
  const [criticalStock, setCriticalStock] = useState<CriticalStockRecord[]>([]);
  const [movementHistory, setMovementHistory] = useState<InventoryMovementAdminRecord[]>([]);
  const [saveMsg, setSaveMsg] = useState("");
  const [saveBusy, setSaveBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [itemBusy, setItemBusy] = useState<number | "new" | null>(null);
  const [itemMsg, setItemMsg] = useState("");
  const [newItem, setNewItem] = useState<ItemDraft>({
    sku: "",
    name: "",
    unit: "unit",
    description: "",
    low_stock_threshold: "",
    is_active: true,
  });

  const [safeZones, setSafeZones] = useState<SafeZone[]>([]);
  const [safeZonesLoading, setSafeZonesLoading] = useState(false);
  const [selectedZoneId, setSelectedZoneId] = useState<number | null>(null);
  const [zoneInventory, setZoneInventory] = useState<Record<string, unknown>>({});
  const [zoneInventoryEdit, setZoneInventoryEdit] = useState<Record<string, unknown>>({});
  const [zoneSaveBusy, setZoneSaveBusy] = useState(false);
  const [zoneSaveMsg, setZoneSaveMsg] = useState("");

  const [emergencies, setEmergencies] = useState<EmergencyAdminRecord[]>([]);
  const [emergencyLoading, setEmergencyLoading] = useState(false);
  const [emergencyFilter, setEmergencyFilter] = useState("");
  const [clearingEmergencies, setClearingEmergencies] = useState(false);

  const [volunteers, setVolunteers] = useState<VolunteerApplicationAdmin[]>([]);
  const [volunteerLoading, setVolunteerLoading] = useState(false);
  const [volunteerFilter, setVolunteerFilter] = useState("");

  const [shelterOffers, setShelterOffers] = useState<ShelterOfferAdmin[]>([]);
  const [shelterLoading, setShelterLoading] = useState(false);
  const [shelterFilter, setShelterFilter] = useState("");

  const [announcements, setAnnouncements] = useState<AnnouncementAdmin[]>([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(false);
  const [announcementStatusFilter, setAnnouncementStatusFilter] = useState("");
  const [announcementKategoriFilter, setAnnouncementKategoriFilter] = useState("");
  const [annTitle, setAnnTitle] = useState("");
  const [annContent, setAnnContent] = useState("");
  const [annKategori, setAnnKategori] = useState("genel");
  const [annPriority, setAnnPriority] = useState("normal");
  const [annCreateBusy, setAnnCreateBusy] = useState(false);
  const [annCreateMsg, setAnnCreateMsg] = useState("");

  // GS-061: Bulk import state
  const [importType, setImportType] = useState<"warehouses" | "safe-zones">("warehouses");
  const [importJson, setImportJson] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [importReport, setImportReport] = useState<ImportReport | null>(null);
  const [importMsg, setImportMsg] = useState("");

  // GS-083: Activity timeline state
  type AuditEntry = {
    id: number;
    user_email: string | null;
    user_role: string | null;
    action: string;
    resource_type: string;
    resource_id: string | null;
    created_at: string | null;
  };
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditFilter, setAuditFilter] = useState("");

  const loadWarehouseOverview = useCallback(async () => {
    setLoading(true);
    try {
      const [adminWarehouses, safeZonesData, items, critical, movements] = await Promise.all([
        geoSafeAPI.fetchAdminWarehouses(),
        geoSafeAPI.fetchSafeZones(),
        geoSafeAPI.fetchInventoryItemsAdmin(),
        geoSafeAPI.fetchCriticalStockAdmin(),
        geoSafeAPI.fetchInventoryMovementsAdmin(),
      ]);
      setWarehouses(adminWarehouses);
      setSafeZoneCount(safeZonesData.length);
      setInventoryItems(items);
      setCriticalStock(critical);
      setMovementHistory(movements);
    } finally {
      setLoading(false);
    }
  }, []);

  const buildInventoryRows = useCallback(
    (items: InventoryItemAdmin[], currentInventory: WarehouseInventoryData | null) => {
      const quantityByItem = new Map<number, number>();
      currentInventory?.items.forEach((row) => {
        quantityByItem.set(row.item_id, row.quantity);
      });

      return items
        .filter((item) => item.is_active)
        .map((item) => {
          const quantity = quantityByItem.get(item.id) ?? 0;
          return {
            item_id: item.id,
            item_name: item.name,
            item_unit: item.unit,
            quantity,
            originalQuantity: quantity,
          };
        });
    },
    []
  );

  const selectWarehouse = useCallback(
    async (warehouseId: number, nextItems?: InventoryItemAdmin[]) => {
      setSelectedWarehouseId(warehouseId);
      setSaveMsg("");
      setInventoryLoading(true);
      try {
        const inventory = await geoSafeAPI.fetchWarehouseInventory(warehouseId);
        setWarehouseInventory(inventory);
        setInventoryRows(buildInventoryRows(nextItems ?? inventoryItems, inventory));
      } catch {
        setWarehouseInventory(null);
        setInventoryRows(buildInventoryRows(nextItems ?? inventoryItems, null));
      } finally {
        setInventoryLoading(false);
      }
    },
    [buildInventoryRows, inventoryItems]
  );

  useEffect(() => {
    loadWarehouseOverview();
  }, [loadWarehouseOverview]);

  useEffect(() => {
    if (selectedWarehouseId !== null) {
      setInventoryRows(buildInventoryRows(inventoryItems, warehouseInventory));
    }
  }, [buildInventoryRows, inventoryItems, selectedWarehouseId, warehouseInventory]);

  const saveWarehouseInventory = async () => {
    if (selectedWarehouseId === null) {
      return;
    }

    const changedRows = inventoryRows.filter((row) => row.quantity !== row.originalQuantity);
    if (changedRows.length === 0) {
      setSaveMsg("Değişiklik yok.");
      return;
    }

    setSaveBusy(true);
    setSaveMsg("");
    try {
      await Promise.all(
        changedRows.map((row) =>
          geoSafeAPI.updateWarehouseInventoryAdmin(selectedWarehouseId, row.item_id, {
            quantity: row.quantity,
            movement_type: "adjustment",
            note: "Admin dashboard inventory update",
          })
        )
      );
      await loadWarehouseOverview();
      await selectWarehouse(selectedWarehouseId);
      setSaveMsg("Stok güncellendi.");
    } catch {
      setSaveMsg("Kaydetme hatası.");
    } finally {
      setSaveBusy(false);
    }
  };

  const createInventoryItem = async () => {
    setItemBusy("new");
    setItemMsg("");
    try {
      const created = await geoSafeAPI.createInventoryItemAdmin({
        sku: newItem.sku.trim(),
        name: newItem.name.trim(),
        unit: newItem.unit.trim() || "unit",
        description: newItem.description.trim() || undefined,
        low_stock_threshold: parseThreshold(newItem.low_stock_threshold),
        is_active: newItem.is_active,
      });
      const nextItems = [...inventoryItems, created].sort((a, b) => a.name.localeCompare(b.name, "tr"));
      setInventoryItems(nextItems);
      setNewItem({
        sku: "",
        name: "",
        unit: "unit",
        description: "",
        low_stock_threshold: "",
        is_active: true,
      });
      if (selectedWarehouseId !== null) {
        setInventoryRows(buildInventoryRows(nextItems, warehouseInventory));
      }
      setItemMsg("Yeni stok kalemi eklendi.");
    } catch {
      setItemMsg("Stok kalemi eklenemedi.");
    } finally {
      setItemBusy(null);
    }
  };

  const saveInventoryItem = async (item: InventoryItemAdmin) => {
    setItemBusy(item.id);
    setItemMsg("");
    try {
      const updated = await geoSafeAPI.updateInventoryItemAdmin(item.id, {
        sku: item.sku,
        name: item.name,
        unit: item.unit,
        description: item.description ?? "",
        low_stock_threshold: item.low_stock_threshold ?? null,
        is_active: item.is_active,
      });
      const nextItems = inventoryItems.map((row) => (row.id === updated.id ? updated : row));
      setInventoryItems(nextItems);
      if (selectedWarehouseId !== null) {
        setInventoryRows(buildInventoryRows(nextItems, warehouseInventory));
      }
      await loadWarehouseOverview();
      setItemMsg("Stok kalemi güncellendi.");
    } catch {
      setItemMsg("Stok kalemi güncellenemedi.");
    } finally {
      setItemBusy(null);
    }
  };

  const toggleInventoryItemActive = async (item: InventoryItemAdmin, isActive: boolean) => {
    setItemBusy(item.id);
    setItemMsg("");
    try {
      const updated = await geoSafeAPI.updateInventoryItemAdmin(item.id, { is_active: isActive });
      const nextItems = inventoryItems.map((row) => (row.id === updated.id ? updated : row));
      setInventoryItems(nextItems);
      if (selectedWarehouseId !== null) {
        setInventoryRows(buildInventoryRows(nextItems, warehouseInventory));
      }
      await loadWarehouseOverview();
      setItemMsg(isActive ? "Kalem tekrar aktif edildi." : "Kalem pasife alındı.");
    } catch {
      setItemMsg("Kalem durumu güncellenemedi.");
    } finally {
      setItemBusy(null);
    }
  };

  const deleteInventoryItem = async (itemId: number) => {
    setItemBusy(itemId);
    setItemMsg("");
    try {
      await geoSafeAPI.deleteInventoryItemAdmin(itemId);
      const nextItems = inventoryItems.filter((row) => row.id !== itemId);
      setInventoryItems(nextItems);
      if (selectedWarehouseId !== null) {
        setInventoryRows(buildInventoryRows(nextItems, warehouseInventory));
      }
      await loadWarehouseOverview();
      setItemMsg("Silme islemi tamamlandi.");
    } catch {
      setItemMsg("Silme islemi basarisiz.");
    } finally {
      setItemBusy(null);
    }
  };

  const loadSafeZones = useCallback(async () => {
    setSafeZonesLoading(true);
    try {
      setSafeZones(await geoSafeAPI.fetchAdminSafeZones());
    } finally {
      setSafeZonesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "safezones") {
      loadSafeZones();
    }
  }, [activeTab, loadSafeZones]);

  const selectZone = async (zoneId: number) => {
    setSelectedZoneId(zoneId);
    setZoneSaveMsg("");
    try {
      const inventory = await geoSafeAPI.fetchZoneInventory(zoneId);
      setZoneInventory(inventory);
      setZoneInventoryEdit({ ...inventory });
    } catch {
      setZoneInventory({});
      setZoneInventoryEdit({});
    }
  };

  const saveZoneInventory = async () => {
    if (selectedZoneId === null) {
      return;
    }
    setZoneSaveBusy(true);
    try {
      await geoSafeAPI.updateZoneInventory(selectedZoneId, zoneInventoryEdit as any);
      setZoneInventory(zoneInventoryEdit);
      setZoneSaveMsg("Alan envanteri guncellendi.");
    } catch {
      setZoneSaveMsg("Alan envanteri guncellenemedi.");
    } finally {
      setZoneSaveBusy(false);
    }
  };

  const loadEmergencies = useCallback(async () => {
    setEmergencyLoading(true);
    try {
      setEmergencies(await geoSafeAPI.fetchEmergenciesAdmin(emergencyFilter || undefined));
    } finally {
      setEmergencyLoading(false);
    }
  }, [emergencyFilter]);

  useEffect(() => {
    if (activeTab === "emergency") {
      loadEmergencies();
    }
  }, [activeTab, loadEmergencies]);

  const clearEmergencies = async () => {
    setClearingEmergencies(true);
    try {
      await geoSafeAPI.clearEmergencies();
      await loadEmergencies();
    } finally {
      setClearingEmergencies(false);
    }
  };

  const updateEmergencyStatus = async (id: number, status: string) => {
    await geoSafeAPI.updateEmergencyStatus(id, status);
    await loadEmergencies();
  };

  const loadVolunteers = useCallback(async () => {
    setVolunteerLoading(true);
    try {
      setVolunteers(await geoSafeAPI.fetchVolunteerApplicationsAdmin(volunteerFilter || undefined));
    } finally {
      setVolunteerLoading(false);
    }
  }, [volunteerFilter]);

  useEffect(() => {
    if (activeTab === "volunteers") {
      loadVolunteers();
    }
  }, [activeTab, loadVolunteers]);

  const updateVolunteerStatus = async (id: number, status: string) => {
    await geoSafeAPI.updateVolunteerStatus(id, status);
    await loadVolunteers();
  };

  const loadShelterOffers = useCallback(async () => {
    setShelterLoading(true);
    try {
      setShelterOffers(await geoSafeAPI.fetchShelterOffersAdmin(shelterFilter || undefined));
    } finally {
      setShelterLoading(false);
    }
  }, [shelterFilter]);

  useEffect(() => {
    if (activeTab === "shelters") {
      loadShelterOffers();
    }
  }, [activeTab, loadShelterOffers]);

  const updateShelterStatus = async (id: number, status: string) => {
    await geoSafeAPI.updateShelterStatus(id, status);
    await loadShelterOffers();
  };

  const loadAnnouncements = useCallback(async () => {
    setAnnouncementsLoading(true);
    try {
      setAnnouncements(
        await geoSafeAPI.fetchAnnouncementsAdmin(
          announcementStatusFilter || undefined,
          announcementKategoriFilter || undefined
        )
      );
    } finally {
      setAnnouncementsLoading(false);
    }
  }, [announcementStatusFilter, announcementKategoriFilter]);

  useEffect(() => {
    if (activeTab === "announcements") {
      loadAnnouncements();
    }
  }, [activeTab, loadAnnouncements]);

  const createAndPublishAnnouncement = async (publishNow: boolean) => {
    if (!annTitle.trim() || !annContent.trim()) {
      setAnnCreateMsg("Başlık ve içerik zorunludur.");
      return;
    }
    setAnnCreateBusy(true);
    setAnnCreateMsg("");
    try {
      const payload: AnnouncementCreate = {
        title: annTitle.trim(),
        content: annContent.trim(),
        kategori: annKategori || undefined,
        priority: annPriority,
      };
      const created = await geoSafeAPI.createAnnouncement(payload);
      if (publishNow) {
        await geoSafeAPI.updateAnnouncement(created.id, { status: "published" });
      }
      setAnnTitle("");
      setAnnContent("");
      setAnnKategori("genel");
      setAnnPriority("normal");
      setAnnCreateMsg(publishNow ? "Duyuru yayımlandı." : "Taslak kaydedildi.");
      await loadAnnouncements();
    } catch {
      setAnnCreateMsg("Duyuru oluşturulamadı.");
    } finally {
      setAnnCreateBusy(false);
    }
  };

  const updateAnnouncementStatus = async (id: number, status: string) => {
    await geoSafeAPI.updateAnnouncement(id, { status });
    await loadAnnouncements();
  };

  const deleteAnnouncement = async (id: number) => {
    await geoSafeAPI.deleteAnnouncement(id);
    await loadAnnouncements();
  };

  // GS-083: Load audit log
  const loadAuditLog = useCallback(async () => {
    setAuditLoading(true);
    try {
      const apiBase = process.env.REACT_APP_API_URL || "http://localhost:8000";
      const token = localStorage.getItem("access_token") || "";
      const res = await fetch(`${apiBase}/api/v1/admin/audit-log?limit=100`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      setAuditLog(json.data ?? []);
    } catch {
      setAuditLog([]);
    } finally {
      setAuditLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "activity") void loadAuditLog();
  }, [activeTab, loadAuditLog]);

  // GS-061: Bulk import handler
  const runImport = async (dryRun: boolean) => {
    setImportMsg("");
    setImportReport(null);
    let rows: unknown[];
    try {
      rows = JSON.parse(importJson);
      if (!Array.isArray(rows)) throw new Error("JSON bir dizi (array) olmalıdır");
    } catch (e) {
      setImportMsg(`JSON ayrıştırma hatası: ${String(e)}`);
      return;
    }
    setImportBusy(true);
    try {
      let report: ImportReport;
      if (importType === "warehouses") {
        report = await geoSafeAPI.importWarehouses(rows as WarehouseImportRow[], dryRun);
      } else {
        report = await geoSafeAPI.importSafeZones(rows as SafeZoneImportRow[], dryRun);
      }
      setImportReport(report);
      setImportMsg(dryRun ? "Ön izleme tamamlandı (kayıt yapılmadı)." : "İçe aktarma başarıyla tamamlandı.");
      if (!dryRun) void loadWarehouseOverview();
    } catch (e) {
      setImportMsg(`Hata: ${String(e)}`);
    } finally {
      setImportBusy(false);
    }
  };

  const activeWarehouses = warehouses.filter((warehouse) => warehouse.status === "active").length;
  const inactiveWarehouses = warehouses.filter((warehouse) => warehouse.status === "inactive").length;
  const riskyWarehouses = warehouses.filter((warehouse) => warehouse.status === "risky").length;
  const lowStockWarehouseCount = new Set(criticalStock.map((row) => row.warehouse_id)).size;
  const selectedWarehouse = warehouses.find((warehouse) => warehouse.id === selectedWarehouseId) ?? null;
  const selectedZone = safeZones.find((zone) => zone.id === selectedZoneId) ?? null;

  const TabBtn = ({ id, label }: { id: AdminTab; label: string }) => (
    <button
      onClick={() => setActiveTab(id)}
      style={{
        padding: "9px 18px",
        background: activeTab === id ? "#1a237e" : "transparent",
        color: activeTab === id ? "#fff" : "#555",
        border: "none",
        borderRadius: 8,
        cursor: "pointer",
        fontWeight: 600,
        fontSize: 14,
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#f5f5f5", fontFamily: "system-ui, sans-serif" }}>
      <header
        style={{
          background: "linear-gradient(135deg,#1a237e,#283593)",
          color: "#fff",
          padding: "18px 28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>GeoSafe Admin Konsolu</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, opacity: 0.88 }}>
            Depo, stok ve operasyon görünürlüğü
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={goHome}
            style={{
              background: "rgba(255,255,255,.15)",
              border: "1px solid rgba(255,255,255,.4)",
              color: "#fff",
              borderRadius: 8,
              padding: "8px 16px",
              cursor: "pointer",
            }}
          >
            Operasyon Paneli
          </button>
          <button
            onClick={logout}
            style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#dc2626",
              borderRadius: 8,
              padding: "8px 16px",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Çıkış
          </button>
        </div>
      </header>

      <main style={{ padding: "24px 28px", maxWidth: 1360, margin: "0 auto" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginBottom: 24 }}>
          <SummaryCard label="Toplam Depo" value={warehouses.length} />
          <SummaryCard label="Aktif Depo" value={activeWarehouses} sub="active" />
          <SummaryCard label="Pasif Depo" value={inactiveWarehouses} sub="inactive" />
          <SummaryCard label="Riskli Depo" value={riskyWarehouses} sub="risky" />
          <SummaryCard label="Toplanma Alanı" value={safeZoneCount} />
          <SummaryCard label="Kritik Stok Uyarısı" value={criticalStock.length} sub="kalem" warn />
          <SummaryCard label="Kritik Depo" value={lowStockWarehouseCount} sub="depo" warn />
        </div>

        <div
          style={{
            display: "flex",
            gap: 4,
            marginBottom: 20,
            background: "#e8e8e8",
            borderRadius: 10,
            padding: 4,
            width: "fit-content",
            flexWrap: "wrap",
          }}
        >
          <TabBtn id="warehouses" label="Depolar ve Stok" />
          <TabBtn id="safezones" label="Toplanma Alanları" />
          <TabBtn id="emergency" label="Acil Bildirimler" />
          <TabBtn id="volunteers" label="Gönüllüler" />
          <TabBtn id="shelters" label="Barınma Teklifleri" />
          <TabBtn id="announcements" label="Duyurular" />
          <TabBtn id="import" label="Toplu İçe Aktar" />
          <TabBtn id="activity" label="Aktivite" />
        </div>

        {activeTab === "warehouses" && (
          loading ? (
            <div style={{ textAlign: "center", padding: 60, color: "#666" }}>Yükleniyor...</div>
          ) : (
            <div style={{ display: "grid", gap: 20 }}>
              <SectionCard title="Kritik Stok Paneli">
                {criticalStock.length === 0 ? (
                  <div style={{ color: "#666" }}>Kritik stok kaydı bulunmuyor.</div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ background: "#f5f5f5" }}>
                          <th style={TH}>Depo</th>
                          <th style={TH}>Kalem</th>
                          <th style={TH}>Mevcut</th>
                          <th style={TH}>Eşik</th>
                          <th style={TH}>Öneri</th>
                        </tr>
                      </thead>
                      <tbody>
                        {criticalStock.map((row) => (
                          <tr key={`${row.warehouse_id}-${row.item_id}`}>
                            <td style={TD}>{row.warehouse_name}</td>
                            <td style={TD}>
                              <strong>{row.item_name}</strong>
                              <div style={{ color: "#777", fontSize: 12 }}>{row.item_sku}</div>
                            </td>
                            <td style={{ ...TD, color: "#C62828", fontWeight: 700 }}>
                              {row.quantity} {row.item_unit}
                            </td>
                            <td style={TD}>{row.threshold}</td>
                            <td style={{ ...TD, color: "#555" }}>{row.recommended_action}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </SectionCard>

              <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.1fr) minmax(360px, .9fr)", gap: 20 }}>
                <SectionCard title="Stok Kalemi Yönetimi">
                  <div style={{ display: "grid", gap: 12 }}>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
                        gap: 10,
                      }}
                    >
                      <input
                        value={newItem.sku}
                        onChange={(event) => setNewItem((state) => ({ ...state, sku: event.target.value }))}
                        placeholder="SKU"
                        style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid #ccc" }}
                      />
                      <input
                        value={newItem.name}
                        onChange={(event) => setNewItem((state) => ({ ...state, name: event.target.value }))}
                        placeholder="Kalem adı"
                        style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid #ccc" }}
                      />
                      <input
                        value={newItem.unit}
                        onChange={(event) => setNewItem((state) => ({ ...state, unit: event.target.value }))}
                        placeholder="Birim"
                        style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid #ccc" }}
                      />
                      <input
                        value={newItem.low_stock_threshold}
                        onChange={(event) =>
                          setNewItem((state) => ({ ...state, low_stock_threshold: event.target.value }))
                        }
                        placeholder="Kritik eşik"
                        style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid #ccc" }}
                      />
                      <button
                        onClick={createInventoryItem}
                        disabled={itemBusy === "new" || !newItem.sku.trim() || !newItem.name.trim()}
                        style={{
                          background: "#1a237e",
                          color: "#fff",
                          border: "none",
                          borderRadius: 6,
                          cursor: "pointer",
                          fontWeight: 600,
                        }}
                      >
                        {itemBusy === "new" ? "Ekleniyor..." : "Yeni Kalem"}
                      </button>
                    </div>
                    <input
                      value={newItem.description}
                      onChange={(event) => setNewItem((state) => ({ ...state, description: event.target.value }))}
                      placeholder="Açıklama"
                      style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid #ccc" }}
                    />
                    {itemMsg ? <div style={{ fontSize: 13, color: "#555" }}>{itemMsg}</div> : null}
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                          <tr style={{ background: "#f5f5f5" }}>
                            <th style={TH}>SKU</th>
                            <th style={TH}>Ad</th>
                            <th style={TH}>Birim</th>
                            <th style={TH}>Eşik</th>
                            <th style={TH}>Durum</th>
                            <th style={TH}>İşlem</th>
                          </tr>
                        </thead>
                        <tbody>
                          {inventoryItems.map((item) => (
                            <tr key={item.id}>
                              <td style={TD}>
                                <input
                                  value={item.sku}
                                  onChange={(event) =>
                                    setInventoryItems((rows) =>
                                      rows.map((row) =>
                                        row.id === item.id ? { ...row, sku: event.target.value } : row
                                      )
                                    )
                                  }
                                  style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid #ccc" }}
                                />
                              </td>
                              <td style={TD}>
                                <input
                                  value={item.name}
                                  onChange={(event) =>
                                    setInventoryItems((rows) =>
                                      rows.map((row) =>
                                        row.id === item.id ? { ...row, name: event.target.value } : row
                                      )
                                    )
                                  }
                                  style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid #ccc" }}
                                />
                                <div style={{ color: "#777", fontSize: 12, marginTop: 4 }}>
                                  {item.description || "Açıklama yok"}
                                </div>
                              </td>
                              <td style={TD}>
                                <input
                                  value={item.unit}
                                  onChange={(event) =>
                                    setInventoryItems((rows) =>
                                      rows.map((row) =>
                                        row.id === item.id ? { ...row, unit: event.target.value } : row
                                      )
                                    )
                                  }
                                  style={{ width: 90, padding: "6px 8px", borderRadius: 6, border: "1px solid #ccc" }}
                                />
                              </td>
                              <td style={TD}>
                                <input
                                  type="number"
                                  min={0}
                                  value={item.low_stock_threshold ?? ""}
                                  onChange={(event) =>
                                    setInventoryItems((rows) =>
                                      rows.map((row) =>
                                        row.id === item.id
                                          ? {
                                              ...row,
                                              low_stock_threshold:
                                                event.target.value === ""
                                                  ? null
                                                  : Math.max(0, Number.parseInt(event.target.value, 10) || 0),
                                            }
                                          : row
                                      )
                                    )
                                  }
                                  style={{ width: 90, padding: "6px 8px", borderRadius: 6, border: "1px solid #ccc" }}
                                />
                              </td>
                              <td style={TD}>
                                <StatusBadge status={item.is_active ? "active" : "inactive"} />
                              </td>
                              <td style={TD}>
                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                  <button
                                    onClick={() => saveInventoryItem(item)}
                                    disabled={itemBusy === item.id}
                                    style={{
                                      background: "#1a237e",
                                      color: "#fff",
                                      border: "none",
                                      borderRadius: 6,
                                      padding: "6px 10px",
                                      cursor: "pointer",
                                    }}
                                  >
                                    Kaydet
                                  </button>
                                  <button
                                    onClick={() => toggleInventoryItemActive(item, !item.is_active)}
                                    disabled={itemBusy === item.id}
                                    style={{
                                      background: "#FFF8E1",
                                      color: "#8D6E00",
                                      border: "1px solid #F9A825",
                                      borderRadius: 6,
                                      padding: "6px 10px",
                                      cursor: "pointer",
                                    }}
                                  >
                                    {item.is_active ? "Pasife Al" : "Aktif Et"}
                                  </button>
                                  <button
                                    onClick={() => deleteInventoryItem(item.id)}
                                    disabled={itemBusy === item.id}
                                    style={{
                                      background: "#fef2f2",
                                      color: "#b91c1c",
                                      border: "1px solid #fecaca",
                                      borderRadius: 6,
                                      padding: "6px 10px",
                                      cursor: "pointer",
                                    }}
                                  >
                                    Sil
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </SectionCard>

                <SectionCard title="Depo Bazlı Stok Güncelleme">
                  <div style={{ display: "grid", gap: 12 }}>
                    <div style={{ display: "grid", gap: 8 }}>
                      {warehouses.map((warehouse) => {
                        const isSelected = warehouse.id === selectedWarehouseId;
                        const warehouseCriticalCount = criticalStock.filter(
                          (row) => row.warehouse_id === warehouse.id
                        ).length;
                        return (
                          <button
                            key={warehouse.id}
                            onClick={() => selectWarehouse(warehouse.id)}
                            style={{
                              textAlign: "left",
                              padding: "10px 12px",
                              borderRadius: 8,
                              border: `1px solid ${isSelected ? "#1a237e" : "#ddd"}`,
                              background: isSelected ? "#EEF2FF" : "#fff",
                              cursor: "pointer",
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                              <strong>{warehouse.name}</strong>
                              <StatusBadge status={warehouse.status} />
                            </div>
                            <div style={{ color: "#666", fontSize: 12, marginTop: 4 }}>
                              {warehouse.address || "Adres yok"}
                            </div>
                            <div style={{ color: warehouseCriticalCount > 0 ? "#C62828" : "#666", fontSize: 12, marginTop: 4 }}>
                              {warehouseCriticalCount > 0
                                ? `${warehouseCriticalCount} kritik kalem`
                                : "Kritik kayıt yok"}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {selectedWarehouseId === null ? (
                      <div style={{ color: "#666" }}>Güncellemek için bir depo seçin.</div>
                    ) : inventoryLoading ? (
                      <div style={{ color: "#666" }}>Depo stoku yükleniyor...</div>
                    ) : (
                      <div style={{ display: "grid", gap: 12 }}>
                        <div>
                          <strong>{selectedWarehouse?.name}</strong>
                          <div style={{ color: "#666", fontSize: 12, marginTop: 4 }}>
                            Tüm aktif stok kalemleri listelenir. Sıfır değer yeni kayıt oluşturabilir.
                          </div>
                        </div>
                        <div style={{ maxHeight: 420, overflowY: "auto", paddingRight: 4 }}>
                          {inventoryRows.map((row, index) => (
                            <div
                              key={row.item_id}
                              style={{
                                display: "grid",
                                gridTemplateColumns: "1fr 110px 64px",
                                gap: 10,
                                alignItems: "center",
                                padding: "8px 0",
                                borderTop: index === 0 ? "none" : "1px solid #eee",
                              }}
                            >
                              <label style={{ fontSize: 13, color: "#333" }}>
                                {row.item_name}
                                <div style={{ color: "#777", fontSize: 12 }}>{row.originalQuantity} mevcut</div>
                              </label>
                              <input
                                type="number"
                                min={0}
                                value={row.quantity}
                                onChange={(event) =>
                                  setInventoryRows((rows) =>
                                    rows.map((current) =>
                                      current.item_id === row.item_id
                                        ? {
                                            ...current,
                                            quantity: Math.max(
                                              0,
                                              Number.parseInt(event.target.value, 10) || 0
                                            ),
                                          }
                                        : current
                                    )
                                  )
                                }
                                style={{ padding: "7px 8px", borderRadius: 6, border: "1px solid #ccc" }}
                              />
                              <span style={{ fontSize: 12, color: "#777" }}>{row.item_unit}</span>
                            </div>
                          ))}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <button
                            onClick={saveWarehouseInventory}
                            disabled={saveBusy}
                            style={{
                              background: "#1a237e",
                              color: "#fff",
                              border: "none",
                              borderRadius: 6,
                              padding: "8px 18px",
                              cursor: "pointer",
                              fontWeight: 600,
                            }}
                          >
                            {saveBusy ? "Kaydediliyor..." : "Stok Kaydet"}
                          </button>
                          {saveMsg ? <span style={{ fontSize: 13, color: "#555" }}>{saveMsg}</span> : null}
                        </div>
                      </div>
                    )}
                  </div>
                </SectionCard>
              </div>

              <SectionCard title="Stok Hareket Geçmişi">
                {movementHistory.length === 0 ? (
                  <div style={{ color: "#666" }}>Stok hareketi bulunmuyor.</div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ background: "#f5f5f5" }}>
                          <th style={TH}>Tarih</th>
                          <th style={TH}>Depo</th>
                          <th style={TH}>Kalem</th>
                          <th style={TH}>Değişim</th>
                          <th style={TH}>Eski / Yeni</th>
                          <th style={TH}>Tip</th>
                          <th style={TH}>Not</th>
                          <th style={TH}>İşlemi Yapan</th>
                        </tr>
                      </thead>
                      <tbody>
                        {movementHistory.slice(0, 30).map((movement) => (
                          <tr key={movement.id}>
                            <td style={TD}>{new Date(movement.created_at).toLocaleString("tr-TR")}</td>
                            <td style={TD}>{movement.warehouse_name || "-"}</td>
                            <td style={TD}>
                              <strong>{movement.item_name}</strong>
                              <div style={{ color: "#777", fontSize: 12 }}>{movement.item_sku}</div>
                            </td>
                            <td style={{ ...TD, color: movement.quantity_change < 0 ? "#C62828" : "#2E7D32", fontWeight: 700 }}>
                              {movement.quantity_change > 0 ? "+" : ""}
                              {movement.quantity_change}
                            </td>
                            <td style={TD}>
                              {movement.old_quantity ?? "-"} / {movement.new_quantity ?? "-"}
                            </td>
                            <td style={TD}>{movement.movement_type}</td>
                            <td style={TD}>{movement.note || "-"}</td>
                            <td style={TD}>
                              {movement.actor_name ? `${movement.actor_name} (${movement.actor_role || "-"})` : "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </SectionCard>
            </div>
          )
        )}

        {activeTab === "safezones" && (
          safeZonesLoading ? (
            <div style={{ textAlign: "center", padding: 60, color: "#666" }}>Yükleniyor...</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: selectedZoneId ? "1fr 360px" : "1fr", gap: 20 }}>
              <SectionCard title="Toplanma Alanı Listesi">
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f5f5f5" }}>
                      <th style={TH}>İsim</th>
                      <th style={TH}>Kapasite</th>
                      <th style={TH}>Durum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {safeZones.map((zone) => (
                      <tr
                        key={zone.id}
                        onClick={() => selectZone(zone.id)}
                        style={{
                          cursor: "pointer",
                          background: zone.id === selectedZoneId ? "#EEF2FF" : "#fff",
                        }}
                      >
                        <td style={TD}>{zone.name}</td>
                        <td style={TD}>{zone.capacity ?? "-"} kişi</td>
                        <td style={TD}>
                          <StatusBadge status={zone.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </SectionCard>

              {selectedZoneId !== null ? (
                <SectionCard title={selectedZone?.name || "Alan Envanteri"}>
                  <div style={{ display: "grid", gap: 10 }}>
                    {(["water", "food", "med", "blanket", "ext"] as string[]).map((key) => (
                      <div key={key} style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 10, alignItems: "center" }}>
                        <label style={{ fontSize: 13, color: "#444" }}>{key}</label>
                        <input
                          type={key === "blanket" || key === "ext" ? "number" : "text"}
                          value={String(zoneInventoryEdit[key] ?? zoneInventory[key] ?? "")}
                          onChange={(event) =>
                            setZoneInventoryEdit((state) => ({
                              ...state,
                              [key]:
                                key === "blanket" || key === "ext"
                                  ? Number.parseInt(event.target.value, 10) || 0
                                  : event.target.value,
                            }))
                          }
                          style={{ padding: "7px 8px", borderRadius: 6, border: "1px solid #ccc" }}
                        />
                      </div>
                    ))}
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
                      <button
                        onClick={saveZoneInventory}
                        disabled={zoneSaveBusy}
                        style={{
                          background: "#1a237e",
                          color: "#fff",
                          border: "none",
                          borderRadius: 6,
                          padding: "8px 18px",
                          cursor: "pointer",
                        }}
                      >
                        {zoneSaveBusy ? "Kaydediliyor..." : "Kaydet"}
                      </button>
                      {zoneSaveMsg ? <span style={{ fontSize: 13 }}>{zoneSaveMsg}</span> : null}
                    </div>
                  </div>
                </SectionCard>
              ) : null}
            </div>
          )
        )}

        {activeTab === "emergency" && (
          <SectionCard
            title="Acil Bildirimler"
            action={
              <div style={{ display: "flex", gap: 10 }}>
                <select
                  value={emergencyFilter}
                  onChange={(event) => setEmergencyFilter(event.target.value)}
                  style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid #ccc" }}
                >
                  <option value="">Tümü</option>
                  <option value="new">Yeni</option>
                  <option value="reviewing">İnceleniyor</option>
                  <option value="verified">Doğrulandı</option>
                  <option value="resolved">Çözüldü</option>
                  <option value="dismissed">Reddedildi</option>
                  <option value="spam">Spam</option>
                </select>
                <button
                  onClick={clearEmergencies}
                  disabled={clearingEmergencies}
                  style={{
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    color: "#dc2626",
                    borderRadius: 6,
                    padding: "6px 12px",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  {clearingEmergencies ? "Temizleniyor..." : "Geçmişi Temizle"}
                </button>
              </div>
            }
          >
            {emergencyLoading ? (
              <div style={{ color: "#666" }}>Yükleniyor...</div>
            ) : emergencies.length === 0 ? (
              <div style={{ color: "#666" }}>Kayıt bulunamadı.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f5f5f5" }}>
                      <th style={TH}>#</th>
                      <th style={TH}>Kategori</th>
                      <th style={TH}>Açıklama</th>
                      <th style={TH}>Saat</th>
                      <th style={TH}>Konum</th>
                      <th style={TH}>Harita</th>
                      <th style={TH}>Durum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {emergencies.map((emergency) => (
                      <tr key={emergency.id}>
                        <td style={TD}>{emergency.id}</td>
                        <td style={TD}>{emergency.kategori ?? emergency.durum}</td>
                        <td style={{ ...TD, maxWidth: 200, whiteSpace: "normal", wordBreak: "break-word" }}>
                          {emergency.aciklama ?? "-"}
                        </td>
                        <td style={TD}>{emergency.saat}</td>
                        <td style={TD}>
                          {emergency.enlem != null && emergency.boylam != null
                            ? `${Number(emergency.enlem).toFixed(4)}, ${Number(emergency.boylam).toFixed(4)}`
                            : "-"}
                        </td>
                        <td style={TD}>
                          {emergency.harita_link ? (
                            <a href={emergency.harita_link} target="_blank" rel="noreferrer">
                              Haritada Gör
                            </a>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td style={TD}>
                          <select
                            value={emergency.status}
                            onChange={(event) => updateEmergencyStatus(emergency.id, event.target.value)}
                            style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid #ccc" }}
                          >
                            <option value="new">Yeni</option>
                            <option value="reviewing">İnceleniyor</option>
                            <option value="verified">Doğrulandı</option>
                            <option value="resolved">Çözüldü</option>
                            <option value="dismissed">Reddedildi</option>
                            <option value="spam">Spam</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        )}

        {activeTab === "volunteers" && (
          <SectionCard
            title="Gönüllü Başvuruları"
            action={
              <select
                value={volunteerFilter}
                onChange={(event) => setVolunteerFilter(event.target.value)}
                style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid #ccc" }}
              >
                <option value="">Tümü</option>
                <option value="pending">Bekliyor</option>
                <option value="approved">Onaylandı</option>
                <option value="rejected">Reddedildi</option>
                <option value="inactive">Pasif</option>
              </select>
            }
          >
            {volunteerLoading ? (
              <div style={{ color: "#666" }}>Yükleniyor...</div>
            ) : volunteers.length === 0 ? (
              <div style={{ color: "#666" }}>Kayıt bulunamadı.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f5f5f5" }}>
                      <th style={TH}>Ad Soyad</th>
                      <th style={TH}>İlçe / Mahalle</th>
                      <th style={TH}>Beceriler</th>
                      <th style={TH}>Müsaitlik</th>
                      <th style={TH}>İletişim</th>
                      <th style={TH}>Tarih</th>
                      <th style={TH}>Durum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {volunteers.map((volunteer) => (
                      <tr key={volunteer.id}>
                        <td style={TD}>{volunteer.full_name}</td>
                        <td style={TD}>{[volunteer.district, volunteer.neighborhood].filter(Boolean).join(" / ") || "-"}</td>
                        <td style={TD}>{volunteer.skills?.join(", ") || "-"}</td>
                        <td style={TD}>{volunteer.availability_note || "-"}</td>
                        <td style={TD}>{volunteer.contact_info}</td>
                        <td style={TD}>
                          {volunteer.created_at ? new Date(volunteer.created_at).toLocaleString("tr-TR") : "-"}
                        </td>
                        <td style={TD}>
                          <select
                            value={volunteer.status}
                            onChange={(event) => updateVolunteerStatus(volunteer.id, event.target.value)}
                            style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid #ccc" }}
                          >
                            <option value="pending">Bekliyor</option>
                            <option value="approved">Onaylandı</option>
                            <option value="rejected">Reddedildi</option>
                            <option value="inactive">Pasif</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        )}

        {activeTab === "shelters" && (
          <SectionCard
            title="Barınma Teklifleri"
            action={
              <select
                value={shelterFilter}
                onChange={(event) => setShelterFilter(event.target.value)}
                style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid #ccc" }}
              >
                <option value="">Tümü</option>
                <option value="pending">Bekliyor</option>
                <option value="approved">Onaylandı</option>
                <option value="rejected">Reddedildi</option>
                <option value="inactive">Pasif</option>
              </select>
            }
          >
            {shelterLoading ? (
              <div style={{ color: "#666" }}>Yükleniyor...</div>
            ) : shelterOffers.length === 0 ? (
              <div style={{ color: "#666" }}>Kayıt bulunamadı.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f5f5f5" }}>
                      <th style={TH}>Ev Sahibi</th>
                      <th style={TH}>Konum</th>
                      <th style={TH}>Kapasite</th>
                      <th style={TH}>Tarih</th>
                      <th style={TH}>Adres Detayı</th>
                      <th style={TH}>İletişim</th>
                      <th style={TH}>Durum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shelterOffers.map((offer) => (
                      <tr key={offer.id}>
                        <td style={TD}>{offer.host_name}</td>
                        <td style={TD}>{[offer.city, offer.district, offer.neighborhood].filter(Boolean).join(" / ") || "-"}</td>
                        <td style={TD}>{offer.capacity}</td>
                        <td style={TD}>
                          {offer.available_from || offer.available_until
                            ? `${offer.available_from || "?"} - ${offer.available_until || "?"}`
                            : offer.duration_note || "-"}
                        </td>
                        <td style={TD}>{offer.address_detail || "-"}</td>
                        <td style={TD}>{offer.contact_info}</td>
                        <td style={TD}>
                          <select
                            value={offer.status}
                            onChange={(event) => updateShelterStatus(offer.id, event.target.value)}
                            style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid #ccc" }}
                          >
                            <option value="pending">Bekliyor</option>
                            <option value="approved">Onaylandı</option>
                            <option value="rejected">Reddedildi</option>
                            <option value="inactive">Pasif</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        )}

        {activeTab === "announcements" && (
          <SectionCard title="Duyurular">
            {/* Create form */}
            <div style={{ background: "#f8f9ff", border: "1px solid #c5cae9", borderRadius: 10, padding: 20, marginBottom: 24 }}>
              <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 700, color: "#1a237e" }}>Yeni Duyuru</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <input
                  type="text"
                  placeholder="Başlık *"
                  value={annTitle}
                  onChange={(e) => setAnnTitle(e.target.value)}
                  style={{ padding: "9px 12px", borderRadius: 7, border: "1px solid #c5cae9", fontSize: 14 }}
                />
                <textarea
                  placeholder="İçerik *"
                  value={annContent}
                  onChange={(e) => setAnnContent(e.target.value)}
                  rows={4}
                  style={{ padding: "9px 12px", borderRadius: 7, border: "1px solid #c5cae9", fontSize: 14, resize: "vertical" }}
                />
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <select
                    value={annKategori}
                    onChange={(e) => setAnnKategori(e.target.value)}
                    style={{ padding: "8px 10px", borderRadius: 7, border: "1px solid #c5cae9", fontSize: 13 }}
                  >
                    <option value="genel">Genel</option>
                    <option value="uyari">Uyarı</option>
                    <option value="tahliye">Tahliye</option>
                    <option value="saglik">Sağlık</option>
                    <option value="lojistik">Lojistik</option>
                    <option value="guvenlik">Güvenlik</option>
                  </select>
                  <select
                    value={annPriority}
                    onChange={(e) => setAnnPriority(e.target.value)}
                    style={{ padding: "8px 10px", borderRadius: 7, border: "1px solid #c5cae9", fontSize: 13 }}
                  >
                    <option value="low">Normal</option>
                    <option value="normal">Önemli</option>
                    <option value="high">Acil</option>
                    <option value="critical">Kritik</option>
                  </select>
                  <button
                    onClick={() => void createAndPublishAnnouncement(true)}
                    disabled={annCreateBusy}
                    style={{ padding: "8px 18px", background: "#1a237e", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer", fontWeight: 700, fontSize: 13 }}
                  >
                    {annCreateBusy ? "..." : "Yayımla"}
                  </button>
                  <button
                    onClick={() => void createAndPublishAnnouncement(false)}
                    disabled={annCreateBusy}
                    style={{ padding: "8px 18px", background: "#78909c", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer", fontWeight: 600, fontSize: 13 }}
                  >
                    Taslak Kaydet
                  </button>
                </div>
                {annCreateMsg && <p style={{ margin: 0, fontSize: 13, color: annCreateMsg.includes("oluşturulamadı") ? "#c62828" : "#2e7d32" }}>{annCreateMsg}</p>}
              </div>
            </div>

            {/* Filters */}
            <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
              <select
                value={announcementStatusFilter}
                onChange={(e) => setAnnouncementStatusFilter(e.target.value)}
                style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid #ccc", fontSize: 13 }}
              >
                <option value="">Tüm Durumlar</option>
                <option value="draft">Taslak</option>
                <option value="published">Yayımlandı</option>
                <option value="archived">Arşivlendi</option>
              </select>
              <select
                value={announcementKategoriFilter}
                onChange={(e) => setAnnouncementKategoriFilter(e.target.value)}
                style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid #ccc", fontSize: 13 }}
              >
                <option value="">Tüm Kategoriler</option>
                <option value="genel">Genel</option>
                <option value="uyari">Uyarı</option>
                <option value="tahliye">Tahliye</option>
                <option value="saglik">Sağlık</option>
                <option value="lojistik">Lojistik</option>
                <option value="guvenlik">Güvenlik</option>
              </select>
            </div>

            {/* Table */}
            {announcementsLoading ? (
              <div style={{ color: "#666" }}>Yükleniyor...</div>
            ) : announcements.length === 0 ? (
              <div style={{ color: "#666" }}>Duyuru bulunamadı.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f5f5f5" }}>
                      <th style={TH}>#</th>
                      <th style={TH}>Başlık</th>
                      <th style={TH}>Kategori</th>
                      <th style={TH}>Öncelik</th>
                      <th style={TH}>Durum</th>
                      <th style={TH}>Yayım Tarihi</th>
                      <th style={TH}>İşlem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {announcements.map((ann) => (
                      <tr key={ann.id}>
                        <td style={TD}>{ann.id}</td>
                        <td style={{ ...TD, maxWidth: 240, whiteSpace: "normal", wordBreak: "break-word" }}>{ann.title}</td>
                        <td style={TD}>{ann.kategori ?? "-"}</td>
                        <td style={TD}>
                          <span style={{ ...(STATUS_STYLE[ann.priority === "critical" ? "risky" : ann.priority === "high" ? "maintenance" : ann.priority === "normal" ? "reviewing" : "inactive"] ?? {}), borderRadius: 12, padding: "2px 8px", fontSize: 12 }}>
                            {ann.priority === "critical" ? "Kritik" : ann.priority === "high" ? "Acil" : ann.priority === "normal" ? "Önemli" : "Normal"}
                          </span>
                        </td>
                        <td style={TD}>
                          <select
                            value={ann.status}
                            onChange={(e) => void updateAnnouncementStatus(ann.id, e.target.value)}
                            style={{ padding: "5px 7px", borderRadius: 6, border: "1px solid #ccc", fontSize: 12 }}
                          >
                            <option value="draft">Taslak</option>
                            <option value="published">Yayımlandı</option>
                            <option value="archived">Arşivlendi</option>
                          </select>
                        </td>
                        <td style={TD}>
                          {ann.published_at
                            ? new Date(ann.published_at).toLocaleDateString("tr-TR")
                            : "-"}
                        </td>
                        <td style={TD}>
                          <button
                            onClick={() => void deleteAnnouncement(ann.id)}
                            style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}
                          >
                            Sil
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        )}

        {/* GS-083: Activity timeline tab */}
        {activeTab === "activity" && (
          <SectionCard title="Aktivite Zaman Çizelgesi">
            <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
              <input
                placeholder="Kaynak veya eylem filtrele..."
                value={auditFilter}
                onChange={(e) => setAuditFilter(e.target.value)}
                style={{ padding: "7px 12px", border: "1px solid #ddd", borderRadius: 6, fontSize: 13, minWidth: 220 }}
              />
              <button
                onClick={() => void loadAuditLog()}
                disabled={auditLoading}
                style={{ padding: "7px 14px", background: "#1a237e", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13 }}
              >
                {auditLoading ? "Yükleniyor…" : "Yenile"}
              </button>
            </div>
            {auditLoading ? (
              <div style={{ textAlign: "center", padding: 40, color: "#666" }}>Yükleniyor…</div>
            ) : auditLog.length === 0 ? (
              <div style={{ color: "#666", padding: "20px 0" }}>Kayıt bulunamadı.</div>
            ) : (
              <div style={{ position: "relative", paddingLeft: 24 }}>
                <div style={{ position: "absolute", left: 8, top: 0, bottom: 0, width: 2, background: "#e0e0e0" }} />
                {auditLog
                  .filter((e) =>
                    !auditFilter ||
                    e.resource_type.includes(auditFilter) ||
                    e.action.includes(auditFilter) ||
                    (e.user_email ?? "").includes(auditFilter)
                  )
                  .map((entry) => (
                    <div key={entry.id} style={{ display: "flex", gap: 12, marginBottom: 14, position: "relative" }}>
                      <div
                        style={{
                          position: "absolute",
                          left: -20,
                          top: 4,
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          background: entry.action === "delete" ? "#C62828" : entry.action === "create" ? "#2E7D32" : "#1565C0",
                          border: "2px solid #fff",
                          boxShadow: "0 0 0 2px #e0e0e0",
                        }}
                      />
                      <div style={{ flex: 1, background: "#fafafa", border: "1px solid #eee", borderRadius: 8, padding: "10px 14px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 4 }}>
                          <span style={{ fontWeight: 600, fontSize: 13 }}>
                            <StatusBadge status={entry.action} /> {entry.resource_type}
                            {entry.resource_id ? <span style={{ color: "#888", marginLeft: 6 }}>#{entry.resource_id}</span> : null}
                          </span>
                          <span style={{ fontSize: 12, color: "#999" }}>
                            {entry.created_at ? new Date(entry.created_at).toLocaleString("tr-TR") : "—"}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: "#555", marginTop: 4 }}>
                          {entry.user_email ?? "Anonim"}
                          {entry.user_role ? <span style={{ marginLeft: 6, color: "#888" }}>({entry.user_role})</span> : null}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </SectionCard>
        )}

        {/* GS-061: Bulk import tab */}
        {activeTab === "import" && (
          <SectionCard title="Toplu İçe Aktarma — Depo & Toplanma Alanı">
            <p style={{ fontSize: 13, color: "#555", marginBottom: 16 }}>
              Depo veya toplanma alanı listesini JSON dizisi olarak yapıştırın. <strong>Ön İzleme</strong> seçeneği
              veri tabanına kayıt yapmaz; üretim öncesi kontrol için kullanın.
            </p>

            <div style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
              <label style={{ fontWeight: 600, fontSize: 13 }}>
                <span style={{ marginRight: 6 }}>Tür:</span>
                <select
                  value={importType}
                  onChange={(e) => setImportType(e.target.value as "warehouses" | "safe-zones")}
                  style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13 }}
                >
                  <option value="warehouses">Depolar</option>
                  <option value="safe-zones">Toplanma Alanları</option>
                </select>
              </label>
            </div>

            <details style={{ marginBottom: 12, fontSize: 12, color: "#666" }}>
              <summary style={{ cursor: "pointer", fontWeight: 600 }}>JSON formatı (örnek)</summary>
              <pre style={{ background: "#f8f8f8", padding: 12, borderRadius: 6, marginTop: 8, overflowX: "auto" }}>
                {importType === "warehouses"
                  ? `[\n  { "name": "Depo Adı", "address": "Adres", "lat": 41.01, "lon": 29.02, "capacity": 500, "status": "active" }\n]`
                  : `[\n  { "name": "Toplanma Alanı", "capacity": 300, "capacity_type": "persons", "status": "active", "lat": 41.01, "lon": 29.02 }\n]`}
              </pre>
            </details>

            <textarea
              aria-label="İçe aktarılacak JSON verisi"
              value={importJson}
              onChange={(e) => setImportJson(e.target.value)}
              placeholder={`[\n  { "name": "...", ... }\n]`}
              rows={10}
              style={{
                width: "100%", fontFamily: "monospace", fontSize: 12,
                padding: 12, border: "1px solid #d1d5db", borderRadius: 8,
                resize: "vertical", boxSizing: "border-box",
              }}
            />

            <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
              <button
                onClick={() => void runImport(true)}
                disabled={importBusy || !importJson.trim()}
                style={{ padding: "8px 18px", background: "#e0f2fe", border: "1px solid #0284c7", color: "#0369a1", borderRadius: 7, fontWeight: 600, fontSize: 13, cursor: "pointer" }}
              >
                {importBusy ? "İşleniyor..." : "Ön İzleme"}
              </button>
              <button
                onClick={() => void runImport(false)}
                disabled={importBusy || !importJson.trim()}
                style={{ padding: "8px 18px", background: "#1a237e", color: "#fff", border: "none", borderRadius: 7, fontWeight: 600, fontSize: 13, cursor: "pointer" }}
              >
                {importBusy ? "İşleniyor..." : "İçe Aktar"}
              </button>
            </div>

            {importMsg ? (
              <p style={{ marginTop: 12, fontSize: 13, color: importMsg.startsWith("Hata") ? "#dc2626" : "#16a34a", fontWeight: 600 }}>
                {importMsg}
              </p>
            ) : null}

            {importReport ? (
              <div style={{ marginTop: 16, padding: 16, background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8 }}>
                <strong style={{ fontSize: 14 }}>İçe Aktarma Raporu</strong>
                <div style={{ display: "flex", gap: 24, marginTop: 10, flexWrap: "wrap" }}>
                  <span style={{ color: "#16a34a", fontWeight: 700, fontSize: 20 }}>{importReport.created} <small style={{ fontWeight: 400, fontSize: 13 }}>oluşturuldu</small></span>
                  <span style={{ color: "#2563eb", fontWeight: 700, fontSize: 20 }}>{importReport.updated} <small style={{ fontWeight: 400, fontSize: 13 }}>güncellendi</small></span>
                  <span style={{ color: "#6b7280", fontWeight: 700, fontSize: 20 }}>{importReport.skipped} <small style={{ fontWeight: 400, fontSize: 13 }}>atlandı</small></span>
                  {importReport.errors.length > 0 && (
                    <span style={{ color: "#dc2626", fontWeight: 700, fontSize: 20 }}>{importReport.errors.length} <small style={{ fontWeight: 400, fontSize: 13 }}>hata</small></span>
                  )}
                </div>
                {importReport.errors.length > 0 ? (
                  <table style={{ marginTop: 12, width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th style={TH}>Satır</th>
                        <th style={TH}>Ad</th>
                        <th style={TH}>Hata</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importReport.errors.map((err) => (
                        <tr key={`${err.row}-${err.name}`}>
                          <td style={TD}>{err.row}</td>
                          <td style={TD}>{err.name}</td>
                          <td style={{ ...TD, color: "#dc2626" }}>{err.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : null}
              </div>
            ) : null}
          </SectionCard>
        )}
      </main>
    </div>
  );
}
