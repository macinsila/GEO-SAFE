import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { geoSafeAPI } from "../../services";
import {
  Announcement,
  CriticalStockRecord,
  EmergencyAdminRecord,
  SafeZone,
  Warehouse,
} from "../../types";
import {
  ANNOUNCEMENT_PRIORITY_LABELS,
  EmptyState,
  ResourceBadge,
  SectionHeader,
  StatusCard,
  SUPPORT_CARDS,
  VIDEO_CARDS,
  announcementTone,
  loadAnnouncementCache,
  saveAnnouncementCache,
  toneLabel,
} from "./opsUi";

const OPERATION_LINKS = [
  {
    title: "Operasyon Haritası",
    detail: "Toplanma alanları, depolar ve rota desteği.",
    path: "/ops/map",
    tone: "safe" as const,
  },
  {
    title: "Sismik Aktivite",
    detail: "Güncel deprem akışına odaklı tablo.",
    path: "/ops/earthquakes",
    tone: "warning" as const,
  },
  {
    title: "Lojistik ve Stok",
    detail: "Depo durumu ve kritik stok kontrolü.",
    path: "/ops/logistics",
    tone: "info" as const,
  },
  {
    title: "Duyurular",
    detail: "Resmi bilgi akisina hizli erisim.",
    path: "/ops/announcements",
    tone: "neutral" as const,
  },
];

export default function OperationsDashboardPage() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const cachedAnnouncements = loadAnnouncementCache();

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [safeZones, setSafeZones] = useState<SafeZone[]>([]);
  const [criticalStock, setCriticalStock] = useState<CriticalStockRecord[]>([]);
  const [emergencies, setEmergencies] = useState<EmergencyAdminRecord[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>(
    cachedAnnouncements?.items.slice(0, 3) ?? []
  );
  const [loading, setLoading] = useState(true);
  const [selectedBriefTag, setSelectedBriefTag] = useState(VIDEO_CARDS[0].tag);

  useEffect(() => {
    let mounted = true;

    const loadOverview = async () => {
      setLoading(true);
      const results = await Promise.allSettled([
        geoSafeAPI.fetchWarehouses(),
        geoSafeAPI.fetchSafeZones(),
        role === "admin" ? geoSafeAPI.fetchCriticalStockAdmin() : Promise.resolve([]),
        role === "admin" ? geoSafeAPI.fetchEmergenciesAdmin("new") : Promise.resolve([]),
        geoSafeAPI.fetchAnnouncements(),
      ]);

      if (!mounted) return;

      const [warehouseResult, zoneResult, stockResult, emergencyResult, announcementResult] = results;
      if (warehouseResult.status === "fulfilled") setWarehouses(warehouseResult.value);
      if (zoneResult.status === "fulfilled") setSafeZones(zoneResult.value);
      if (stockResult.status === "fulfilled") setCriticalStock(stockResult.value);
      if (emergencyResult.status === "fulfilled") setEmergencies(emergencyResult.value);
      if (announcementResult.status === "fulfilled") {
        saveAnnouncementCache(announcementResult.value);
        setAnnouncements(announcementResult.value.slice(0, 3));
      }
      setLoading(false);
    };

    void loadOverview();

    return () => {
      mounted = false;
    };
  }, [role]);

  const activeWarehouses = warehouses.filter((warehouse) => warehouse.status === "active").length;
  const activeSafeZones = safeZones.filter((zone) => zone.status === "active").length;
  const totalCapacity = safeZones.reduce((sum, zone) => sum + (zone.capacity ?? 0), 0);
  const selectedBrief = VIDEO_CARDS.find((card) => card.tag === selectedBriefTag) ?? VIDEO_CARDS[0];
  const lastUpdated = new Date().toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="ops-page-stack">
      <section className="situation-strip" aria-label="Durum özeti">
        <div className="incident-hero">
          <span className="ops-eyebrow">Durum Özeti</span>
          <h1>Afet Operasyon Merkezi</h1>
          <p>
            Operasyon ekranları harita, sismik akış, lojistik ve resmi bilgi kanallarına ayrıldı.
            İlk kararlar için özet metrikleri burada izleyin.
          </p>
          <div className="incident-status-row">
            <ResourceBadge tone="safe">Canlı backend</ResourceBadge>
            <ResourceBadge tone={criticalStock.length ? "warning" : "info"}>
              Güncelleme {lastUpdated}
            </ResourceBadge>
          </div>
        </div>
        <div className="situation-metrics">
          <StatusCard
            label="Aktif Depolar"
            value={loading ? "..." : activeWarehouses}
            detail={`Toplam ${warehouses.length} depo`}
            tone="info"
          />
          <StatusCard
            label="Barınma Kapasitesi"
            value={loading ? "..." : totalCapacity || "-"}
            detail={`${activeSafeZones} aktif alan`}
            tone="safe"
          />
          <StatusCard
            label="Kritik Stok"
            value={loading ? "..." : criticalStock.length}
            detail={role === "admin" ? "Eşik altındaki kalemler" : "Admin görünümü"}
            tone={criticalStock.length ? "warning" : "neutral"}
          />
          <StatusCard
            label="Açık Uyarılar"
            value={loading ? "..." : emergencies.length}
            detail={role === "admin" ? "Yeni acil durum kayıtları" : "Admin görünümü"}
            tone={emergencies.length ? "critical" : "neutral"}
          />
        </div>
      </section>

      <section className="ops-dashboard-grid">
        <section className="ops-panel">
          <SectionHeader eyebrow="Ekranlar" title="Operasyon Akışları" />
          <div className="ops-route-grid">
            {OPERATION_LINKS.map((item) => (
              <Link key={item.path} className={`ops-route-card ${toneLabel(item.tone)}`} to={item.path}>
                <strong>{item.title}</strong>
                <span>{item.detail}</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="ops-panel">
          <SectionHeader eyebrow="Resmi Bilgi" title="Son Duyurular" />
          {announcements.length === 0 ? (
            <EmptyState message="Henüz duyuru yok." />
          ) : (
            <div className="ops-announcement-preview-list">
              {announcements.map((announcement) => (
                <article key={announcement.id} className={`ops-announcement-preview ${toneLabel(announcementTone(announcement.priority))}`}>
                  <div>
                    <ResourceBadge tone={announcementTone(announcement.priority)}>
                      {ANNOUNCEMENT_PRIORITY_LABELS[announcement.priority] ?? announcement.priority}
                    </ResourceBadge>
                    <span>
                      {announcement.published_at
                        ? new Date(announcement.published_at).toLocaleDateString("tr-TR")
                        : ""}
                    </span>
                  </div>
                  <strong>{announcement.title}</strong>
                </article>
              ))}
              <Link className="ops-text-link" to="/ops/announcements">
                Tüm duyurular
              </Link>
            </div>
          )}
        </section>

        <section className="ops-panel">
          <SectionHeader eyebrow="Saha Eylemleri" title="Destek Başvuruları" />
          <div className="support-stack">
            {SUPPORT_CARDS.map((card) => (
              <button
                key={card.title}
                className={`support-card ${toneLabel(card.tone)}`}
                onClick={() => navigate(card.path)}
                type="button"
              >
                <strong>{card.title}</strong>
                <span>{card.desc}</span>
                <b>{card.action}</b>
              </button>
            ))}
          </div>
        </section>

        <section className="ops-panel">
          <SectionHeader eyebrow="Hazırlık" title="Eğitim Özetleri" />
          <div className="brief-list">
            {VIDEO_CARDS.map((card) => (
              <button
                key={card.tag}
                className={`brief-link ${selectedBriefTag === card.tag ? "active" : ""}`}
                onClick={() => setSelectedBriefTag(card.tag)}
                type="button"
              >
                <span>{card.tag}</span>
                <strong>{card.title}</strong>
              </button>
            ))}
          </div>
          <article className="readiness-brief" aria-live="polite">
            <div>
              <span className="ops-eyebrow">{selectedBrief.tag}</span>
              <h3>{selectedBrief.title}</h3>
              <p>{selectedBrief.summary}</p>
            </div>
            <ul>
              {selectedBrief.guidance.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <a href={selectedBrief.url} target="_blank" rel="noreferrer">
              Kaynak videosunu aç
            </a>
          </article>
        </section>
      </section>
    </div>
  );
}
