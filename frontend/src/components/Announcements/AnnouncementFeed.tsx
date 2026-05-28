import React, { useEffect, useState } from "react";
import { geoSafeAPI } from "../../services";
import { Announcement } from "../../types";
import {
  ANNOUNCEMENT_CATEGORY_LABELS,
  ANNOUNCEMENT_PRIORITY_LABELS,
  announcementCacheAge,
  announcementDate,
  announcementTone,
  loadAnnouncementCache,
  saveAnnouncementCache,
  toneLabel,
} from "./announcementUtils";

interface AnnouncementFeedProps {
  className?: string;
  emptyLabel?: string;
  meta?: (state: { isOffline: boolean; cachedAt: string | null; loading: boolean }) => React.ReactNode;
  showToolbar?: boolean;
}

const PRIORITY_OPTIONS = [
  { value: "", label: "Tümü" },
  { value: "critical", label: "Kritik" },
  { value: "high", label: "Acil" },
  { value: "normal", label: "Önemli" },
  { value: "low", label: "Normal" },
];

const CONTENT_PREVIEW_LENGTH = 220;

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default function AnnouncementFeed({
  className,
  emptyLabel = "Henüz duyuru yok.",
  meta,
  showToolbar = true,
}: AnnouncementFeedProps) {
  const cachedAnnouncements = loadAnnouncementCache();
  const [announcements, setAnnouncements] = useState<Announcement[]>(
    cachedAnnouncements?.items ?? []
  );
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [cachedAt, setCachedAt] = useState<string | null>(cachedAnnouncements?.cachedAt ?? null);
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

  const metaContent = meta?.({ isOffline, cachedAt, loading });

  return (
    <div className={className}>
      {metaContent ? <div className="announcement-feed-meta">{metaContent}</div> : null}

      {showToolbar ? (
        <div className="ops-announcement-toolbar">
          <div className="filter-toolbar" aria-label="Duyuru öncelik filtresi">
            {PRIORITY_OPTIONS.map((option) => (
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
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
            >
              <option value="">Tüm Kategoriler</option>
              {Object.entries(ANNOUNCEMENT_CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      {loading && announcements.length === 0 ? (
        <div className="ops-empty">Duyurular yükleniyor...</div>
      ) : filteredAnnouncements.length === 0 ? (
        <div className="ops-empty">
          {announcements.length === 0 ? emptyLabel : "Bu filtreye uyan duyuru bulunamadı."}
        </div>
      ) : (
        <div className="ops-announcement-feed">
          {filteredAnnouncements.map((announcement) => {
            const expandedAnnouncement = expanded.has(announcement.id);
            const shortContent =
              announcement.content.length > CONTENT_PREVIEW_LENGTH
                ? `${announcement.content.slice(0, CONTENT_PREVIEW_LENGTH)}...`
                : announcement.content;

            return (
              <article
                key={announcement.id}
                className={`ops-announcement-card ${toneLabel(announcementTone(announcement.priority))}`}
              >
                <div className="ops-announcement-card-head">
                  <div>
                    <span className={`resource-badge ${toneLabel(announcementTone(announcement.priority))}`}>
                      {ANNOUNCEMENT_PRIORITY_LABELS[announcement.priority] ?? announcement.priority}
                    </span>
                    {announcement.kategori ? (
                      <span className="ops-category-pill">
                        {ANNOUNCEMENT_CATEGORY_LABELS[announcement.kategori] ?? announcement.kategori}
                      </span>
                    ) : null}
                  </div>
                  <time dateTime={announcementDate(announcement)}>
                    {formatDate(announcementDate(announcement))}
                  </time>
                </div>
                <h3>{announcement.title}</h3>
                <p>{expandedAnnouncement ? announcement.content : shortContent}</p>
                {announcement.content.length > CONTENT_PREVIEW_LENGTH ? (
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
    </div>
  );
}

export { announcementCacheAge };
