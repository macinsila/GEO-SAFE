import React from "react";
import { useNavigate } from "react-router-dom";

const RESOURCE_LIST = [
  "112 Acil Çağrı Merkezi",
  "183 Sosyal Destek Hattı",
  "Yerel belediye psikososyal destek ekipleri",
  "İl/ilçe sağlık müdürlüğü duyuruları",
];

const COPING_TIPS = [
  "Kendinize ve sevdiklerinize güvende olduğunuzu hatırlatın.",
  "Duygularınızı güvendiğiniz kişilerle paylaşın.",
  "Dünyadan tamamen kopmamak için resmî duyuruları takip edin.",
  "Basit nefes egzersizleri ve kısa yürüyüşler gibi rahatlama yöntemlerini deneyin.",
];

export default function PsychologicalSupportPage() {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "'Outfit','Segoe UI',system-ui,sans-serif", padding: "24px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <button
          onClick={() => navigate("/")}
          style={{ background: "none", border: "1px solid #0f766e", color: "#0f766e", borderRadius: 10, padding: "6px 14px", fontWeight: 600, cursor: "pointer", marginBottom: 16 }}
        >
          ← Ana Sayfa
        </button>

        <div style={{ background: "#fff", borderRadius: 18, padding: "26px 28px", border: "1px solid #ccfbf1", boxShadow: "0 12px 30px rgba(15,118,110,.12)" }}>
          <h1 style={{ margin: 0, fontSize: 22, color: "#0f766e" }}>Psikolojik Destek Kaynakları</h1>
          <p style={{ marginTop: 8, color: "#475569", fontSize: 13 }}>
            Bu sayfa tıbbi veya psikolojik tedavi yerine geçmez. Acil risk durumunda 112 veya yetkili kurumlarla iletişime geçin.
          </p>

          <div style={{ marginTop: 18, padding: "16px 18px", background: "#fefce8", borderRadius: 12, border: "1px solid #fde68a", color: "#92400e", fontSize: 13, fontWeight: 600 }}>
            Resmî ve yerel destek kaynaklarını takip edin. Bu bilgiler genel bilgilendirme amaçlıdır.
          </div>

          <div style={{ marginTop: 20, display: "grid", gap: 16 }}>
            <div style={{ background: "#ecfeff", borderRadius: 12, padding: "16px 18px", border: "1px solid #a5f3fc" }}>
              <h2 style={{ margin: 0, fontSize: 15, color: "#0e7490" }}>Yardım Kaynakları</h2>
              <ul style={{ margin: "10px 0 0", paddingLeft: 18, color: "#0f172a", fontSize: 13 }}>
                {RESOURCE_LIST.map((item) => (
                  <li key={item} style={{ marginBottom: 6 }}>{item}</li>
                ))}
              </ul>
            </div>

            <div style={{ background: "#f0fdf4", borderRadius: 12, padding: "16px 18px", border: "1px solid #bbf7d0" }}>
              <h2 style={{ margin: 0, fontSize: 15, color: "#166534" }}>Güvenli Bireysel Destek İpuçları</h2>
              <ul style={{ margin: "10px 0 0", paddingLeft: 18, color: "#0f172a", fontSize: 13 }}>
                {COPING_TIPS.map((tip) => (
                  <li key={tip} style={{ marginBottom: 6 }}>{tip}</li>
                ))}
              </ul>
            </div>

            <div style={{ background: "#fef2f2", borderRadius: 12, padding: "16px 18px", border: "1px solid #fecaca" }}>
              <h2 style={{ margin: 0, fontSize: 15, color: "#b91c1c" }}>Acil Risk Durumu</h2>
              <p style={{ margin: "8px 0 0", fontSize: 13, color: "#7f1d1d" }}>
                Kendinize veya başkalarına zarar verme riski hissediyorsanız 112 ile iletişime geçin veya en yakın resmî birime başvurun.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
