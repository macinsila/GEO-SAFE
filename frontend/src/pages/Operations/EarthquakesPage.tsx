import React, { useEffect, useState } from "react";
import { EarthquakeItem, geoSafeAPI } from "../../services";
import { EmptyState, ResourceBadge, SectionHeader, Tone, toneLabel } from "./opsUi";

function magnitudeTone(magnitude: number): Tone {
  if (magnitude >= 5) return "critical";
  if (magnitude >= 4) return "warning";
  return "safe";
}

export default function OperationsEarthquakesPage() {
  const [earthquakes, setEarthquakes] = useState<EarthquakeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadEarthquakes = async () => {
      setLoading(true);
      setLoadError(false);
      try {
        const response = await geoSafeAPI.fetchEarthquakes();
        if (mounted) setEarthquakes((response.result ?? []).slice(0, 12));
      } catch {
        if (mounted) setLoadError(true);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void loadEarthquakes();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <section className="ops-panel">
      <SectionHeader eyebrow="Bölgesel Uyarılar" title="Güncel Depremler" meta="Kandilli / son akış" />
      <div className="alert-timeline">
        {earthquakes.slice(0, 3).map((earthquake, index) => (
          <article
            key={`${earthquake.title}-timeline-${index}`}
            className={`timeline-item ${toneLabel(magnitudeTone(earthquake.mag))}`}
          >
            <span>{earthquake.mag}</span>
            <div>
              <strong>{earthquake.title}</strong>
              <small>
                {earthquake.date} / {earthquake.depth} km
              </small>
            </div>
          </article>
        ))}
        {!loading && loadError ? <EmptyState message="Deprem akışı yüklenemedi." /> : null}
        {!loading && !loadError && earthquakes.length === 0 ? (
          <EmptyState message="Uyarı zaman akışı boş." />
        ) : null}
      </div>
      <div className="ops-table-wrap">
        <table className="ops-table">
          <thead>
            <tr>
              <th>Büyüklük</th>
              <th>Konum</th>
              <th>Tarih ve Saat</th>
              <th>Derinlik</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4}>
                  <EmptyState message="Sismik akış yükleniyor..." />
                </td>
              </tr>
            ) : earthquakes.length === 0 ? (
              <tr>
                <td colSpan={4}>
                  <EmptyState message="Yakın tarihli M 3.5+ deprem kaydı yok." />
                </td>
              </tr>
            ) : (
              earthquakes.map((earthquake, index) => (
                <tr key={`${earthquake.title}-${index}`}>
                  <td>
                    <ResourceBadge tone={magnitudeTone(earthquake.mag)}>{earthquake.mag}</ResourceBadge>
                  </td>
                  <td>
                    <strong>{earthquake.title}</strong>
                  </td>
                  <td>{earthquake.date}</td>
                  <td>{earthquake.depth} km</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
