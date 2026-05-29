# GeoSafe — Demo Senaryo Rehberi

> **Hedef kitle:** Jüri, kurumsal pilot görüşmesi, yatırımcı  
> **Süre:** ~8–12 dakika  
> **Önkoşul:** Demo öncesi `scripts/demo-warmup.ps1` veya `demo-warmup.sh` çalıştırılmış olmalı

---

## Demo Hesapları

| Rol   | E-posta               | Şifre    |
|-------|-----------------------|----------|
| Admin | admin@geosafe.com     | admin123 |
| User  | user@geosafe.com      | user123  |

---

## Senaryo: "Marmara Depremi — İlk 2 Saat"

### Sahne 1 — Komuta Merkezi Görünümü (2 dk)

1. Admin hesabıyla giriş yap (`admin@geosafe.com`)
2. **Dashboard** bölümünü göster:
   - "Active Depots", "Shelter Capacity", "Critical Stock", "Open Alerts" kartları
   - Gerçek zamanlı güncelleme zamanı
3. **Vurgula:** *"Sahadan gelen tüm veriler tek ekranda — depo kapasitesi, kritik stok ve açık alarmlar"*

---

### Sahne 2 — Harita Zekası (2 dk)

1. **Map Intelligence** bölümüne git (sidebar'dan veya scroll)
2. Haritada depo (mavi marker) ve toplanma alanlarını (polygon) göster
3. Layer kontrolü ile katmanları aç/kapat: *"Sadece depolar"* → *"Sadece toplanma alanları"*
4. **CitizenSearch** kutusunu kullan:
   - Konumu: İstanbul merkezi (41.01, 28.97)
   - Malzeme: `su` (veya `blanket`)
   - *"En yakın uygun depo anında gösteriliyor — PostGIS metre hassasiyeti"*
5. Rota çizgisini göster
6. **Vurgula:** *"Mahalle bazlı görünürlük — hangi depoda ne var, kaç km uzakta"*

---

### Sahne 3 — Vatandaş Acil Bildirimi (1.5 dk)

1. Sağ alt köşedeki **SOS** butonuna bas
2. "Enkaz Altındayım" seç
3. Konumun alındığını ve bildirimin gönderildiğini göster
4. **Vurgula:** *"Çevrimdışı bile çalışır — internet gelince otomatik gönderir"*

---

### Sahne 4 — Admin Operasyon Paneli (2 dk)

1. Üst sağdan **Admin** paneline geç (`/admin`)
2. **Emergency** sekmesi → az önce gelen SOS kaydını göster, durumu "reviewing" yap
3. **Warehouses** sekmesi → bir depoya tıkla, stok güncelle
4. **Inventory → Critical** sekmesi → kritik stok uyarılarını göster
   - Filtre butonları: "Sıfır Stok" vs "Düşük Stok" ayrımı
5. **Vurgula:** *"Audit trail: her stok değişikliği kim, ne zaman yaptı kaydediliyor"*

---

### Sahne 5 — QR Kimlik Kartı (1 dk)

1. Profil menüsünden **QR Kimlik** sayfasına git
2. QR kodu göster ve *"Tarama sonucu"* açılır
3. **Vurgula:** *"Afetzede kendini tanıtamasa bile kan grubu, ilaç, alerji bilgisi saha ekibine ulaşır"*

---

### Sahne 6 — Duyurular ve Eğitim (0.5 dk) — isteğe bağlı

1. Ana sayfadan **Duyurular** bölümüne kaydır
2. Öncelik renklerini göster (Kritik / Acil / Önemli)
3. **Training Briefs** — deprem/sel/yangın hazırlık video kartları

---

## Sıkça Sorulan Sorular (Jüri)

| Soru | Cevap |
|------|-------|
| *Gerçek zamanlı mı?* | Deprem verisi Kandilli API'sinden canlı çekiliyor. Stok verisi admin günceller. |
| *Offline ne kadar çalışır?* | SOS, gönüllü ve barınma bildirimleri kuyrukta saklanır, internet gelince sync olur. |
| *Ölçeklenebilir mi?* | PostGIS spatial index, asyncpg async driver, Supabase connection pooling — pilot fazı için yeterli. |
| *Auth güvenli mi?* | JWT + bcrypt, rol bazlı guard hem frontend hem backend'de, token 24 saat geçerli. |
| *Mobil uyumlu mu?* | PWA manifest mevcut, responsive layout — tam mobil optimizasyon Sprint B'de. |
| *Veriler gerçek mi?* | Demo verisi: İstanbul mahalle bazlı 5 depo, 3 toplanma alanı, gerçekçi stok kalemleri. |

---

## Demo Öncesi Kontrol Listesi

- [ ] `scripts/demo-warmup.ps1` çalıştırıldı, tüm endpointler yeşil
- [ ] Admin ve user hesabı test edildi (login başarılı)
- [ ] Harita yüklü, en az 3 depo ve 2 toplanma alanı görünüyor
- [ ] Dashboard metrikleri 0 değil (seed verisi yüklü)
- [ ] Tarayıcı geliştirici araçları kapatıldı
- [ ] Ekran paylaşımı veya projektör çözünürlüğü test edildi (1280x720 minimum)
- [ ] İnternet bağlantısı stabil (Render cold start için)

---

## Kurtarma Planları

| Senaryo | Çözüm |
|---------|-------|
| Backend 503 / cold start | Warmup scriptini tekrar çalıştır; `/health` 200 döndürmeden demo başlatma |
| Harita yüklenmiyor | OpenStreetMap tile cache sorunu olabilir; sayfayı yenile |
| Login çalışmıyor | REACT_APP_API_BASE_URL doğru mu? Network tab'dan kontrol et |
| Stoklar sıfır | seed_pilot.py yeniden çalıştırılmamış; admin panelden manuel ekle |
| Deprem verisi boş | Kandilli API geçici erişilemez — "Veri akışı güvenli fallback ile devam ediyor" de ve geç |
