import { Announcement } from "../../types";

export type AnnouncementTone = "safe" | "warning" | "critical" | "info" | "neutral";

export const ANNOUNCEMENT_CACHE_KEY = "geosafe_announcements_v1";

export const ANNOUNCEMENT_PRIORITY_LABELS: Record<string, string> = {
  critical: "Kritik",
  high: "Acil",
  normal: "Önemli",
  low: "Normal",
};

export const ANNOUNCEMENT_CATEGORY_LABELS: Record<string, string> = {
  genel: "Genel",
  uyari: "Uyarı",
  tahliye: "Tahliye",
  saglik: "Sağlık",
  lojistik: "Lojistik",
  guvenlik: "Güvenlik",
};

export interface AnnouncementCache {
  items: Announcement[];
  cachedAt: string;
}

export function loadAnnouncementCache(): AnnouncementCache | null {
  try {
    const raw = localStorage.getItem(ANNOUNCEMENT_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AnnouncementCache;
  } catch {
    return null;
  }
}

export function saveAnnouncementCache(items: Announcement[]) {
  try {
    localStorage.setItem(
      ANNOUNCEMENT_CACHE_KEY,
      JSON.stringify({ items, cachedAt: new Date().toISOString() })
    );
  } catch {
    // Announcements should still render when browser storage is unavailable.
  }
}

export function announcementTone(priority: string): AnnouncementTone {
  if (priority === "critical") return "critical";
  if (priority === "high") return "warning";
  if (priority === "normal") return "info";
  return "neutral";
}

export function toneLabel(tone: AnnouncementTone) {
  return `tone-${tone}`;
}

export function announcementCacheAge(cachedAt: string) {
  const diffMs = Date.now() - new Date(cachedAt).getTime();
  const hours = Math.floor(diffMs / 3_600_000);
  if (hours < 1) return "az önce";
  if (hours === 1) return "1 saat önce";
  return `${hours} saat önce`;
}

export function announcementDate(announcement: Announcement) {
  return announcement.published_at ?? announcement.created_at;
}
