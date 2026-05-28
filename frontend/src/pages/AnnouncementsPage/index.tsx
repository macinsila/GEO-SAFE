import React from "react";
import { Link } from "react-router-dom";
import AnnouncementFeed, {
  announcementCacheAge,
} from "../../components/Announcements/AnnouncementFeed";

export default function AnnouncementsPage() {
  return (
    <main className="public-announcements-shell">
      <header className="public-announcements-topbar">
        <Link className="ops-button secondary" to="/ops">
          Operasyon paneli
        </Link>
        <div>
          <span className="ops-eyebrow">Resmi Bilgi</span>
          <h1>Duyurular</h1>
        </div>
      </header>

      <section className="public-announcements-main" aria-label="Yayınlanan duyurular">
        <div className="public-announcements-intro">
          <div>
            <span className="ops-eyebrow">Canlı Duyuru Akışı</span>
            <h2>Afet operasyonundan yayınlanan güncel bilgilendirmeler</h2>
          </div>
          <p>
            Öncelik ve kategori filtrelerini kullanarak tahliye, sağlık, lojistik ve genel
            uyarıları hızlıca ayırabilirsiniz.
          </p>
        </div>

        <div className="ops-panel public-announcements-panel">
          <AnnouncementFeed
            meta={({ isOffline, cachedAt }) =>
              isOffline ? (
                <span className="announcement-offline-badge">
                  Çevrimdışı{cachedAt ? ` / ${announcementCacheAge(cachedAt)}` : ""}
                </span>
              ) : null
            }
          />
        </div>
      </section>
    </main>
  );
}
