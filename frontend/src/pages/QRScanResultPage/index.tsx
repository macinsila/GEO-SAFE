import React, { useMemo } from "react";

interface QRPayload {
  v?: number;
  name?: string;
  blood?: string;
  allergies?: string;
  medications?: string;
  conditions?: string;
  disability?: string;
  issued?: string;
}

function decode(encoded: string): QRPayload | null {
  try {
    return JSON.parse(decodeURIComponent(escape(atob(encoded))));
  } catch {
    return null;
  }
}

function Row({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="identity-scan-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default function QRScanResultPage() {
  const payload = useMemo<QRPayload | null>(() => {
    const params = new URLSearchParams(window.location.search);
    const d = params.get("d");
    if (!d) return null;
    return decode(d);
  }, []);

  if (!payload) {
    return (
      <div className="identity-shell">
        <main className="identity-main identity-centered">
          <section className="ops-panel identity-error-state">
            <span className="ops-eyebrow">QR Tarama</span>
            <h1>Geçersiz QR Kodu</h1>
            <p>Bu QR kodu GeoSafe Afet Kimlik Kartı'na ait değil veya hasarlı.</p>
          </section>
        </main>
      </div>
    );
  }

  const hasHealthInfo = Boolean(
    payload.allergies || payload.medications || payload.conditions || payload.disability
  );

  return (
    <div className="identity-shell">
      <main className="identity-main identity-scan-main">
        <section className="identity-scan-header">
          <span className="ops-eyebrow">GeoSafe</span>
          <h1>Afet Kimlik Kartı</h1>
          <p>Kritik sağlık bilgileri</p>
        </section>

        <section className="ops-panel identity-scan-card" aria-label="Taranan afet kimlik kartı">
          <div className="identity-scan-person">
            <strong>{payload.name || "Ad bilgisi yok"}</strong>
            {payload.blood ? <span>{payload.blood}</span> : null}
          </div>

          <div className="identity-scan-rows">
            <Row label="Alerjiler" value={payload.allergies} />
            <Row label="İlaçlar" value={payload.medications} />
            <Row label="Kronik" value={payload.conditions} />
            <Row label="Kısıt" value={payload.disability} />
            {!hasHealthInfo ? <p className="identity-qr-empty">Sağlık bilgisi girilmemiş.</p> : null}
          </div>
        </section>

        <section className="identity-scan-note">
          <strong>Sağlık personeli için not</strong>
          <p>Bu bilgiler afet kimlik sahibi tarafından beyan edilmiştir. Klinik karar için doğrulayınız.</p>
        </section>

        {payload.issued ? <p className="identity-scan-meta">Kart tarihi: {payload.issued}</p> : null}

        <p className="identity-scan-meta">
          Bu sayfa çevrimdışı çalışır; sunucu bağlantısı gerekmez.
        </p>
      </main>
    </div>
  );
}
