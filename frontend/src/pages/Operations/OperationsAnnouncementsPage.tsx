import React, { useEffect, useState } from "react";
import { geoSafeAPI } from "../../services";
import { Announcement } from "../../types";
import {
  ANNOUNCEMENT_CATEGORY_LABELS,
  ANNOUNCEMENT_PRIORITY_LABELS,
  EmptyState,
  ResourceBadge,
  SectionHeader,
  announcementTone,
  loadAnnouncementCache,
  saveAnnouncementCache,
  toneLabel,
} from "./opsUi";

function cacheAge(cachedAt: string) {
  const diffMs = Date.now() - new Date(cachedAt).getTime();
  const hours = Math.floor(diffMs / 3_600_000);
  if (hours < 1) return "az önce";
  if (hours === 1) return "1 saat önce";
  return `${hours} saat önce`;
}

export default function OperationsAnnouncementsPage() {
  const cachedAnnouncements = loadAnnouncementCache();
  const [announcements, setAnnouncements] = useState<Announcement[]>(
    cachedAnnouncements?.items ?? []
  );
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [cachedAt, setCachedAt] = useState<string | null>(
    cachedAnnouncements?.cachedAt ?? null
  );
  const [priorityFilter, setPriorityFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  useEffect(() => {
    let mounted = true;

    const loadAnnouncements = async () => {
      setLoading(true);
      try {
        const items = await geoSafeAPI.fetchAnnouncements();
        if (!mounted) return;
        setAnnouncements(items);
        setIsOffline(false);
        setCachedAt(null);
        saveAnnouncementCache(items);
      } catch {
        if (!mounted) return;
        const cache = loadAnnouncementCache();
        setAnnouncements(cache?.items ?? []);
        setCachedAt(cache?.cachedAt ?? null);
        setIsOffline(true);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void loadAnnouncements();

    return () => {
      mounted = false;
    };
  }, []);

  const filteredAnnouncements = announcements.filter((announcement) => {
    if (priorityFilter && announcement.priority !== priorityFilter) return false;
    if (categoryFilter && announcement.kategori !== categoryFilter) return false;
    return true;
  });

  const toggleExpanded = (announcementId: number) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(announcementId)) next.delete(announcementId);
      else next.add(announcementId);
      return next;
    });
  };

  return (
    <section className="ops-panel">
      <SectionHeader
        eyebrow="Resmi Bilgi"
        title="Duyurular"
        meta={isOffline && cachedAt ? `Çevrimdışı / ${cacheAge(cachedAt)}` : "Yayınlanan akış"}
      />
      <div className="ops-announcement-toolbar">
        <div className="filter-toolbar" aria-label="Duyuru oncelik filtresi">
          {[
            { value: "", label: "Tümü" },
            { value: "critical", label: "Kritik" },
            { value: "high", label: "Acil" },
            { value: "normal", label: "Önemli" },
            { value: "low", label: "Normal" },
          ].map((option) => (
            <button
              key={option.value || "all"}
              className={priorityFilter === option.value ? "active" : ""}
              onClick={() => setPriorityFilter(option.value)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>

        <label className="ops-select-field">
          <span>Kategori</span>
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
            <option value="">Tüm Kategoriler</option>
            {Object.entries(ANNOUNCEMENT_CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading && announcements.length === 0 ? (
        <EmptyState message="Duyurular yükleniyor..." />
      ) : filteredAnnouncements.length === 0 ? (
        <EmptyState
          message={
            announcements.length === 0
              ? "Henüz duyuru yok."
              : "Bu filtreye uyan duyuru bulunamadı."
          }
        />
      ) : (
        <div className="ops-announcement-feed">
          {filteredAnnouncements.map((announcement) => {
            const expandedAnnouncement = expanded.has(announcement.id);
            const shortContent =
              announcement.content.length > 220
                ? `${announcement.content.slice(0, 220)}...`
                : announcement.content;

            return (
              <article
                key={announcement.id}
                className={`ops-announcement-card ${toneLabel(announcementTone(announcement.priority))}`}
              >
                <div className="ops-announcement-card-head">
                  <div>
                    <ResourceBadge tone={announcementTone(announcement.priority)}>
                      {ANNOUNCEMENT_PRIORITY_LABELS[announcement.priority] ?? announcement.priority}
                    </ResourceBadge>
                    {announcement.kategori ? (
                      <span className="ops-category-pill">
                        {ANNOUNCEMENT_CATEGORY_LABELS[announcement.kategori] ?? announcement.kategori}
                      </span>
                    ) : null}
                  </div>
                  <time>
                    {announcement.published_at
                      ? new Date(announcement.published_at).toLocaleDateString("tr-TR")
                      : new Date(announcement.created_at).toLocaleDateString("tr-TR")}
                  </time>
                </div>
                <h3>{announcement.title}</h3>
                <p>{expandedAnnouncement ? announcement.content : shortContent}</p>
                {announcement.content.length > 220 ? (
                  <button
                    className="ops-inline-action"
                    onClick={() => toggleExpanded(announcement.id)}
                    type="button"
                  >
                    {expandedAnnouncement ? "Daha az göster" : "Devamını gör"}
                  </button>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
