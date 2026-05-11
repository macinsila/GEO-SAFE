# GeoSafe — Akıllı Afet Yönetim ve Lojistik Destek Sistemi

## Proje Nedir
GeoSafe, deprem/yangın/sel gibi afetlerde güvenli toplanma alanlarını ve
lojistik destek depolarını harita üzerinde birleştiren bir CBS (Coğrafi Bilgi
Sistemi) platformudur. Depolardaki envanter (gıda, su, battaniye, ilaç vb.)
gerçek zamanlı takip edilir; vatandaşlar ve saha ekipleri en yakın aktif
depoya yönlendirilir.

## Tech Stack

### Backend (Tamamlandı — Sprint 1 Kapandı)
- Python FastAPI, SQLAlchemy 2.0 (async)
- PostgreSQL + PostGIS + GeoAlchemy2
- Alembic migrations (001 + 002 uygulandı)
- Leaflet.js uyumlu GeoJSON response'lar
- Tüm endpoint'ler /api/v1/ altında

### Frontend (Sprint 2 — Aktif)
- React 18 + Vite
- Tailwind CSS (responsive)
- Leaflet.js (harita)
- Axios veya fetch (API iletişimi)

## Backend API — Mevcut Endpoint'ler

Tüm response'lar { status, data, message } formatındadır.

| Method | Path | Açıklama |
|--------|------|----------|
| GET | /api/v1/warehouses | Tüm depolar (GeoJSON location dahil) |
| GET | /api/v1/warehouses/{id} | Tek depo detayı |
| POST | /api/v1/warehouses | Yeni depo (Admin) |
| PUT | /api/v1/warehouses/{id} | Depo güncelle |
| DELETE | /api/v1/warehouses/{id} | Depo sil |
| GET | /api/v1/safe-zones | Tüm toplanma alanları |
| GET | /api/v1/safe-zones/{id} | Tek alan detayı |
| POST | /api/v1/safe-zones | Yeni alan (Admin) |
| GET | /api/v1/inventory/safe-zone/{id} | Envanter listesi |
| PUT | /api/v1/inventory/safe-zone/{id} | Envanter güncelle |
| GET | /api/v1/spatial/nearest-depot | En yakın depo (PostGIS) |
| GET | /api/v1/earthquakes | Deprem verileri |
| POST | /api/v1/emergency | Acil bildirim |
| POST | /api/v1/auth/token | Login |
| POST | /api/v1/auth/register | Kayıt |

### /api/v1/spatial/nearest-depot
Query params: lat, lon, item_name, radius_km (default: 10.0)
Response data: { depot, distance_km, item_quantity }

### Depo Durumları (status field)
- "active" → yeşil
- "inactive" → gri
- "risky" → kırmızı
- "full" → turuncu

## Domain Terimleri
- ToplanmaAlani → SafeZone (güvenli toplanma noktası)
- LojistikDepo → Warehouse (envanter takipli depo)
- EnvanterKalemi → InventoryItem
- kuru_gida, battaniye, ilac, yangin_malzemesi, su → item_name değerleri

## Sprint 2 Hedefleri (Aktif Sprint)

### Öncelik 1 — Harita Katmanları
- Leaflet haritası üzerinde depo ve toplanma alanı marker'ları
- Status'a göre renk kodlaması (active=yeşil, risky=kırmızı vb.)
- Marker popup: isim + durum + envanter özeti
- Katmanlar ayrı toggle edilebilir (Layer Control)

### Öncelik 2 — Vatandaş Akışı
- Kullanıcı konumunu al (Geolocation API)
- item_name seçimi (dropdown)
- /api/v1/spatial/nearest-depot çağrısı
- Sonucu haritada polyline ile göster
- Popup: mesafe + stok bilgisi

### Öncelik 3 — Admin Dashboard
- Sistem geneli özet (toplam depo, aktif/pasif sayısı, düşük stok uyarıları)
- Depo bazlı envanter tablosu
- Stok güncelleme formu

## Kod Kuralları
- Tüm API çağrıları src/api/ altında merkezi fonksiyonlarda
- Harita mantığı src/components/Map/ altında modüler (ayrı dosyalar:
  WarehouseLayer, SafeZoneLayer, RouteLayer)
- Türkçe domain terimleri component/değişken adlarında korunabilir
- API base URL: import.meta.env.VITE_API_URL (default: http://localhost:8000)
- Hata durumları kullanıcıya toast/alert ile gösterilmeli, sessiz yutulmamalı
- Mobile-first: Tailwind breakpoint'ler sm/md/lg sırasıyla

## Test Durumu (Backend)
- 10/10 test geçiyor
- pytest tests/ -v --tb=short
- TEST_DATABASE_URL=postgresql+asyncpg://geosafe_user:geosafe_pass@localhost:5432/geosafe_db

## Docker
- docker compose up -d db → PostGIS başlatır
- DB: geosafe_db, user: geosafe_user, pass: geosafe_pass, port: 5432

## Alembic
- PYTHONPATH=backend/ alembic -c alembic/alembic.ini upgrade head
- Mevcut revision: 002_geometry_point_columns