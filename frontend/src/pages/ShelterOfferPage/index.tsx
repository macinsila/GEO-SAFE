import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FieldError, FormStatus } from "../../components/FormUX";
import {
  OfflineConsentNotice,
  useOfflineQueue,
} from "../../offlineQueue/context";
import { geoSafeAPI } from "../../services";
import { ShelterOfferPayload } from "../../types";

type ShelterErrors = Partial<Record<keyof ShelterOfferPayload | "queue", string>>;
type SubmitState = "idle" | "submitting" | "submitted" | "queued" | "error";

const emptyForm: ShelterOfferPayload = {
  host_name: "",
  contact_info: "",
  city: "",
  district: "",
  neighborhood: "",
  address_detail: "",
  capacity: 1,
  available_from: "",
  available_until: "",
  duration_note: "",
  household_notes: "",
  suitability_notes: "",
};

function validateShelter(form: ShelterOfferPayload) {
  const errors: ShelterErrors = {};
  if (!form.host_name.trim()) errors.host_name = "Ev sahibi adı zorunludur.";
  if (!form.contact_info.trim()) errors.contact_info = "Telefon veya erişilebilir iletişim bilgisi girin.";
  if (!Number.isFinite(Number(form.capacity)) || Number(form.capacity) < 1) {
    errors.capacity = "Kapasite en az 1 kişi olmalıdır.";
  }
  if (form.available_from && form.available_until && form.available_until < form.available_from) {
    errors.available_until = "Bitiş tarihi başlangıç tarihinden önce olamaz.";
  }
  return errors;
}

export default function ShelterOfferPage() {
  const navigate = useNavigate();
  const { isOnline, submitOrQueue } = useOfflineQueue();
  const [form, setForm] = useState<ShelterOfferPayload>(emptyForm);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [errors, setErrors] = useState<ShelterErrors>({});
  const [queueConsent, setQueueConsent] = useState(false);
  const [needsConsent, setNeedsConsent] = useState(false);

  const sending = submitState === "submitting";

  const update = <K extends keyof ShelterOfferPayload>(key: K, value: ShelterOfferPayload[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
    if (submitState === "error") setSubmitState("idle");
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors = validateShelter(form);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setSubmitState("error");
      return;
    }

    setSubmitState("submitting");
    setErrors({});
    try {
      const payload: ShelterOfferPayload = {
        ...form,
        capacity: Number(form.capacity || 1),
        city: form.city?.trim() || undefined,
        district: form.district?.trim() || undefined,
        neighborhood: form.neighborhood?.trim() || undefined,
        address_detail: form.address_detail?.trim() || undefined,
        available_from: form.available_from || undefined,
        available_until: form.available_until || undefined,
        duration_note: form.duration_note?.trim() || undefined,
        household_notes: form.household_notes?.trim() || undefined,
        suitability_notes: form.suitability_notes?.trim() || undefined,
      };
      const result = await submitOrQueue({
        type: "shelter",
        payload,
        hasConsent: isOnline ? true : queueConsent,
        submitOnline: async (nextPayload) => {
          await geoSafeAPI.submitShelterOffer(nextPayload);
        },
      });

      if (result === "consent_required") {
        setNeedsConsent(true);
        setErrors({ queue: "Çevrimdışı kayıt için açık onay vermelisiniz." });
        setSubmitState("error");
        return;
      }

      setNeedsConsent(false);
      setQueueConsent(false);
      setForm(emptyForm);
      setSubmitState(result === "queued" ? "queued" : "submitted");
    } catch {
      setErrors({ queue: "Teklif gönderilemedi. Bağlantıyı kontrol edip tekrar deneyin." });
      setSubmitState("error");
    }
  };

  return (
    <div className="public-form-shell">
      <main className="public-form-main wide">
        <button className="ops-button secondary" onClick={() => navigate("/")} type="button">
          Ana Sayfa
        </button>

        <section className="ops-panel public-form-card">
          <div className="public-form-head">
            <span className="ops-eyebrow">Barınma Desteği</span>
            <h1>Evimi barınma desteği için bildirmek istiyorum</h1>
            <p>
              Bu bilgiler halka açık paylaşılmaz. Başvurular yetkililer tarafından değerlendirilir; otomatik
              eşleştirme yapılmaz.
            </p>
          </div>

          {submitState === "submitted" ? (
            <FormStatus
              tone="success"
              title="Teklifiniz alındı"
              actions={
                <>
                  <button className="ops-button primary" onClick={() => navigate("/duyurular")} type="button">
                    Duyurulara Git
                  </button>
                  <button className="ops-button secondary" onClick={() => setSubmitState("idle")} type="button">
                    Yeni Teklif
                  </button>
                </>
              }
            >
              Yetkililer uygunluğu değerlendirecek. Güncel yönlendirmeleri duyurular ekranından takip edebilirsiniz.
            </FormStatus>
          ) : null}

          {submitState === "queued" ? (
            <FormStatus
              tone="warning"
              title="İnternet gelince gönderilecek"
              actions={
                <button className="ops-button secondary" onClick={() => navigate("/")} type="button">
                  Ana Sayfaya Dön
                </button>
              }
            >
              Barınma teklifiniz bu cihazda geçici olarak saklandı. Bağlantı geri geldiğinde gönderilecek.
            </FormStatus>
          ) : null}

          {errors.queue ? <FormStatus tone="error" title="Form gönderilemedi">{errors.queue}</FormStatus> : null}

          <form className="public-form-grid" onSubmit={handleSubmit} noValidate>
            <label className="form-field" htmlFor="shelter-host-name">
              <span>Ev Sahibi Ad Soyad <b>Zorunlu</b></span>
              <input
                id="shelter-host-name"
                aria-describedby={errors.host_name ? "shelter-host-name-error" : undefined}
                aria-invalid={Boolean(errors.host_name)}
                value={form.host_name}
                onChange={(event) => update("host_name", event.target.value)}
              />
              <FieldError id="shelter-host-name-error" message={errors.host_name} />
            </label>

            <label className="form-field" htmlFor="shelter-contact">
              <span>Telefon / İletişim <b>Zorunlu</b></span>
              <input
                id="shelter-contact"
                aria-describedby={errors.contact_info ? "shelter-contact-error" : undefined}
                aria-invalid={Boolean(errors.contact_info)}
                value={form.contact_info}
                onChange={(event) => update("contact_info", event.target.value)}
              />
              <FieldError id="shelter-contact-error" message={errors.contact_info} />
            </label>

            <div className="public-form-row three">
              <label className="form-field" htmlFor="shelter-city">
                <span>Şehir</span>
                <input id="shelter-city" value={form.city ?? ""} onChange={(event) => update("city", event.target.value)} />
              </label>
              <label className="form-field" htmlFor="shelter-district">
                <span>İlçe</span>
                <input
                  id="shelter-district"
                  value={form.district ?? ""}
                  onChange={(event) => update("district", event.target.value)}
                />
              </label>
              <label className="form-field" htmlFor="shelter-neighborhood">
                <span>Mahalle</span>
                <input
                  id="shelter-neighborhood"
                  value={form.neighborhood ?? ""}
                  onChange={(event) => update("neighborhood", event.target.value)}
                />
              </label>
            </div>

            <label className="form-field" htmlFor="shelter-address">
              <span>Açık Adres Detayı <b>Admin görür</b></span>
              <textarea
                id="shelter-address"
                rows={3}
                value={form.address_detail ?? ""}
                onChange={(event) => update("address_detail", event.target.value)}
              />
            </label>

            <div className="public-form-row three">
              <label className="form-field" htmlFor="shelter-capacity">
                <span>Kapasite <b>Zorunlu</b></span>
                <input
                  id="shelter-capacity"
                  type="number"
                  min={1}
                  aria-describedby={errors.capacity ? "shelter-capacity-error" : undefined}
                  aria-invalid={Boolean(errors.capacity)}
                  value={form.capacity}
                  onChange={(event) => update("capacity", Number(event.target.value))}
                />
                <FieldError id="shelter-capacity-error" message={errors.capacity} />
              </label>
              <label className="form-field" htmlFor="shelter-from">
                <span>Başlangıç Tarihi</span>
                <input
                  id="shelter-from"
                  type="date"
                  value={form.available_from ?? ""}
                  onChange={(event) => update("available_from", event.target.value)}
                />
              </label>
              <label className="form-field" htmlFor="shelter-until">
                <span>Bitiş Tarihi</span>
                <input
                  id="shelter-until"
                  type="date"
                  aria-describedby={errors.available_until ? "shelter-until-error" : undefined}
                  aria-invalid={Boolean(errors.available_until)}
                  value={form.available_until ?? ""}
                  onChange={(event) => update("available_until", event.target.value)}
                />
                <FieldError id="shelter-until-error" message={errors.available_until} />
              </label>
            </div>

            <label className="form-field" htmlFor="shelter-duration">
              <span>Süre / Müsaitlik Notu</span>
              <textarea
                id="shelter-duration"
                rows={2}
                value={form.duration_note ?? ""}
                onChange={(event) => update("duration_note", event.target.value)}
              />
            </label>

            <label className="form-field" htmlFor="shelter-household">
              <span>Hane Notları</span>
              <textarea
                id="shelter-household"
                rows={2}
                value={form.household_notes ?? ""}
                onChange={(event) => update("household_notes", event.target.value)}
              />
            </label>

            <label className="form-field" htmlFor="shelter-suitability">
              <span>Uygunluk Notları</span>
              <textarea
                id="shelter-suitability"
                rows={2}
                value={form.suitability_notes ?? ""}
                onChange={(event) => update("suitability_notes", event.target.value)}
              />
            </label>

            {(!isOnline || needsConsent) ? (
              <OfflineConsentNotice checked={queueConsent} onChange={setQueueConsent} />
            ) : null}

            <button className="ops-button primary public-form-submit" type="submit" disabled={sending}>
              {sending ? "Kaydediliyor..." : "Teklifi Gönder"}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
