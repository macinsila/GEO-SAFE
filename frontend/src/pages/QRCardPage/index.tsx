import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { QRCodeSVG, QRCodeCanvas } from "qrcode.react";
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
      .catch(() => setError("Kimlik verisi yüklenemedi. Profil bilgilerini doldurun."))
      .finally(() => setLoading(false));
  }, []);

  const qrUrl = payload
    ? `${window.location.origin}/qr-result?d=${encode(payload)}`
    : "";

  const handleDownload = useCallback(() => {
    const canvas = canvasRef.current?.querySelector("canvas");
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `geosafe-qr-${displayName.replace(/\s/g, "-")}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }, [displayName]);

  const handlePrint = () => window.print();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 text-gray-300">
        Yükleniyor...
      </div>
    );
  }

  if (error || !payload) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-950 text-gray-300 px-4">
        <p className="text-center">{error || "Veri yüklenemedi."}</p>
        <button
          type="button"
          onClick={() => navigate("/profile")}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded text-sm"
        >
          Profili Düzenle
        </button>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #qr-print-card, #qr-print-card * { visibility: visible !important; }
          #qr-print-card { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; }
        }
      `}</style>

      <div className="min-h-screen bg-gray-950 text-gray-100 px-4 py-8">
        <div className="max-w-sm mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">Afet Kimlik Kartı</h1>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="text-sm text-gray-400 hover:text-gray-200 underline"
            >
              Geri
            </button>
          </div>

          <div
            id="qr-print-card"
            className="bg-white text-gray-900 rounded-xl p-6 space-y-4 shadow-lg"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-bold text-blue-700 uppercase tracking-widest">GeoSafe</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest">Afet Kimlik Kartı</p>
                <h2 className="text-lg font-bold mt-1">{displayName}</h2>
                {payload.blood && (
                  <span className="inline-block mt-1 bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded">
                    {payload.blood}
                  </span>
                )}
              </div>
              <div className="flex-shrink-0">
                <QRCodeSVG value={qrUrl} size={90} level="M" />
              </div>
            </div>

            <div className="border-t border-gray-200 pt-3 space-y-1.5 text-xs">
              {payload.allergies && (
                <div className="flex gap-2">
                  <span className="font-semibold text-gray-500 w-24 shrink-0">Alerjiler</span>
                  <span className="text-gray-800">{payload.allergies}</span>
                </div>
              )}
              {payload.medications && (
                <div className="flex gap-2">
                  <span className="font-semibold text-gray-500 w-24 shrink-0">İlaçlar</span>
                  <span className="text-gray-800">{payload.medications}</span>
                </div>
              )}
              {payload.conditions && (
                <div className="flex gap-2">
                  <span className="font-semibold text-gray-500 w-24 shrink-0">Kronik</span>
                  <span className="text-gray-800">{payload.conditions}</span>
                </div>
              )}
              {payload.disability && (
                <div className="flex gap-2">
                  <span className="font-semibold text-gray-500 w-24 shrink-0">Kısıt</span>
                  <span className="text-gray-800">{payload.disability}</span>
                </div>
              )}
              {!payload.allergies && !payload.medications && !payload.conditions && !payload.disability && (
                <p className="text-gray-400 italic">Sağlık bilgisi girilmemiş.</p>
              )}
            </div>

            <p className="text-[10px] text-gray-400 text-right">
              QR taranınca bilgiler gösterilir · {issuedAt}
            </p>
          </div>

          {/* Hidden canvas for PNG download */}
          <div ref={canvasRef} className="hidden">
            <QRCodeCanvas value={qrUrl} size={300} level="M" />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleDownload}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded text-sm transition-colors"
            >
              PNG İndir
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-medium py-2.5 rounded text-sm transition-colors"
            >
              Yazdır
            </button>
          </div>

          <p className="text-xs text-center text-gray-500">
            QR kodu tarayıcı olmadan da okunabilir —{" "}
            <span className="text-gray-400">internet bağlantısı gerekmez</span>
          </p>

          <button
            type="button"
            onClick={() => navigate("/profile")}
            className="w-full text-sm text-gray-400 hover:text-gray-200 underline"
          >
            Bilgileri Güncelle (Profil)
          </button>
        </div>
      </div>
    </>
  );
}
