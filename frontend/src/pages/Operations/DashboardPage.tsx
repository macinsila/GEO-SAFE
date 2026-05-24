import React, { useEffect, useMemo, useState } from "react";
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
  Tone,
  announcementTone,
  loadAnnouncementCache,
  saveAnnouncementCache,
  toneLabel,
} from "./opsUi";

type DecisionTone = Tone;

interface DecisionItem {
  label: string;
  detail: string;
  action: string;
  path: string;
  tone: DecisionTone;
}

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
    detail: "Resmi bilgi akışına hızlı erişim.",
    path: "/ops/announcements",
    tone: "neutral" as const,
  },
];

function formatNumber(value: number) {
  return value.toLocaleString("tr-TR");
}

function getDecisionTone(emergencyCount: number, criticalStockCount: number, inactiveZoneCount: number): DecisionTone {
  if (emergencyCount > 0) return "critical";
  if (criticalStockCount > 0 || inactiveZoneCount > 0) return "warning";
  return "safe";
}

function getDecisionLabel(tone: DecisionTone) {
  if (tone === "critical") return "Müdahale";
  if (tone === "warning") return "Yakın İzleme";
  return "Operasyon Hazır";
}

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
  const [loadErrors, setLoadErrors] = useState<string[]>([]);
  const [selectedBriefTag, setSelectedBriefTag] = useState(VIDEO_CARDS[0].tag);

  useEffect(() => {
    let mounted = true;

    const loadOverview = async () => {
      setLoading(true);
      setLoadErrors([]);

      const results = await Promise.allSettled([
        geoSafeAPI.fetchWarehouses(),
        geoSafeAPI.fetchSafeZones(),
        role === "admin" ? geoSafeAPI.fetchCriticalStockAdmin() : Promise.resolve([]),
        role === "admin" ? geoSafeAPI.fetchEmergenciesAdmin("new") : Promise.resolve([]),
        geoSafeAPI.fetchAnnouncements(),
      ]);

      if (!mounted) return;

      const [warehouseResult, zoneResult, stockResult, emergencyResult, announcementResult] = results;
      const nextErrors: string[] = [];

      if (warehouseResult.status === "fulfilled") setWarehouses(warehouseResult.value);
      else nextErrors.push("Depo verisi alınamadı.");

      if (zoneResult.status === "fulfilled") setSafeZones(zoneResult.value);
      else nextErrors.push("Barınma alanları alınamadı.");

      if (stockResult.status === "fulfilled") setCriticalStock(stockResult.value);
      else if (role === "admin") nextErrors.push("Kritik stok verisi alınamadı.");

      if (emergencyResult.status === "fulfilled") setEmergencies(emergencyResult.value);
      else if (role === "admin") nextErrors.push("Acil bildirimler alınamadı.");

      if (announcementResult.status === "fulfilled") {
        saveAnnouncementCache(announcementResult.value);
        setAnnouncements(announcementResult.value.slice(0, 3));
      } else {
        nextErrors.push("Duyuru akışı güncellenemedi.");
      }

      setLoadErrors(nextErrors);
      setLoading(false);
    };

    void loadOverview();

    return () => {
      mounted = false;
    };
  }, [role]);

  const activeWarehouses = warehouses.filter((warehouse) => warehouse.status === "active").length;
  const activeSafeZones = safeZones.filter((zone) => zone.status === "active").length;
  const inactiveSafeZones = safeZones.length - activeSafeZones;
  const totalCapacity = safeZones.reduce((sum, zone) => sum + (zone.capacity ?? 0), 0);
  const criticalWarehouseCount = new Set(criticalStock.map((row) => row.warehouse_id)).size;
  const selectedBrief = VIDEO_CARDS.find((card) => card.tag === selectedBriefTag) ?? VIDEO_CARDS[0];
  const decisionTone = getDecisionTone(emergencies.length, criticalStock.length, inactiveSafeZones);
  const lastUpdated = new Date().toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const readinessScore = useMemo(() => {
    if (loading) return null;
    let score = 100;
    if (!activeWarehouses) score -= 30;
    if (!activeSafeZones) score -= 30;
    score -= Math.min(criticalWarehouseCount * 10, 25);
    score -= Math.min(emergencies.length * 12, 30);
    score -= Math.min(inactiveSafeZones * 4, 15);
    return Math.max(score, 0);
  }, [activeSafeZones, activeWarehouses, criticalWarehouseCount, emergencies.length, inactiveSafeZones, loading]);

  const decisionItems: DecisionItem[] = [
    ...(emergencies.length
      ? [
          {
            label: "Yeni acil bildirim var",
            detail: `${emergencies.length} kayıt müdahale bekliyor.`,
            action: "Admin kuyruğunu aç",
            path: "/admin",
            tone: "critical" as const,
          },
        ]
      : []),
    ...(criticalStock.length
      ? [
          {
            label: "Kritik stok eşiği aşıldı",
            detail: `${criticalStock.length} kalem, ${criticalWarehouseCount} depoda eşik altında.`,
            action: "Stok ekranına git",
            path: "/ops/logistics",
            tone: "warning" as const,
          },
        ]
      : []),
    ...(inactiveSafeZones
      ? [
          {
            label: "Riskli barınma alanı var",
            detail: `${inactiveSafeZones} alan aktif değil veya kapasite dışı.`,
            action: "Haritada incele",
            path: "/ops/map",
            tone: "warning" as const,
          },
        ]
      : []),
    {
      label: announcements[0]?.title ?? "Resmi duyuru akışını kontrol et",
      detail: announcements[0]
        ? `${ANNOUNCEMENT_PRIORITY_LABELS[announcements[0].priority] ?? announcements[0].priority} öncelikli son duyuru.`
        : "Henüz yayınlanan duyuru yok.",
      action: "Duyurulara git",
      path: "/ops/announcements",
      tone: announcements[0] ? announcementTone(announcements[0].priority) : "neutral",
    },
  ].slice(0, 4);

  return (
    <div className="ops-page-stack">
      <section className={`decision-command ${toneLabel(decisionTone)}`} aria-label="Karar özeti">
        <div className="decision-command-main">
          <span className="ops-eyebrow">Karar Ekranı</span>
          <h1>{getDecisionLabel(decisionTone)}</h1>
          <p>
            Operasyonun anlık yönü; acil bildirimler, kritik stoklar, barınma kapasitesi ve resmi
            bilgi akışı birlikte değerlendirilerek özetlenir.
          </p>
          <div className="incident-status-row">
            <ResourceBadge tone={decisionTone}>Karar: {getDecisionLabel(decisionTone)}</ResourceBadge>
            <ResourceBadge tone={loadErrors.length ? "warning" : "info"}>
              Güncelleme {lastUpdated}
            </ResourceBadge>
            {loadErrors.length ? <ResourceBadge tone="critical">Eksik veri</ResourceBadge> : null}
          </div>
        </div>

        <div className="decision-readiness">
          <span>Hazırlık Skoru</span>
          <strong>{readinessScore === null ? "..." : readinessScore}</strong>
          <small>Depo, barınma, stok ve uyarı sinyallerinden hesaplanır.</small>
        </div>

        <div className="decision-next-actions">
          {decisionItems.slice(0, 3).map((item) => (
            <button
              key={`${item.label}-${item.path}`}
              className={`decision-action ${toneLabel(item.tone)}`}
              onClick={() => navigate(item.path)}
              type="button"
            >
              <span>{item.label}</span>
              <strong>{item.action}</strong>
            </button>
          ))}
        </div>
      </section>

      <section className="situation-metrics decision-metrics" aria-label="Ana operasyon metrikleri">
        <StatusCard
          label="Acil Bildirim"
          value={loading ? "..." : emergencies.length}
          detail={role === "admin" ? "Yeni kayıt kuyruğu" : "Admin görünümü"}
          tone={emergencies.length ? "critical" : "neutral"}
        />
        <StatusCard
          label="Kritik Stok"
          value={loading ? "..." : criticalStock.length}
          detail={role === "admin" ? `${criticalWarehouseCount} depoda eşik altı` : "Admin görünümü"}
          tone={criticalStock.length ? "warning" : "safe"}
        />
        <StatusCard
          label="Barınma Kapasitesi"
          value={loading ? "..." : formatNumber(totalCapacity)}
          detail={`${activeSafeZones} aktif alan`}
          tone={activeSafeZones ? "safe" : "warning"}
        />
        <StatusCard
          label="Aktif Depolar"
          value={loading ? "..." : activeWarehouses}
          detail={`Toplam ${warehouses.length} depo`}
          tone={activeWarehouses ? "info" : "warning"}
        />
      </section>

      {loadErrors.length ? (
        <section className="decision-data-alert" role="status">
          {loadErrors.map((error) => (
            <span key={error}>{error}</span>
          ))}
        </section>
      ) : null}

      <section className="decision-layout">
        <section className="ops-panel decision-panel-primary">
          <SectionHeader eyebrow="Öncelik Kuyruğu" title="Şimdi Ne Yapılmalı?" />
          <div className="decision-queue">
            {decisionItems.map((item, index) => (
              <article key={`${item.label}-${index}`} className={`decision-queue-item ${toneLabel(item.tone)}`}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <strong>{item.label}</strong>
                  <p>{item.detail}</p>
                </div>
                <Link className="ops-text-link" to={item.path}>
                  {item.action}
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section className="ops-panel">
          <SectionHeader eyebrow="Ekranlar" title="Operasyon Akışları" />
          <div className="ops-route-grid compact">
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
                <article
                  key={announcement.id}
                  className={`ops-announcement-preview ${toneLabel(announcementTone(announcement.priority))}`}
                >
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
          <div className="support-stack compact">
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

        <section className="ops-panel decision-brief-panel">
          <SectionHeader eyebrow="Hazırlık" title="Eğitim Özeti" />
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
