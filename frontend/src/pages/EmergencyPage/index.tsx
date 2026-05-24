import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FieldError, FormStatus } from "../../components/FormUX";
import {
  OfflineConsentNotice,
  useOfflineQueue,
} from "../../offlineQueue/context";
import { geoSafeAPI } from "../../services";

type Phase = "form" | "loading" | "done" | "error";
type EmergencyErrors = Partial<Record<"kategori" | "manualLat" | "manualLon" | "queue", string>>;

const CATEGORIES = [
  { label: "Enkaz Altındayım", value: "Enkaz Altindayim" },
  { label: "Yaralıyım", value: "Yaraliyim" },
  { label: "Yangın Var", value: "Yangin Var" },
  { label: "Sel Var", value: "Sel Var" },
  { label: "Diğer Acil", value: "Diger Acil" },
];

function validateManualCoordinates(latValue: string, lonValue: string) {
  const errors: EmergencyErrors = {};
  const lat = Number(latValue);
  const lon = Number(lonValue);
  if (!latValue.trim() || Number.isNaN(lat) || lat < -90 || lat > 90) {
    errors.manualLat = "Geçerli bir enlem girin. Örn. 41.01";
  }
  if (!lonValue.trim() || Number.isNaN(lon) || lon < -180 || lon > 180) {
    errors.manualLon = "Geçerli bir boylam girin. Örn. 28.97";
  }
  return errors;
}

export default function EmergencyPage() {
  const navigate = useNavigate();
  const { isOnline, submitOrQueue } = useOfflineQueue();
  const [phase, setPhase] = useState<Phase>("form");
  const [sentMsg, setSentMsg] = useState("");
  const [sentQueued, setSentQueued] = useState(false);
  const [errors, setErrors] = useState<EmergencyErrors>({});

  const [kategori, setKategori] = useState(CATEGORIES[0].value);
  const [aciklama, setAciklama] = useState("");
  const [manualLat, setManualLat] = useState("");
  const [manualLon, setManualLon] = useState("");
  const [needManual, setNeedManual] = useState(false);
  const [queueConsent, setQueueConsent] = useState(false);
  const [needsConsent, setNeedsConsent] = useState(false);

  const send = async (lat: number, lon: number) => {
    setPhase("loading");
    setErrors({});
    const saat = new Date().toLocaleString("tr-TR");
    const haritaLink = `https://www.google.com/maps?q=${lat},${lon}`;
    try {
      const result = await submitOrQueue({
        type: "emergency",
        payload: {
          durum: kategori,
          kategori,
          aciklama: aciklama.trim() || undefined,
          saat,
          harita_link: haritaLink,
          enlem: lat,
          boylam: lon,
        },
        hasConsent: isOnline ? true : queueConsent,
        submitOnline: async (payload) => {
          await geoSafeAPI.sendEmergency(payload);
        },
      });

      if (result === "consent_required") {
        setNeedsConsent(true);
        setErrors({ queue: "Çevrimdışı kayıt için açık onay vermelisiniz." });
        setPhase("form");
        return;
      }

      setSentQueued(result === "queued");
      setSentMsg(
        result === "queued"
          ? `${kategori} bildirimi internet gelince gönderilecek.`
          : `${kategori} bildirimi operasyon ekibine iletildi.`
      );
      setNeedsConsent(false);
      setQueueConsent(false);
      setPhase("done");
    } catch {
      setErrors({ queue: "Sunucuya bağlanılamadı. Konum ve bağlantıyı kontrol edip tekrar deneyin." });
      setPhase("error");
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!kategori) {
      setErrors({ kategori: "Yardım kategorisi seçin." });
      return;
    }

    if (needManual) {
      const nextErrors = validateManualCoordinates(manualLat, manualLon);
      if (Object.keys(nextErrors).length > 0) {
        setErrors(nextErrors);
        return;
      }
      await send(Number(manualLat), Number(manualLon));
      return;
    }

    setPhase("loading");
    setErrors({});
    navigator.geolocation.getCurrentPosition(
      (pos) => void send(pos.coords.latitude, pos.coords.longitude),
      () => {
        setNeedManual(true);
        setErrors({ manualLat: "Konum izni alınamadı. Koordinatı manuel girin." });
        setPhase("form");
      },
      { timeout: 6000 }
    );
  };

  return (
    <div className="emergency-form-shell">
      <main className="emergency-form-main">
        <button className="ops-button secondary emergency-back-button" onClick={() => navigate("/")} type="button">
          Ana Sayfa
        </button>

        <div className="emergency-form-head">
          <span className="ops-eyebrow">Acil Bildirim</span>
          <h1>Acil Durum</h1>
          <p>Yardım kategorisini seçin, açıklama ekleyin. Konumunuz otomatik alınır.</p>
        </div>

        {phase === "loading" ? (
          <FormStatus tone="info" title="Kaydediliyor">
            Konum alınıyor ve acil bildirim hazırlanıyor. Lütfen bu ekranı kapatmayın.
          </FormStatus>
        ) : null}

        {phase === "done" ? (
          <FormStatus
            tone={sentQueued ? "warning" : "success"}
            title={sentQueued ? "İnternet gelince gönderilecek" : "Bildirim kaydedildi"}
            actions={
              <>
                <button className="ops-button primary" onClick={() => navigate("/duyurular")} type="button">
                  Duyurulara Git
                </button>
                <button className="ops-button secondary" onClick={() => navigate("/")} type="button">
                  Ana Sayfaya Dön
                </button>
              </>
            }
          >
            {sentMsg}
          </FormStatus>
        ) : null}

        {phase === "error" ? (
          <FormStatus
            tone="error"
            title="Bildirim gönderilemedi"
            actions={
              <button className="ops-button danger" onClick={() => setPhase("form")} type="button">
                Tekrar Dene
              </button>
            }
          >
            {errors.queue}
          </FormStatus>
        ) : null}

        {phase === "form" ? (
          <section className="ops-panel public-form-card emergency-form-card">
            {(needsConsent || !isOnline) ? (
              <OfflineConsentNotice checked={queueConsent} onChange={setQueueConsent} />
            ) : null}

            {errors.queue ? <FormStatus tone="error" title="Form gönderilemedi">{errors.queue}</FormStatus> : null}

            <form className="public-form-grid" onSubmit={handleSubmit} noValidate>
              <label className="form-field danger" htmlFor="emergency-category">
                <span>Yardım Kategorisi <b>Zorunlu</b></span>
                <select
                  id="emergency-category"
                  value={kategori}
                  onChange={(event) => {
                    setKategori(event.target.value);
                    setErrors((prev) => ({ ...prev, kategori: undefined }));
                  }}
                  aria-describedby={errors.kategori ? "emergency-category-error" : undefined}
                  aria-invalid={Boolean(errors.kategori)}
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
                <FieldError id="emergency-category-error" message={errors.kategori} />
              </label>

              <label className="form-field" htmlFor="emergency-description">
                <span>Açıklama</span>
                <textarea
                  id="emergency-description"
                  value={aciklama}
                  onChange={(event) => setAciklama(event.target.value)}
                  maxLength={280}
                  rows={3}
                  placeholder="Durumunuzu kısaca açıklayın... (kat, konum ipucu vb.)"
                />
                <small>{aciklama.length}/280</small>
              </label>

              {needManual ? (
                <div className="public-form-row">
                  <label className="form-field danger" htmlFor="emergency-lat">
                    <span>Enlem <b>Zorunlu</b></span>
                    <input
                      id="emergency-lat"
                      type="number"
                      step="any"
                      placeholder="41.01"
                      value={manualLat}
                      onChange={(event) => {
                        setManualLat(event.target.value);
                        setErrors((prev) => ({ ...prev, manualLat: undefined }));
                      }}
                      aria-describedby={errors.manualLat ? "emergency-lat-error" : undefined}
                      aria-invalid={Boolean(errors.manualLat)}
                    />
                    <FieldError id="emergency-lat-error" message={errors.manualLat} />
                  </label>
                  <label className="form-field danger" htmlFor="emergency-lon">
                    <span>Boylam <b>Zorunlu</b></span>
                    <input
                      id="emergency-lon"
                      type="number"
                      step="any"
                      placeholder="28.97"
                      value={manualLon}
                      onChange={(event) => {
                        setManualLon(event.target.value);
                        setErrors((prev) => ({ ...prev, manualLon: undefined }));
                      }}
                      aria-describedby={errors.manualLon ? "emergency-lon-error" : undefined}
                      aria-invalid={Boolean(errors.manualLon)}
                    />
                    <FieldError id="emergency-lon-error" message={errors.manualLon} />
                  </label>
                </div>
              ) : null}

              <button className="ops-button danger public-form-submit" type="submit">
                Yardım Çağır
              </button>
            </form>
          </section>
        ) : null}
      </main>
    </div>
  );
}
