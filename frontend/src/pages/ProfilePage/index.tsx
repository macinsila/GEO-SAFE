import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { geoSafeAPI } from "../../services";

interface ProfileForm {
  name: string;
  blood: string;
  allergy: string;
  meds: string;
  chronic: string;
  disability_notes: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  phone: string;
}

const BLOOD_TYPES = ["", "A Rh+", "A Rh-", "B Rh+", "B Rh-", "AB Rh+", "AB Rh-", "0 Rh+", "0 Rh-"];

const empty: ProfileForm = {
  name: "",
  blood: "",
  allergy: "",
  meds: "",
  chronic: "",
  disability_notes: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
  phone: "",
};

export default function ProfilePage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<ProfileForm>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    geoSafeAPI
      .fetchProfile()
      .then((data) => setForm({ ...empty, ...(data as Partial<ProfileForm>) }))
      .catch(() => setMsg({ text: "Profil yüklenemedi.", ok: false }))
      .finally(() => setLoading(false));
  }, []);

  const set = (key: keyof ProfileForm, val: string) =>
    setForm((f) => ({ ...f, [key]: val }));

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      await geoSafeAPI.updateProfile(form as unknown as Record<string, string>);
      setMsg({ text: "Profil kaydedildi.", ok: true });
    } catch {
      setMsg({ text: "Kayıt başarısız.", ok: false });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 text-gray-300">
        Yükleniyor...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 px-4 py-8">
      <div className="max-w-xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Afet Kimlik Profili</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              TC, açık adres ve detaylı tıbbi geçmiş kaydedilmez.
            </p>
          </div>
          <button
            className="text-sm text-gray-400 hover:text-gray-200 underline"
            onClick={() => navigate(-1)}
            type="button"
          >
            Geri
          </button>
        </div>

        <section className="bg-gray-900 rounded-lg p-5 space-y-4 border border-gray-800">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Temel Bilgiler</h2>
          <label className="block space-y-1">
            <span className="text-xs text-gray-400">Ad Soyad</span>
            <input
              type="text"
              maxLength={100}
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Adınız Soyadınız"
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-gray-400">Kan Grubu</span>
            <select
              value={form.blood}
              onChange={(e) => set("blood", e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            >
              {BLOOD_TYPES.map((t) => (
                <option key={t} value={t}>{t || "— Seçiniz —"}</option>
              ))}
            </select>
          </label>
        </section>

        <section className="bg-gray-900 rounded-lg p-5 space-y-4 border border-gray-800">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Sağlık Bilgileri</h2>
          <label className="block space-y-1">
            <span className="text-xs text-gray-400">Alerjiler</span>
            <textarea
              maxLength={200}
              rows={2}
              value={form.allergy}
              onChange={(e) => set("allergy", e.target.value)}
              placeholder="örn. Penisilin, fıstık"
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-gray-400">Süregelen İlaçlar</span>
            <textarea
              maxLength={200}
              rows={2}
              value={form.meds}
              onChange={(e) => set("meds", e.target.value)}
              placeholder="örn. Metformin 500mg, Ramipril 5mg"
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-gray-400">Kronik Rahatsızlık</span>
            <textarea
              maxLength={200}
              rows={2}
              value={form.chronic}
              onChange={(e) => set("chronic", e.target.value)}
              placeholder="örn. Diyabet Tip 2, Hipertansiyon"
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-gray-400">Hareket / İletişim Kısıtı</span>
            <input
              type="text"
              maxLength={200}
              value={form.disability_notes}
              onChange={(e) => set("disability_notes", e.target.value)}
              placeholder="örn. Tekerlekli sandalye, işitme cihazı"
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            />
          </label>
        </section>

        <section className="bg-gray-900 rounded-lg p-5 space-y-4 border border-gray-800">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Acil İletişim</h2>
          <p className="text-xs text-gray-500">Bu bilgiler yalnızca profilinizde saklanır, QR koda yazılmaz.</p>
          <label className="block space-y-1">
            <span className="text-xs text-gray-400">Yakın Kişi Adı</span>
            <input
              type="text"
              maxLength={100}
              value={form.emergency_contact_name}
              onChange={(e) => set("emergency_contact_name", e.target.value)}
              placeholder="Ad Soyad"
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-gray-400">Yakın Kişi Telefonu</span>
            <input
              type="tel"
              maxLength={20}
              value={form.emergency_contact_phone}
              onChange={(e) => set("emergency_contact_phone", e.target.value)}
              placeholder="0532 XXX XXXX"
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            />
          </label>
        </section>

        {msg && (
          <div className={`text-sm px-4 py-2 rounded ${msg.ok ? "bg-green-900 text-green-300" : "bg-red-900 text-red-300"}`}>
            {msg.text}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 rounded text-sm transition-colors"
          >
            {saving ? "Kaydediliyor..." : "Kaydet"}
          </button>
          <button
            type="button"
            onClick={() => navigate("/qr-card")}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-medium py-2.5 rounded text-sm transition-colors"
          >
            QR Kimlik Kartım →
          </button>
        </div>
      </div>
    </div>
  );
}
