# GeoSafe — Proje Durumu

**Son güncelleme:** 2026-05-31
**Aktif sprint:** Sprint 10 TAMAMLANDI ✅ — GS-070 ✅ + GS-022 ✅ + GS-061 ✅ + GS-073 ✅ (21/21 puan) · Sprint 1–10 tamamlandı (210 / 355 backlog puanı — %59)

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
| POST | /api/v1/admin/import/warehouses | Depo toplu içe aktarma (admin, JSON dizi, ?dry_run) |
| POST | /api/v1/admin/import/safe-zones | Toplanma alanı toplu içe aktarma (admin, JSON dizi, ?dry_run) |
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

## Sprint 7 — Gönüllü, Hasar Bildirimi & E2E ✅

**Hedef:** En değerli kalan koordinasyon özellikleri + GS-003 üstüne E2E test suite.

| ID | Konu | Pri | Puan | Durum |
|----|------|-----|-----:|-------|
| GS-050 | Gönüllü görev panosu & atama (open→in-progress→done) | Should | 8 | ✅ Migration 023; `VolunteerTask` model; 8 endpoints (`/volunteer-tasks`); `TasksPage` at `/ops/tasks` (tabs: open/my/all, claim/complete/cancel, coordinator create form); 20 backend tests |
| GS-042 | Fotoğraflı + konumlu hasar bildirimi (obje depolama) | Should | 5 | ✅ Migration 024 (`image_url`); `storage.py` (Supabase REST, httpx, env-gated); `POST /emergency/{id}/image` (10MB, JPEG/PNG/WebP, 503 if unconfigured); EmergencyPage photo input + preview; `test_emergency_image.py` (8 tests) |
| GS-004 | E2E smoke testler — Playwright, headless CI | Should | 8 | ✅ `e2e/` dizini; Playwright 1.44; `globalSetup` (token→storageState); `seed.py` (admin+operator+depo+stok); 3 smoke test: acil form, harita sayfası, envanter güncelleme; CI `e2e` job (needs: backend+frontend) |

**Toplam:** 21 puan | **Bağımlılık:** GS-004 → GS-003 (S6)

---

## Sprint 8 — Sohbet, Admin Analitik & Batarya ✅

**Hedef:** GS-095 ✅ hazır → chat paneli; admin KPI kartları; batarya optimizasyonu.

| ID | Konu | Pri | Puan | Durum |
|----|------|-----|-----:|-------|
| GS-110 | Online sohbet paneli (CommsChannel soyutlaması üstünde) | Should | 8 | ✅ Migration 025 (`chat_messages`); `POST/GET /api/v1/chat/messages`; `broadcast_chat_message()` via SSE; `ChatPanel.tsx` (history + live SSE + dedup); `test_chat.py` (10 tests) |
| GS-080 | KPI dashboard — depo, acil, gönüllü, yanıt süresi kartları | Should | 5 | ✅ `GET /api/v1/kpi/summary` (emergencies/tasks/warehouses/safe_zones/critical_stock/volunteer_applications); `KPISummary` type; 5 KPI kartı `DashboardPage`'e eklendi; `test_kpi.py` (4 tests) |
| GS-120 | Polling → Push geçişi (batarya tasarrufu) | Should | 3 | ✅ `useSSEStream` hook (EventSource + 5s auto-reconnect); DashboardPage polling kaldırıldı → SSE event'e tepki; `announcement` + `low_stock_alert` → KPI yenile |
| GS-121 | Düşük güç acil modu (OLED tema, animasyonsuz, kısıtlı güncelleme) | Should | 5 | ✅ `PowerModeContext` (`data-low-power` HTML attr + localStorage); `:root[data-low-power="true"]` OLED-siyah CSS; `animation: none !important`; ⚡ topbar toggle |

**Toplam:** 21 puan | **Bağımlılıklar:** GS-110 → GS-095 ✅ (S5) · GS-120 → GS-020 ✅ + GS-021 ✅

---

## Sprint 9 — Off-Grid Araştırma & Mimari ADR ✅

**Hedef:** Epic N spike'larını tamamla (Hafta 1); GS-137 ADR ile sentezle (Hafta 2).

| ID | Konu | Pri | Puan | Durum |
|----|------|-----|-----:|-------|
| GS-130 | Native mobil kabuk spike — Capacitor vs React Native değerlendirmesi | Should | 5 | ✅ `frontend/capacitor.config.ts`; Capacitor seçildi (mevcut React kodunu sargılar, yeniden yazım yok); `@capacitor/core ^6` + `@capacitor-community/bluetooth-le ^5` paketi tanımlandı |
| GS-131 | BLE P2P mesh mesajlaşma spike | Should | 8 | ✅ `src/hooks/useBLEMesh.ts` — GATT tarama/bağlantı/bildirim; `originId+id` dedup; hop-limitli flooding; 20B MTU chunking; **kısıt:** `startAdvertising()` API boşluğu + menzil gerçekliği → GS-138 ertelendi |
| GS-132 | BLE kurtarma işareti spike | Should | 5 | ✅ `src/hooks/useBLEBeacon.ts` — görev döngüsü (normal 1s / düşük güç 10s / SOS override); GS-121 PowerModeContext ile entegrasyon; özel Capacitor native plugin gereksinimi belirlendi |
| GS-137 | Off-grid mimari karar kaydı (ADR) — spike sonuçlarını sentezler | Must | 3 | ✅ `docs/adr/ADR-001-offgrid-architecture.md` — Capacitor ✅ onaylandı; Beacon (GS-132) 1. native özellik olarak onaylandı; Mesh (GS-138) ertelendi; LoRa beacon pilot sonrasına bırakıldı |

**Toplam:** 21 puan | **Bağımlılık:** GS-137 → GS-130+131+132 aynı sprint içinde (Hafta 2)

---

## Sprint Burn-Up (S1–S9)

| Sprint | Tema | Puan | Kümülatif | Toplam % |
|--------|------|-----:|----------:|---------:|
| S1–S4 ✅ | Foundation → Hardening | 84 | 84 | %24 |
| S5 ✅ | Güvenlik & Mimari Temel | 21 | 105 | %30 |
| S6 ✅ | Deprem Bildirimleri & Kalite | 21 | 126 | %35 |
| S7 ✅ | Gönüllü, Hasar & E2E | 21 | 147 | %41 |
| S8 ✅ | Sohbet, Analitik & Batarya | 21 | 168 | %47 |
| S9 ✅ | Off-Grid Araştırma & ADR | 21 | 189 | %53 |
| S10 ✅ | Erişilebilirlik, Canlı Stok & Veri Entegrasyonu | 21 | 210 | %59 |

---

## Sprint 10 — Erişilebilirlik, Canlı Stok & Veri Entegrasyonu ✅

**Hedef:** WCAG 2.1 AA temel uyum; SSE canlı envanter; toplu veri içe aktarma; yüksek kontrast modu.

| ID | Konu | Pri | Puan | Durum |
|----|------|-----|-----:|-------|
| GS-070 | WCAG 2.1 AA denetimi ve düzeltmeleri | Should | 8 | ✅ `:focus-visible` standart outline (3px #0057b8); "Ana içeriğe geç" skip link; `ops-main` `id` + `tabIndex=-1`; `aria-label` icon-only düğmeler + SOS; `aria-pressed` toggle düğmeler; `SectionHeader.title: ReactNode`; `aria-live` bölgesi stok güncellemeleri için |
| GS-022 | Operasyon panosunda canlı envanter | Could | 5 | ✅ `broadcast_inventory_update()` SSE eklendi; `inventory.py`'de her güncellemede tetikleniyor; `LogisticsPage` `useSSEStream` ile abone — `inventory_update` olayında satır güncelleme + 8s yeşil highlight + "az önce güncellendi" etiketi; `aria-live polite` bölgesi |
| GS-061 | Depo & toplanma alanı toplu içe aktarma | Should | 5 | ✅ `backend/app/api/admin_import.py` — `POST /api/v1/admin/import/warehouses` + `/safe-zones`; JSON dizi; `?dry_run=true`; isme göre idempotent upsert; max 500 satır; `ImportReport` {created,updated,skipped,errors}; AdminDashboard "Toplu İçe Aktar" sekmesi; `test_admin_import.py` (12 test) |
| GS-073 | Yüksek kontrast / büyük yazı acil durum modu | Could | 3 | ✅ `PowerModeContext` genişletildi (`highContrast` + `toggleHighContrast`); `data-high-contrast="true"` HTML attr; CSS: siyah metin/beyaz arkaplan, 110% yazı boyutu, kalın kenarlıklar, sarı halo focus ring; `◑` topbar toggle düğmesi |

**Toplam:** 21 puan

---

## Bu Döngüde Kasıtlı Ertelenenler

Gelecek döngüye park edildi (ADR/spike sonuçları bekleniyor veya öncelik düşük):

- **GS-072** Arapça RTL · **GS-023** Coğrafi alan alarmları · **GS-024** SMS fallback (op→kullanıcı)
- **GS-033** Offline harita tile cache
- **GS-041** Kayıp kişi panosu · **GS-054** Bağış eşleştirme — moderasyon tasarımı gerekli
- **GS-051** Beceri eşleştirme
- **GS-133** LoRa spike · **GS-134** GSM/SMS cihaz fallback · **GS-135/136** Uydu & Wi-Fi Direct spike
- **GS-138** Offline mesh sohbet MVP *(Won't — beacon pilot sonrasına bırakıldı, ADR-001)*

---

## Önemli Notlar

- **SSE proxy:** Render arkasında SSE bağlantıları için `X-Accel-Buffering: no` header'ı eklenmiştir. Vercel üzerinde çalışmaz — fallback olarak polling kullanılabilir.
- **ORS API key:** Ücretsiz tier 2000 req/gün. Production'dan önce temin edin: openrouteservice.org
- **VAPID key üretimi:** `python -c "from py_vapid import Vapid; v=Vapid(); v.generate_keys(); print(v.public_key, v.private_key)"`
- **PDF export:** `weasyprint` kurulu değilse `/inventory.pdf` endpoint'i CSV döndürür. İsterseniz `pip install weasyprint` ile etkinleştirilebilir.
- **i18n:** Kullanıcının tarayıcı dili TR ise Türkçe, aksi hâlde İngilizce başlar. Tercih localStorage'a kaydedilir.
- **Marker clustering:** `@changey/react-leaflet-markercluster` — react-leaflet v4 uyumlu. CSS import'u `WarehouseLayer.tsx` içinde yapılıyor.
- **Access token süresi:** Güncellendi — 24 saat → 1 saat. Refresh token 30 gün geçerli, her kullanımda rotate edilir.
- **Comms soyutlaması (GS-095):** `app/comms/` — `CommsChannel` ABC + `SSEChannel` + `PushChannel`. Chat (GS-110) ve polling→push (GS-120) bu soyutlama üstüne kuruldu. `MeshEnvelope` şeması (`useBLEMesh.ts`) ve `BeaconPayload` (`useBLEBeacon.ts`) GS-095 zarfını genişleterek tüm yeni radyo transportlarının kullanacağı canonical şemayı tanımlar (bkz. ADR-001).
- **ADR-001 (GS-137):** `docs/adr/ADR-001-offgrid-architecture.md` — Capacitor ✅ onaylandı; BLE kurtarma işareti (GS-132) ilk native özellik olarak onaylandı; BLE mesh (GS-138) alan ölçümleri tamamlanana kadar ertelendi; LoRa (GS-133) beacon pilot sonrasına bırakıldı.
- **SSE broadcast serileştirme:** `sse.py` `_broadcast` artık `json.dumps(..., default=str)` kullanır; duyuru `published_at` gibi datetime alanları yayında stringe çevrilir.
