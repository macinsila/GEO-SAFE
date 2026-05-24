import React from "react";
import AnnouncementFeed, {
  announcementCacheAge,
} from "../../components/Announcements/AnnouncementFeed";
import { SectionHeader } from "./opsUi";

export default function OperationsAnnouncementsPage() {
  return (
    <section className="ops-panel">
      <SectionHeader eyebrow="Resmi Bilgi" title="Duyurular" meta="Yayınlanan akış" />
      <AnnouncementFeed
        meta={({ isOffline, cachedAt }) =>
          isOffline && cachedAt ? (
            <span className="announcement-offline-badge">
              Çevrimdışı / {announcementCacheAge(cachedAt)}
            </span>
          ) : null
        }
      />
    </section>
  );
}
