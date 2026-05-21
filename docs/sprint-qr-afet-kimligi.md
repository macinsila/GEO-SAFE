# Sprint: QR Afet Kimliği ve Sağlık Bilgisi

**Tarih:** 2026-05-21  
**Durum:** Planlandı  
**Öncelik:** Demo hazırlık — "telefon/internet olmasa bile QR karttan kritik bilgi okunabiliyor"

---

## Hedef

Kullanıcı profiline afet sağlık bilgileri ekle, QR kimlik üret. QR tarandığında minimum hayati bilgi göster. Hassas veri (TC, açık adres, detaylı geçmiş) asla saklanmaz.

---

## Mevcut Durum (Başlangıç Noktası)

| Bileşen | Dosya | Durum |
|---------|-------|-------|
| User modeli | `backend/app/models/user.py` | `data JSONB` kolonu var, sağlık alanları `profile.py` üzerinden okunuyor/yazılıyor |
| Profile API | `backend/app/api/profile.py` | `GET /api/v1/profile`, `PUT /api/v1/profile` — blood, chronic, meds, allergy alanları mevcut |
| Frontend auth | `frontend/src/context/AuthContext.tsx` | JWT + role, localStorage |
| QR kod | — | Yok |

---

## Kapsam Dışı (Hassas Veri Kuralları)

Aşağıdakiler **hiçbir zaman** saklanmaz veya QR'a yazılmaz:

- TC Kimlik Numarası
- Açık adres (sokak, mahalle, ilçe)
- Detaylı tıbbi geçmiş (geçirilmiş ameliyatlar, teşhisler vb.)
- Telefon numarası (QR içeriğinde yer almaz)

---

## Adımlar

### Adım 1 — Profile Alanlarını Genişlet (Backend)

**Dosya:** `backend/app/models/user.py`, `backend/app/api/profile.py`

Mevcut `data` JSONB kolonu yeterli; yeni migration **gerekmez**.

Eklenecek alanlar (hepsi opsiyonel, `data` JSON içinde saklanır):

| Alan | Tip | Örnek | Not |
|------|-----|-------|-----|
| `blood_type` | string | `"A Rh+"` | Kan grubu |
| `allergies` | string | `"Penisilin, fıstık"` | Bilinen alerjiler |
| `medications` | string | `"Metformin 500mg"` | Süregelen ilaçlar |
| `chronic_conditions` | string | `"Diyabet Tip 2"` | Kronik hastalık |
| `emergency_contact_name` | string | `"Ayşe Yılmaz"` | Yakın kişi adı (isim+soyad) |
| `emergency_contact_phone` | string | `"0532 XXX XXXX"` | Yakın kişi telefonu |
| `disability_notes` | string | `"Tekerlekli sandalye"` | Hareket/iletişim kısıtı |

**Değişiklik:** `profile.py`'daki `ProfileUpdate` Pydantic şemasına bu alanları ekle.  
**Doğrulama:** Her alan maksimum 200 karakter; `blood_type` için enum kontrolü.

---

### Adım 2 — Profile Sayfası UI (Frontend)

**Yeni dosya:** `frontend/src/pages/ProfilePage/index.tsx`  
**Route:** `/profile` (ProtectedRoute)

Form bölümleri:
1. **Temel** — isim (mevcut), kan grubu dropdown
2. **Sağlık** — alerjiler, ilaçlar, kronik hastalıklar (textarea, her biri max 200 karakter)
3. **Engel/Kısıt** — opsiyonel metin alanı
4. **Acil İletişim** — ad soyad + telefon (QR'a yazılmaz, sadece profilde saklanır)

**Navigasyon:** `App.tsx`'e `/profile` route ekle. Üst menüye "Profilim" linki.

---

### Adım 3 — QR Kimlik Üretimi (Backend)

**Yeni endpoint:** `GET /api/v1/qr/identity`  
**Yeni dosya:** `backend/app/api/qr.py`

**QR içeriği** (JSON, minimal):

```json
{
  "v": 1,
  "name": "Betül D.",
  "blood": "A Rh+",
  "allergies": "Penisilin",
  "medications": "Metformin 500mg",
  "conditions": "Diyabet Tip 2",
  "disability": "",
  "issued": "2026-05-21"
}
```

Kurallar:
- `name` → sadece isim + soyadın ilk harfi (gizlilik)
- TC, adres, detay yok
- Toplam içerik 500 karakteri geçmez (QR yoğunluğu düşük tutmak için)
- Backend bu JSON'u döner; QR görselini **frontend** üretir (kütüphane: `qrcode`)

**Endpoint response:**
```json
{
  "status": "success",
  "data": {
    "qr_payload": "<JSON string>",
    "display_name": "Betül D.",
    "issued_at": "2026-05-21"
  }
}
```

---

### Adım 4 — QR Görüntüleme Sayfası (Frontend)

**Yeni dosya:** `frontend/src/pages/QRCardPage/index.tsx`  
**Route:** `/qr-card` (ProtectedRoute)  
**Kütüphane:** `qrcode.react` (SVG tabanlı, baskıya uygun)

Sayfa bölümleri:

```
┌─────────────────────────────┐
│  GeoSafe Afet Kimlik Kartı  │
│  Betül D.   Kan: A Rh+      │
│                             │
│       [QR KOD GÖRSELİ]      │
│                             │
│  Alerjiler: Penisilin       │
│  İlaçlar: Metformin 500mg   │
│  Durum: Diyabet Tip 2       │
│                             │
│  [Kaydet/İndir] [Yazdır]    │
└─────────────────────────────┘
```

**İndir butonu:** Canvas/SVG QR'ı PNG olarak `window.URL.createObjectURL` ile indirir.  
**Yazdır butonu:** `window.print()` — CSS `@media print` ile sadece kart görünür.

---

### Adım 5 — Offline QR Okuma Sayfası (Frontend)

**Yeni dosya:** `frontend/src/pages/QRScanResultPage/index.tsx`  
**Route:** `/qr-result` (public, auth gerekmez)

QR'ın içindeki URL şeması:
```
https://geosafe.app/qr-result?d=<base64_encoded_json>
```

Sayfa:
- URL'deki `d` parametresini okur → base64 decode → JSON parse
- **Sunucu çağrısı yapmaz** → tamamen offline çalışır
- Bilgileri okunabilir formatta gösterir (isim, kan grubu, alerjiler, ilaçlar)
- Hata durumunda: "Geçersiz QR" mesajı

**Offline destek notu:**  
Sayfa statik JS/HTML olduğu için Vite'ın PWA plugin'i (`vite-plugin-pwa`) ile service worker'a önbelleğe alınabilir. Demo için minimum: `/qr-result` sayfasının bağımsız çalışması yeterli.

---

### Adım 6 — Navigasyon Entegrasyonu

**Dosya:** `frontend/src/App.tsx`

Eklenecek route'lar:

```tsx
/profile       → ProfilePage (ProtectedRoute)
/qr-card       → QRCardPage (ProtectedRoute)
/qr-result     → QRScanResultPage (public)
```

**Ana menü** (`MainPage` veya ortak layout): "Profilim" ve "Kimlik Kartım" linkleri.

---

## Görev Listesi

| # | Görev | Tür | Tahmini Süre |
|---|-------|-----|--------------|
| 1 | `profile.py` şemasını genişlet (yeni alanlar) | Backend | 30 dk |
| 2 | `qr.py` endpoint yaz (`GET /api/v1/qr/identity`) | Backend | 45 dk |
| 3 | `router.py`'a qr router'ı ekle | Backend | 5 dk |
| 4 | `ProfilePage` oluştur (form + API bağlantısı) | Frontend | 1.5 sa |
| 5 | `qrcode.react` kütüphanesini ekle | Frontend | 5 dk |
| 6 | `QRCardPage` oluştur (QR üretim + indir/yazdır) | Frontend | 1 sa |
| 7 | `QRScanResultPage` oluştur (offline decode) | Frontend | 45 dk |
| 8 | Route'ları ve navigasyonu ekle | Frontend | 20 dk |
| 9 | Uçtan uca test (kayıt → profil doldur → QR üret → tara) | Test | 30 dk |

**Toplam tahmini süre:** ~6 saat

---

## Teknik Kararlar

| Karar | Seçim | Gerekçe |
|-------|-------|---------|
| QR görsel üretimi | Frontend (`qrcode.react`) | Sunucu yükü yok; kullanıcı offline indirebilir |
| Veri taşıma formatı | Base64(JSON) URL parametresi | Sunucuya bağımlılık yok; QR içeriği kendi kendine yeterli |
| İsim gizleme | `"Betül D."` formatı | Kimlik hırsızlığı riskini azaltır |
| DB değişikliği | Yok (mevcut JSONB) | Migration gereksiz; risk yok |
| Offline strateji | Statik sayfa (PWA opsiyonel) | Demo için yeterli; servis kaydı ekstra |

---

## Demo Senaryosu

1. Kullanıcı giriş yapar → **Profilim** sayfasından kan grubu, alerjiler, ilaçları doldurur.
2. **Kimlik Kartım** sayfasına gider → QR kodu oluşur, ekranda görünür.
3. "İndir" butonuna basar → PNG olarak telefonuna kaydeder.
4. Başka bir cihazda (offline) QR taratılır → `/qr-result?d=...` sayfası açılır.
5. Sayfada: kan grubu, alerjiler, ilaçlar görünür. Sunucu çağrısı yok.
6. Demo notu: **"Telefon/internet olmasa bile QR karttan kritik bilgi okunabiliyor."**

---

## Bağımlılıklar

```bash
# Frontend
npm install qrcode.react

# Backend — yeni bağımlılık yok
```

---

## Dosya Değişiklik Özeti

```
backend/
  app/api/profile.py          ← ProfileUpdate şeması genişletilir
  app/api/qr.py               ← YENİ: QR payload endpoint
  app/api/router.py           ← qr router eklenir

frontend/src/
  pages/ProfilePage/index.tsx ← YENİ: sağlık profil formu
  pages/QRCardPage/index.tsx  ← YENİ: QR üretim + indir/yazdır
  pages/QRScanResultPage/     ← YENİ: offline QR okuma
    index.tsx
  App.tsx                     ← 3 yeni route
  services/profileService.ts  ← profile API çağrıları (genişletilir)
```
