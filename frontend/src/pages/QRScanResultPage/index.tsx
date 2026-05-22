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
    <div className="flex gap-3 py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm font-semibold text-gray-500 w-28 shrink-0">{label}</span>
      <span className="text-sm text-gray-900">{value}</span>
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
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-gray-50 px-4">
        <div className="text-4xl">⚠️</div>
        <h1 className="text-lg font-bold text-gray-800">Geçersiz QR Kodu</h1>
        <p className="text-sm text-gray-500 text-center">
          Bu QR kodu GeoSafe Afet Kimlik Kartı'na ait değil veya hasarlı.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-sm mx-auto space-y-6">
        <div className="text-center space-y-1">
          <p className="text-xs font-bold text-blue-700 uppercase tracking-widest">GeoSafe</p>
          <h1 className="text-2xl font-bold text-gray-900">Afet Kimlik Kartı</h1>
          <p className="text-sm text-gray-500">Kritik sağlık bilgileri</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-1">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <span className="text-lg font-bold text-gray-900">{payload.name || "—"}</span>
            {payload.blood && (
              <span className="bg-red-100 text-red-700 text-sm font-bold px-3 py-1 rounded-full">
                {payload.blood}
              </span>
            )}
          </div>

          <Row label="Alerjiler" value={payload.allergies} />
          <Row label="İlaçlar" value={payload.medications} />
          <Row label="Kronik" value={payload.conditions} />
          <Row label="Kısıt" value={payload.disability} />

          {!payload.allergies && !payload.medications && !payload.conditions && !payload.disability && (
            <p className="text-sm text-gray-400 italic py-2">Sağlık bilgisi girilmemiş.</p>
          )}
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
          <p className="text-xs text-blue-700 font-medium">Sağlık personeli için not</p>
          <p className="text-xs text-blue-600 mt-0.5">
            Bu bilgiler afet kimlik sahibi tarafından beyan edilmiştir. Klinik karar için doğrulayınız.
          </p>
        </div>

        {payload.issued && (
          <p className="text-xs text-center text-gray-400">Kart tarihi: {payload.issued}</p>
        )}

        <p className="text-xs text-center text-gray-400">
          Bu sayfa çevrimdışı çalışır — sunucu bağlantısı gerekmez.
        </p>
      </div>
    </div>
  );
}
