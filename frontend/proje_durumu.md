# GeoSafe — Proje Durumu

**Son güncelleme:** 2026-05-31
**Aktif sprint:** Sprint 6 TAMAMLANDI ✅ — GS-100 ✅ + GS-101 ✅ + GS-003 ✅ + GS-017 ✅ + GS-007 ✅ (21/21 puan) · Sprint 1–6 tamamlandı (134 / 355 backlog puanı — %38)

---

## Genel Mimari

| Katman | Stack |
|--------|-------|
| Backend | FastAPI + SQLAlchemy 2.0 (async) + PostGIS/GeoAlchemy2 |
| DB | PostgreSQL + PostGIS (Supabase production) |
| Migrations | Alembic (001 → 022 uygulandı) |
| Frontend | React 18 + TypeScript + Vite (react-scripts) |
| Harita | Leaflet.js + react-leaflet v4 |
| Deploy | Render (backend) + Vercel (frontend) |

---

## Sprint 1 — Foundation & Trust ✅

| ID | Konu | Durum |
|----|------|-------|
| GS-001 | CI pipeline (GitHub Actions) | ✅ `.github/workflows/ci.yml` — backend pytest+ruff, frontend lint+test+build |
| GS-002 | Pre-commit hooks | ✅ `.pre-commit-config.yaml` — ruff-format, prettier, end-of-file-fixer |
| GS-012 | Security headers | ✅ `SecurityHeadersMiddleware` — HSTS, X-Frame-Options, CSP, X-XSS-Protection, Permissions-Policy |
| GS-060 | Deprem feed + cache | ✅ `earthquakes.py` — asyncio.Lock tabanlı 5 dk TTL cache, stale fallback |
| GS-092 | Config validation | ✅ `_validate_config()` — startup'ta JWT, DATABASE_URL, CORS kontrolü |
| GS-016 | KVKK/GDPR | ✅ `GET /api/v1/profile/my-data` + `DELETE /api/v1/profile/me` (anonimleştirme) |

---

## Sprint 2 — Real-Time Safety ✅

| ID | Konu | Durum |
|----|------|-------|
| GS-010 | Refresh token | ✅ Migration 013, `POST /auth/refresh` + `POST /auth/logout`, token rotation |
| GS-020 | SSE canlı kanal | ✅ `sse.py` — `GET /api/v1/sse/announcements`, heartbeat 25 s, `broadcast_announcement()` |
| GS-040 | "Güvendeyim" check-in | ✅ Migration 014, `POST /api/v1/checkin`, `/mine`, admin liste; anonim+auth destek |
| GS-005 | Sentry | ✅ backend: `sentry-sdk[fastapi]` (SENTRY_DSN env); frontend: `@sentry/react` (REACT_APP_SENTRY_DSN env) |

---

## Sprint 3 — Guidance & Coordination ✅

| ID | Konu | Durum |
|----|------|-------|
| GS-030 | Gerçek rota | ✅ `routing.py` — `GET /api/v1/routing/directions`, ORS API (yürüyüş + adımlar) + düz çizgi fallback; `RouteLayer.tsx` güncellendi |
| GS-052 | Depo-arası transfer | ✅ Migration 015, `POST /api/v1/transfers` + `/approve` + `/reject`; stok kontrolü + InventoryMovement log |
| GS-053 | Alan ihtiyaç bildirimi | ✅ Migration 016, `POST /api/v1/zone-needs`, `/zone/{id}`, `/close` |
| GS-081 | Düşük stok alarmı | ✅ SSE üzerinden `broadcast_low_stock_alert()` — envanter her güncellendiğinde eşik kontrolü |

---

## Sprint 5 — Güvenlik Derinleştirme & Mimari Temel ✅

| ID | Konu | Durum |
|----|------|-------|
| GS-095 | Transport soyutlama (CommsChannel interface) | ✅ `app/comms/` — `CommsChannel` ABC + `SSEChannel` + `PushChannel`; Sprint 8 chat için zemin |
| GS-011 | Şifre sıfırlama + e-posta doğrulama | ✅ Migration 020; `POST /auth/forgot-password`, `/reset-password`, `/verify-email`, `/resend-verification`; SMTP `app/core/email.py` |
| GS-013 | Granüler RBAC (citizen/volunteer/operator/admin) | ✅ Migration 018; User.role varsayılanı `citizen`; `PATCH /auth/users/{id}/role` (admin); `viewer` → `citizen` otomigrasyon |
| GS-014 | Audit log | ✅ Migration 019; `audit_logs` tablosu; `app/core/audit.py`; warehouse create/update/delete + transfer approve/reject kaydı |
| GS-006 | Yapılandırılmış JSON loglama + request ID | ✅ `app/core/logging_config.py` — `JSONFormatter` + `RequestIDMiddleware`; her response'a `X-Request-ID` header'ı |
| GS-015 | pip-audit + gitleaks CI | ✅ `ci.yml` — pip-audit adımı backend job'a eklendi; `secrets-scan` job (gitleaks-action@v2) |

---

## Sprint 4 — Reach & Hardening ✅

| ID | Konu | Durum |
|----|------|-------|
| GS-021 | Web Push | ✅ Migration 017, `push.py` — VAPID subscribe/send, `service-worker.js` push+notificationclick handler |
| GS-071 | i18n TR/EN | ✅ `react-i18next` + `i18n/locales/tr.json` + `en.json` + `LanguageSwitcher.tsx` |
| GS-062 | Marker clustering | ✅ `@changey/react-leaflet-markercluster` + viewport filtreleme (`WarehouseLayer.tsx`) |
| GS-082 | Raporlar CSV/PDF | ✅ `reports.py` — `/inventory.csv`, `/inventory.pdf` (weasyprint; yoksa CSV), `/movements.csv`, `/checkins.csv` |

---

## Yeni API Endpoint'leri (Bu Cycle'da Eklenenler)

| Method | Path | Açıklama |
|--------|------|----------|
| POST | /api/v1/auth/refresh | Access token yenileme (refresh token) |
| POST | /api/v1/auth/logout | Server-side oturum kapatma |
| GET | /api/v1/profile/my-data | KVKK — kişisel veri ihracı |
| DELETE | /api/v1/profile/me | KVKK — hesap anonimleştirme |
| GET | /api/v1/sse/announcements | SSE canlı duyuru stream'i |
| GET | /api/v1/sse/health | Bağlı SSE client sayısı |
| POST | /api/v1/checkin | Güvendeyim bildirimi |
| GET | /api/v1/checkin/mine | Kendi check-in'lerim |
| GET | /api/v1/checkin | Tüm check-in'ler (admin) |
| GET | /api/v1/routing/directions | ORS yürüyüş rotası + fallback |
| POST | /api/v1/transfers | Transfer talebi oluştur |
| GET | /api/v1/transfers | Transfer listesi |
| PATCH | /api/v1/transfers/{id}/approve | Transfer onayla + envanter güncelle |
| PATCH | /api/v1/transfers/{id}/reject | Transfer reddet |
| POST | /api/v1/zone-needs | Alan ihtiyaç bildirimi |
| GET | /api/v1/zone-needs | Tüm ihtiyaçlar |
| GET | /api/v1/zone-needs/zone/{id} | Alan bazlı ihtiyaçlar |
| PATCH | /api/v1/zone-needs/{id}/close | İhtiyaç kapat |
| GET | /api/v1/push/vapid-public | VAPID public key |
| POST | /api/v1/push/subscribe | Push aboneliği kaydet |
| DELETE | /api/v1/push/subscribe | Push aboneliği iptal |
| POST | /api/v1/push/send | Tüm abonelere push gönder (admin) |
| GET | /api/v1/reports/inventory.csv | Envanter CSV raporu (admin) |
| GET | /api/v1/reports/inventory.pdf | Envanter PDF raporu (admin) |
| GET | /api/v1/reports/movements.csv | Hareket geçmişi CSV (admin) |
| GET | /api/v1/reports/checkins.csv | Check-in geçmişi CSV (admin) |
| GET | /api/v1/earthquakes/preferences | Deprem bildirim tercihim (auth) |
| PUT | /api/v1/earthquakes/preferences | Deprem bildirim tercihi upsert (auth) |
| POST | /api/v1/earthquakes/dispatch-notifications | Deprem→kullanıcı eşleştirme + Web Push taraması (admin) |

---

## Yeni Alembic Migration'ları

| Rev | İçerik |
|-----|--------|
| 013 | `users` tablosuna `refresh_token`, `refresh_token_expires_at` kolonları |
| 014 | `safe_checkins` tablosu |
| 015 | `transfer_requests` tablosu |
| 016 | `zone_needs` tablosu |
| 017 | `push_subscriptions` tablosu |
| 018 | `users.role` varsayılanı `citizen` olarak güncellendi; `viewer` → `citizen` otomigrasyon |
| 019 | `audit_logs` tablosu |
| 020 | `users` tablosuna e-posta doğrulama + şifre sıfırlama kolonları |
| 021 | `earthquake_notification_prefs` tablosu (GS-100) |
| 022 | `earthquake_notifications_sent` tablosu — bildirim dedup (GS-101) |

---

## Yeni Frontend Dosyaları

| Dosya | Açıklama |
|-------|----------|
| `src/i18n/index.ts` | i18next başlatma, dil tercihini localStorage'a kaydeder |
| `src/i18n/locales/tr.json` | Türkçe çeviri dizileri |
| `src/i18n/locales/en.json` | İngilizce çeviri dizileri |
| `src/components/LanguageSwitcher.tsx` | TR/EN dil değiştirme butonu |
| `src/components/RouteLayer.tsx` | Güncellendi: ORS API + ETA + adım adım tarif popup |
| `src/components/WarehouseLayer.tsx` | Güncellendi: MarkerClusterGroup + viewport filtreleme |

---

## Env Değişkenleri (Yeni)

### Backend (.env)
```
SENTRY_DSN=           # Sentry project DSN (opsiyonel)
ORS_API_KEY=          # OpenRouteService API key (opsiyonel; yoksa düz çizgi)
VAPID_PUBLIC_KEY=     # Web Push VAPID public key
VAPID_PRIVATE_KEY=    # Web Push VAPID private key
VAPID_SUBJECT=        # mailto:admin@domain.com
ENVIRONMENT=          # production | development (Sentry için)
LOG_LEVEL=            # INFO (varsayılan) | DEBUG | WARNING
SMTP_HOST=            # SMTP sunucusu (opsiyonel; yoksa e-posta devre dışı)
SMTP_PORT=            # 587 (varsayılan)
SMTP_USER=            # SMTP kullanıcı adı / gönderen
SMTP_PASSWORD=        # SMTP şifre
SMTP_FROM=            # Gönderen adres (boşsa SMTP_USER kullanılır)
APP_BASE_URL=         # Frontend URL (e-posta linklerinde; varsayılan http://localhost:3000)
```

### Frontend (.env)
```
REACT_APP_SENTRY_DSN=    # Sentry project DSN (opsiyonel)
REACT_APP_API_URL=       # Backend URL (default: http://localhost:8000)
```

---

## Planlanan Sprintler (S6–S9)

### Bağımlılık Zinciri

```
GS-095 ✅ (S5) ──► GS-110 (S8)   — transport soyutlama hazır, chat paneli açılabilir
GS-003 (S6) ──► GS-004 (S7)   — frontend testler E2E için zorunlu
GS-021 ✅ + GS-060 ✅ ──► GS-100 (S6)   — deprem bildirimleri hemen başlayabilir
GS-130+131+132 (S9) ──► GS-137 (S9)   — spike'lar ADR'dan önce bitmeli
```

---

## Sprint 6 — Akıllı Deprem Bildirimleri & Kalite ⏳ (Aktif)

**Hedef:** Must deprem bildirim sistemi (GS-021 ✅ + GS-060 ✅ bağımlılıkları karşılandı) + frontend test altyapısı.

| ID | Konu | Pri | Puan | Durum |
|----|------|-----|-----:|-------|
| GS-100 | Deprem bildirim tercihleri (mag, mesafe, derinlik kuralları) | Must | 5 | ✅ Migration 021; `GET/PUT /earthquakes/preferences`; `core/eq_matching.py` saf yüklem; feed'e lat/lon eklendi |
| GS-101 | Kullanıcı bazlı kural & eşleştirme motoru | Should | 3 | ✅ Migration 022; `core/eq_notify.py` (find_matches + dispatch + dedup); `POST /earthquakes/dispatch-notifications` (admin, Web Push) |
| GS-003 | Frontend kritik akış testleri (≥%60 kapsam) | Should | 8 | ✅ 103 test (13 suite): login · emergency · QRCard · AuthContext · API methods · offline context |
| GS-017 | Halkın formlarına abuse koruması (rate-limit + bot mitigasyon) | Should | 3 | ✅ `DuplicateFilter` (SHA-256 hash/IP/60s) + `volunteer_limiter` + `shelter_limiter` (5/60s); `blocked_count`/`rejected_count`; `GET /api/v1/admin/abuse-metrics`; `test_public_form_abuse.py` (13 tests) |
| GS-007 | `/ready` + `/metrics` endpoint | Could | 2 | ✅ `GET /ready` (DB SELECT 1, 503 on fail); `GET /metrics` (Prometheus text — `http_requests_total`, `http_request_duration_seconds_sum/count`); `MetricsMiddleware` (path normalization `/{id}`); `test_observability.py` (12 tests) |

**Toplam:** 21 puan | **GS-003 biter → GS-004 açılır**

---

## Sprint 7 — Gönüllü, Hasar Bildirimi & E2E ⏳

**Hedef:** En değerli kalan koordinasyon özellikleri + GS-003 üstüne E2E test suite.

| ID | Konu | Pri | Puan | Durum |
|----|------|-----|-----:|-------|
| GS-050 | Gönüllü görev panosu & atama (open→in-progress→done) | Should | 8 | ⏳ |
| GS-042 | Fotoğraflı + konumlu hasar bildirimi (obje depolama) | Should | 5 | ⏳ |
| GS-004 | E2E smoke testler — Playwright, headless CI | Should | 8 | ⏳ |

**Toplam:** 21 puan | **Bağımlılık:** GS-004 → GS-003 (S6)

---

## Sprint 8 — Sohbet, Admin Analitik & Batarya ⏳

**Hedef:** GS-095 ✅ hazır → chat paneli; admin KPI kartları; batarya optimizasyonu.

| ID | Konu | Pri | Puan | Durum |
|----|------|-----|-----:|-------|
| GS-110 | Online sohbet paneli (CommsChannel soyutlaması üstünde) | Should | 8 | ⏳ |
| GS-080 | KPI dashboard — depo, acil, gönüllü, yanıt süresi kartları | Should | 5 | ⏳ |
| GS-120 | Polling → Push geçişi (batarya tasarrufu) | Should | 3 | ⏳ |
| GS-121 | Düşük güç acil modu (OLED tema, animasyonsuz, kısıtlı güncelleme) | Should | 5 | ⏳ |

**Toplam:** 21 puan | **Bağımlılıklar:** GS-110 → GS-095 ✅ (S5) · GS-120 → GS-020 ✅ + GS-021 ✅

---

## Sprint 9 — Off-Grid Araştırma & Mimari ADR ⏳

**Hedef:** Epic N spike'larını tamamla (Hafta 1); GS-137 ADR ile sentezle (Hafta 2).

| ID | Konu | Pri | Puan | Durum |
|----|------|-----|-----:|-------|
| GS-130 | Native mobil kabuk spike — Capacitor vs React Native değerlendirmesi | Should | 5 | ⏳ |
| GS-131 | BLE P2P mesh mesajlaşma spike | Should | 8 | ⏳ |
| GS-132 | BLE kurtarma işareti spike | Should | 5 | ⏳ |
| GS-137 | Off-grid mimari karar kaydı (ADR) — spike sonuçlarını sentezler | Must | 3 | ⏳ |

**Toplam:** 21 puan | **Bağımlılık:** GS-137 → GS-130+131+132 aynı sprint içinde (Hafta 2)

---

## Sprint Burn-Up (S1–S9)

| Sprint | Tema | Puan | Kümülatif | Toplam % |
|--------|------|-----:|----------:|---------:|
| S1–S4 ✅ | Foundation → Hardening | 84 | 84 | %24 |
| S5 ✅ | Güvenlik & Mimari Temel | 21 | 105 | %30 |
| S6 ⏳ | Deprem Bildirimleri & Kalite | 21 | 126 | %35 |
| S7 ⏳ | Gönüllü, Hasar & E2E | 21 | 147 | %41 |
| S8 ⏳ | Sohbet, Analitik & Batarya | 21 | 168 | %47 |
| S9 ⏳ | Off-Grid Araştırma & ADR | 21 | 189 | %53 |

---

## Bu Döngüde Kasıtlı Ertelenenler

Gelecek döngüye park edildi (ADR/spike sonuçları bekleniyor veya öncelik düşük):

- **GS-070** WCAG denetimi · **GS-072** Arapça RTL · **GS-073** Yüksek kontrast modu
- **GS-022** Canlı envanter dashboard · **GS-023** Coğrafi alan alarmları · **GS-024** SMS fallback (op→kullanıcı)
- **GS-033** Offline harita tile cache
- **GS-041** Kayıp kişi panosu · **GS-054** Bağış eşleştirme — moderasyon tasarımı gerekli
- **GS-051** Beceri eşleştirme · **GS-061** Toplu GeoJSON/CSV import
- **GS-133** LoRa spike · **GS-134** GSM/SMS cihaz fallback · **GS-135/136** Uydu & Wi-Fi Direct spike
- **GS-138** Offline mesh sohbet MVP *(Won't — GS-137 ADR'ı bekliyor)*

---

## Önemli Notlar

- **SSE proxy:** Render arkasında SSE bağlantıları için `X-Accel-Buffering: no` header'ı eklenmiştir. Vercel üzerinde çalışmaz — fallback olarak polling kullanılabilir.
- **ORS API key:** Ücretsiz tier 2000 req/gün. Production'dan önce temin edin: openrouteservice.org
- **VAPID key üretimi:** `python -c "from py_vapid import Vapid; v=Vapid(); v.generate_keys(); print(v.public_key, v.private_key)"`
- **PDF export:** `weasyprint` kurulu değilse `/inventory.pdf` endpoint'i CSV döndürür. İsterseniz `pip install weasyprint` ile etkinleştirilebilir.
- **i18n:** Kullanıcının tarayıcı dili TR ise Türkçe, aksi hâlde İngilizce başlar. Tercih localStorage'a kaydedilir.
- **Marker clustering:** `@changey/react-leaflet-markercluster` — react-leaflet v4 uyumlu. CSS import'u `WarehouseLayer.tsx` içinde yapılıyor.
- **Access token süresi:** Güncellendi — 24 saat → 1 saat. Refresh token 30 gün geçerli, her kullanımda rotate edilir.
- **Comms soyutlaması (GS-095):** `app/comms/` — `CommsChannel` ABC + `SSEChannel` + `PushChannel`. Sprint 8'de chat (GS-110) ve polling→push (GS-120) bu soyutlama üstüne kurulacak.
- **SSE broadcast serileştirme:** `sse.py` `_broadcast` artık `json.dumps(..., default=str)` kullanır; duyuru `published_at` gibi datetime alanları yayında stringe çevrilir.
