# GeoSafe Komut Talimatları

## 🚀 Hızlı Başlangıç (Windows)

Sistemin tamamını Docker Compose ile başlatmak için:

```powershell
# Proje dizinine git
cd C:\Users\90543\OneDrive\Desktop\geosafe2

# Docker konteynırlarını başlat
docker-compose up -d

# Durum kontrol et
docker-compose ps
```

## 📦 Veritabanı Seed Script'i Çalıştırma

### Seçenek 1: Docker Konteynerinde (Önerilen)

```powershell
# Backend konteynırına gir
docker-compose exec backend bash

# Seed script'i çalıştır
python -m scripts.seed_db

# Çıkış yap
exit
```

### Seçenek 2: Lokal Python Ortamında

Önce PostgreSQL ve PostGIS çalışıyor olmalı:

```powershell
# Backend dizinine git
cd C:\Users\90543\OneDrive\Desktop\geosafe2\backend

# Virtual environment'i aktifleştir
.\.venv\Scripts\Activate.ps1

# Seed script'i çalıştır
python ../scripts/seed_db.py
```

### Seçenek 3: Adım Adım Manual (Test Amaçlı)

```powershell
# 1. PostgreSQL servisi başlat (lokal yüklü ise)
pg_ctl -D "C:\Program Files\PostgreSQL\15\data" start

# 2. Database'i oluştur (eğer yoksa)
createdb -U geosafe_user -h localhost geosafe_db

# 3. PostGIS extension'ını ekle
psql -U geosafe_user -d geosafe_db -h localhost -c "CREATE EXTENSION IF NOT EXISTS postgis"

# 4. Alembic migration'larını çalıştır
cd backend
alembic -c alembic/alembic.ini upgrade head

# 5. Seed script'ini çalıştır
cd ..
python scripts/seed_db.py
```

## ✅ Başarılı Seed Olduğunu Doğrula

Seed script başarılı ise şunu göreceksin:

```
======================================================================
🌍 GeoSafe Database Seeding Script
======================================================================

📦 Connecting to database: postgresql+asyncpg://geosafe_user:...

🏪 Creating Warehouses...
  ✓ Kadıköy Central Warehouse (40.991°, 29.023°)
  ✓ Beşiktaş Supply Hub (41.043°, 29.001°)
  ✓ Moda Emergency Cache (40.985°, 29.032°)
  ✓ Ortaköy Relief Center (41.052°, 29.0145°)
  ✓ Fenerbahçe Storage Depot (40.975°, 29.045°)

🛡️  Creating Safe Zones...
  ✓ Kadıköy Central Safe Zone (capacity: 5000)
  ✓ Beşiktaş Coastal Safe Zone (capacity: 8000)
  ✓ Moda-Yeldeğirmeni Safe Corridor (capacity: 3500)

📦 Creating Supply Items...
  ✓ Blanket (piece)
  ✓ Water (liter) (liter)
  ✓ Medical Kit (piece)
  ✓ Food Package (box)
  ✓ Tent (piece)
  ✓ First Aid Supplies (pack)

📊 Creating Warehouse Inventory...
  ✓ Kadıköy Central Warehouse - Blanket: 500 piece
  ✓ Kadıköy Central Warehouse - Water (liter): 2000 liter
  ... (daha fazla)

✅ Database seeded successfully!

📊 Summary:
   • 5 warehouses created
   • 3 safe zones created
   • 6 supply items created

======================================================================
✨ Seeding complete! Your database is ready to use.
======================================================================
```

## 🌐 API Endpoints Test Et

### 1. Backend Health Check
```powershell
curl -X GET http://localhost:8000/health
```

Yanıt:
```json
{
  "status": "healthy",
  "service": "GeoSafe Backend",
  "version": "0.1.0"
}
```

### 2. Tüm Warehouse'ları Getir
```powershell
curl -X GET http://localhost:8000/api/v1/warehouses
```

### 3. Tüm Safe Zone'ları Getir
```powershell
curl -X GET http://localhost:8000/api/v1/safe-zones
```

### 4. Specific Warehouse
```powershell
curl -X GET http://localhost:8000/api/v1/warehouses/1
```

## 🗺️  Frontend'i Test Et

1. Tarayıcıda **http://localhost:3000** aç
2. Aşağıdakileri görmelisin:
   - ✅ Harita yükleniyor
   - ✅ 5 warehouse'un mavi ikonları (pins)
   - ✅ 3 safe zone'un orange poligonları
   - ✅ Haritaya tıklayınca koordinatlar gösteriliyor

## 🔌 Backend-Frontend Bağlantısı

CORS ayarları `backend/app/main.py` içinde:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

✅ Frontend (port 3000) → Backend (port 8000) başarılı!

## 📊 Koordinatlar Reference

### Warehouse Konumları (Point Geometry)
- **Kadıköy Central**: 29.0230°E, 40.9910°N
- **Beşiktaş Supply**: 29.0010°E, 41.0430°N
- **Moda Emergency**: 29.0320°E, 40.9850°N
- **Ortaköy Relief**: 29.0145°E, 41.0520°N
- **Fenerbahçe Depot**: 29.0450°E, 40.9750°N

### Safe Zone Sınırları (Polygon Geometry)
- **Kadıköy**: 29.0150-29.0350°E × 40.9800-41.0000°N
- **Beşiktaş**: 28.9900-29.0200°E × 41.0350-41.0600°N
- **Moda-Yeldeğirmeni**: 29.0200-29.0550°E × 40.9700-40.9950°N

## 🛑 Sorun Giderme

### Seed Script Hatası: "Cannot find module"
```powershell
# Backend dizininde çalıştırdığından emin ol
cd backend
python ../scripts/seed_db.py
```

### Database Bağlantı Hatası
```powershell
# PostgreSQL çalışıyor mu kontrol et
docker-compose exec db psql -U geosafe_user -d geosafe_db -c "SELECT 1"
```

### PostGIS Extension Hatası
```powershell
# Extension'ı ekle
docker-compose exec db psql -U geosafe_user -d geosafe_db -c "CREATE EXTENSION postgis"
```

### Frontend Harita Boş Gösteriliyor
1. Browser Console'da hata var mı kontrol et (F12)
2. Backend API running mu? → http://localhost:8000/health
3. CORS hatası var mı? → Backend logs'a bak

## 📚 Dokumentasyon

- [SETUP_GUIDE.md](./SETUP_GUIDE.md) - Detaylı kurulum
- [TESTING_GUIDE.md](./TESTING_GUIDE.md) - Test prosedürleri
- [docs/DATA_MODEL.md](./docs/DATA_MODEL.md) - Database şeması
- [PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md) - Proje özeti
