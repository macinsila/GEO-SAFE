import React from "react";
import { Announcement } from "../../types";

export type Tone = "safe" | "warning" | "critical" | "info" | "neutral";

export const ANNOUNCEMENT_CACHE_KEY = "geosafe_announcements_v1";

export const ANNOUNCEMENT_PRIORITY_LABELS: Record<string, string> = {
  critical: "Kritik",
  high: "Acil",
  normal: "Önemli",
  low: "Normal",
};

export const ANNOUNCEMENT_CATEGORY_LABELS: Record<string, string> = {
  genel: "Genel",
  uyari: "Uyarı",
  tahliye: "Tahliye",
  saglik: "Sağlık",
  lojistik: "Lojistik",
  guvenlik: "Güvenlik",
};

export const SUPPORT_CARDS = [
  {
    title: "Gönüllü Havuzu",
    desc: "Saha destek kapasitesi ve uygunluk bilgisi toplayın.",
    action: "Başvuru akışına git",
    path: "/volunteer",
    tone: "safe" as Tone,
  },
  {
    title: "Barınma Kapasitesi",
    desc: "Geçici konaklama tekliflerini operasyon havuzuna alın.",
    action: "Teklif kaydı aç",
    path: "/shelter-offer",
    tone: "warning" as Tone,
  },
  {
    title: "Psikolojik Destek",
    desc: "Afetzede ve saha ekipleri için doğrulanmış kaynaklar.",
    action: "Kaynakları gör",
    path: "/psychological-support",
    tone: "info" as Tone,
  },
];

export const VIDEO_CARDS = [
  {
    tag: "Hazırlık",
    title: "Afet ve acil durum çantası nasıl hazırlanır?",
    url: "https://youtu.be/K0keerAalYE",
    summary:
      "Acil durum çantası, ilk 72 saat boyunca temel ihtiyaçları karşılayacak şekilde sade ve taşınabilir olmalıdır.",
    guidance: [
      "Su, kuru gıda, el feneri, pil, powerbank, ilk yardım seti, ilaçlar ve hijyen malzemelerini aynı yerde tutun.",
      "Kimlik fotokopisi, önemli telefonlar, nakit para ve temel belgeleri su geçirmez bir kılıfta saklayın.",
      "Çantayı ailede herkesin bildiği, çıkışa yakın ve kolay erişilebilir bir noktada konumlandırın.",
    ],
  },
  {
    tag: "Deprem",
    title: "Deprem anında yapılması gerekenler",
    url: "https://youtu.be/oZeI0X40EEY",
    summary:
      "Deprem anında temel hedef, panik yapmadan düşen veya esneyen nesnelerden korunmak ve sarsıntı bitmeden hareket etmemektir.",
    guidance: [
      "Çök, kapan, tutun pozisyonu alın; pencere, dolap, raf ve ağır eşyalardan uzak durun.",
      "Merdiven, asansör veya balkonlara yönelmeyin; sarsıntı bitene kadar bulunduğunuz yerde korunun.",
      "Sarsıntı sonrası gaz, elektrik ve su risklerini kontrol edin; güvenli çıkış rotasını izleyin.",
    ],
  },
  {
    tag: "Yangın",
    title: "Yangın anında yapılması gerekenler",
    url: "https://youtu.be/yQjUhzNMNe8",
    summary:
      "Yangında hızlı karar, dumandan korunma ve kontrollü tahliye hayati önemdedir.",
    guidance: [
      "Duman varsa yere yakın ilerleyin, ağız ve burnu mümkünse nemli bezle kapatın.",
      "Kapı kolu sıcaksa kapıyı açmayın; alternatif çıkış veya pencere yanında yardım sinyali kullanın.",
      "Küçük ve başlangıç aşamasındaki yangın dışında müdahale etmeyin; 112'yi arayın ve tahliye olun.",
    ],
  },
  {
    tag: "Sel",
    title: "Sel anında yapılması gerekenler",
    url: "https://youtu.be/jy2yf7a5A10",
    summary:
      "Sel durumunda en büyük risk, hızlı akan suya girmek ve araçla geçiş denemektir.",
    guidance: [
      "Dere yatağı, alt geçit, bodrum ve su biriken yollardan uzaklaşın; yüksek ve güvenli noktalara çıkın.",
      "Araçla su birikintisinden geçmeye çalışmayın; az derinlikteki akıntı bile aracı sürükleyebilir.",
      "Elektrik temas riskine karşı priz, pano ve ıslak elektrikli cihazlardan uzak durun.",
    ],
  },
];

type AnnouncementCache = {
  items: Announcement[];
  cachedAt: string;
};

export function loadAnnouncementCache(): AnnouncementCache | null {
  try {
    const raw = localStorage.getItem(ANNOUNCEMENT_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AnnouncementCache;
  } catch {
    return null;
  }
}

export function saveAnnouncementCache(items: Announcement[]) {
  try {
    localStorage.setItem(
      ANNOUNCEMENT_CACHE_KEY,
      JSON.stringify({ items, cachedAt: new Date().toISOString() })
    );
  } catch {
    // Announcements still render when browser storage is unavailable.
  }
}

export function announcementTone(priority: string): Tone {
  if (priority === "critical") return "critical";
  if (priority === "high") return "warning";
  if (priority === "normal") return "info";
  return "neutral";
}

export function toneLabel(tone: Tone) {
  return `tone-${tone}`;
}

export function SectionHeader({
  eyebrow,
  title,
  meta,
}: {
  eyebrow?: string;
  title: string;
  meta?: string;
}) {
  return (
    <div className="ops-section-header">
      <div>
        {eyebrow ? <span className="ops-eyebrow">{eyebrow}</span> : null}
        <h2>{title}</h2>
      </div>
      {meta ? <span className="ops-meta">{meta}</span> : null}
    </div>
  );
}

export function StatusCard({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  detail: string;
  tone?: Tone;
}) {
  return (
    <article className={`ops-card status-card ${toneLabel(tone)}`}>
      <span className="status-card-label">{label}</span>
      <strong>{value}</strong>
      <span>{detail}</span>
    </article>
  );
}

export function ResourceBadge({
  tone,
  children,
}: {
  tone: Tone;
  children: React.ReactNode;
}) {
  return <span className={`resource-badge ${toneLabel(tone)}`}>{children}</span>;
}

export function EmptyState({ message }: { message: string }) {
  return <div className="ops-empty">{message}</div>;
}

export function MiniMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: Tone;
}) {
  return (
    <div className={`mini-metric ${toneLabel(tone)}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
