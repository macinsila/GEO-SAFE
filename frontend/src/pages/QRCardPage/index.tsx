import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";
import { geoSafeAPI } from "../../services";

interface QRPayload {
  v: number;
  name: string;
  blood: string;
  allergies: string;
  medications: string;
  conditions: string;
  disability: string;
  issued: string;
}

function encode(obj: object): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
}

function QRRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="identity-qr-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default function QRCardPage() {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [payload, setPayload] = useState<QRPayload | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [issuedAt, setIssuedAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    geoSafeAPI
      .fetchQRIdentity()
      .then((data) => {
        setPayload(data.qr_payload as unknown as QRPayload);
        setDisplayName(data.display_name);
        setIssuedAt(data.issued_at);
      })
      .catch(() => setError("Kimlik verisi yüklenemedi. Profil bilgilerini kontrol edin."))
      .finally(() => setLoading(false));
  }, []);

  const qrUrl = payload ? `${window.location.origin}/qr-result?d=${encode(payload)}` : "";
  const hasHealthInfo = Boolean(
    payload?.allergies || payload?.medications || payload?.conditions || payload?.disability
  );

  const handleDownload = useCallback(() => {
    const canvas = canvasRef.current?.querySelector("canvas");
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `geosafe-qr-${displayName.replace(/\s/g, "-") || "kimlik"}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }, [displayName]);

  const handlePrint = () => window.print();

  if (loading) {
    return (
      <div className="identity-shell">
        <main className="identity-main identity-centered">
          <div className="ops-panel identity-loading">QR kimlik yükleniyor...</div>
        </main>
      </div>
    );
  }

  if (error || !payload) {
    return (
      <div className="identity-shell">
        <main className="identity-main identity-centered">
          <section className="ops-panel identity-error-state">
            <span className="ops-eyebrow">QR Kimlik</span>
            <h1>Kimlik verisi alınamadı.</h1>
            <p>{error || "Veri yüklenemedi."}</p>
            <button className="ops-button primary" type="button" onClick={() => navigate("/profile")}>
              Profili Düzenle
            </button>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="identity-shell">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #qr-print-card, #qr-print-card * { visibility: visible !important; }
          #qr-print-card {
            position: fixed;
            inset: 0;
            width: 100%;
            max-width: none;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: none !important;
          }
        }
      `}</style>

      <header className="identity-topbar">
        <div className="identity-brand">
          <div className="ops-mark">GS</div>
          <div>
            <strong>QR Kimlik Kartı</strong>
            <span>Çevrimdışı okunabilir afet sağlık özeti</span>
          </div>
        </div>
        <div className="identity-topbar-actions">
          <button className="ops-button secondary" onClick={() => navigate("/ops")} type="button">
            Operasyona dön
          </button>
          <button className="ops-button secondary" onClick={() => navigate("/profile")} type="button">
            Profili Düzenle
          </button>
        </div>
      </header>

      <main className="identity-main">
        <section className="identity-hero identity-hero-compact">
          <div>
            <span className="ops-eyebrow">Afet Kimliği</span>
            <h1>QR kartınız paylaşmaya hazır.</h1>
            <p>
              Kart, acil müdahale için kısa sağlık özetini taşır. Boş profil alanları QR çıktısında
              gösterilmez.
            </p>
          </div>
          <span className="resource-badge tone-safe">Son üretim {issuedAt}</span>
        </section>

        <div className="identity-qr-layout">
          <section className="ops-panel identity-card-panel">
            <div
              id="qr-print-card"
              className="identity-qr-card identity-qr-card-large"
              aria-label="GeoSafe afet kimlik kartı"
            >
              <div className="identity-qr-card-head">
                <div>
                  <span className="identity-qr-brand">GeoSafe</span>
                  <span className="identity-qr-title">Afet Kimlik Kartı</span>
                  <strong className="identity-qr-name">{displayName}</strong>
                  {payload.blood ? <em>{payload.blood}</em> : null}
                </div>
                <div className="identity-qr-code">
                  <QRCodeSVG value={qrUrl} size={132} level="M" />
                </div>
              </div>

              <div className="identity-qr-fields">
                <QRRow label="Alerjiler" value={payload.allergies} />
                <QRRow label="İlaçlar" value={payload.medications} />
                <QRRow label="Kronik" value={payload.conditions} />
                <QRRow label="Kısıt" value={payload.disability} />
                {!hasHealthInfo ? <p className="identity-qr-empty">Sağlık bilgisi girilmemiş.</p> : null}
              </div>

              <p className="identity-qr-footer">QR taranınca bilgiler gösterilir · {issuedAt}</p>
            </div>

            <div ref={canvasRef} className="identity-hidden">
              <QRCodeCanvas value={qrUrl} size={360} level="M" />
            </div>

            <div className="identity-card-actions">
              <button className="ops-button primary" type="button" onClick={handleDownload}>
                PNG İndir
              </button>
              <button className="ops-button secondary" type="button" onClick={handlePrint}>
                Yazdır
              </button>
            </div>
          </section>

          <aside className="ops-panel identity-preview-panel">
            <div className="ops-section-header">
              <div>
                <span className="ops-eyebrow">Kart Davranışı</span>
                <h2>Eksik Profil Alanları</h2>
              </div>
            </div>
            <div className="identity-preview-body">
              <div className="identity-info-list">
                <div>
                  <strong>Ad bilgisi</strong>
                  <span>QR kartında adınız maskeli gösterilir. Tam kimlik numarası veya açık adres tutulmaz.</span>
                </div>
                <div>
                  <strong>Boş sağlık alanları</strong>
                  <span>Kan grubu, alerji, ilaç, kronik durum veya kısıt boşsa kartta satır açılmaz.</span>
                </div>
                <div>
                  <strong>Sağlık bilgisi yoksa</strong>
                  <span>Tarama ekranında “Sağlık bilgisi girilmemiş” mesajı görünür.</span>
                </div>
                <div>
                  <strong>Telefon ve yakın kişi</strong>
                  <span>Bu alanlar profil içinde saklanır; QR koduna yazılmaz.</span>
                </div>
              </div>

              <button className="ops-button secondary" type="button" onClick={() => navigate("/profile")}>
                Bilgileri Güncelle
              </button>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
