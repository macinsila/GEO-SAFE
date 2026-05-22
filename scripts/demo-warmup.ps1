# ============================================================
# GeoSafe Demo Warmup Script (Windows PowerShell)
# Demo başlamadan 5-10 dakika önce çalıştırın.
# Render ücretsiz tier'da backend uyku modundan çıkar.
# ============================================================

param(
    [string]$BackendUrl = "https://geosafe-backend.onrender.com"
)

Write-Host ""
Write-Host "=== GeoSafe Demo Warmup ===" -ForegroundColor Cyan
Write-Host "Backend: $BackendUrl" -ForegroundColor Gray
Write-Host ""

function Check-Endpoint {
    param([string]$Url, [string]$Label)
    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 45 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            Write-Host "  [OK] $Label" -ForegroundColor Green
            return $true
        }
    } catch {
        Write-Host "  [!!] $Label - $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
    return $false
}

# 1. Health check — backend uyandır
Write-Host "1. Backend health check..." -ForegroundColor Yellow
$attempt = 1
$maxAttempts = 6
$ready = $false

while ($attempt -le $maxAttempts -and -not $ready) {
    Write-Host "   Deneme $attempt/$maxAttempts..." -ForegroundColor Gray
    try {
        $response = Invoke-WebRequest -Uri "$BackendUrl/health" -UseBasicParsing -TimeoutSec 45 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            $ready = $true
            Write-Host "   Backend hazir!" -ForegroundColor Green
        }
    } catch {
        if ($attempt -lt $maxAttempts) {
            Write-Host "   Bekleniyor (10 sn)..." -ForegroundColor Gray
            Start-Sleep -Seconds 10
        }
    }
    $attempt++
}

if (-not $ready) {
    Write-Host ""
    Write-Host "UYARI: Backend $maxAttempts denemede yanit vermedi." -ForegroundColor Red
    Write-Host "Render dashboard'dan log kontrol edin: https://dashboard.render.com" -ForegroundColor Yellow
    exit 1
}

# 2. Kritik endpointleri ısıt
Write-Host ""
Write-Host "2. Kritik endpointler kontrol ediliyor..." -ForegroundColor Yellow
Check-Endpoint "$BackendUrl/api/v1/warehouses" "Depolar (warehouses)"
Check-Endpoint "$BackendUrl/api/v1/safe-zones" "Toplanma Alanları (safe-zones)"
Check-Endpoint "$BackendUrl/api/v1/earthquakes" "Deprem feed (earthquakes)"
Check-Endpoint "$BackendUrl/api/v1/announcements" "Duyurular (announcements)"

# 3. Demo özet
Write-Host ""
Write-Host "=== Demo Hesapları ===" -ForegroundColor Cyan
Write-Host "  Admin  : admin@geosafe.com / admin123" -ForegroundColor White
Write-Host "  User   : user@geosafe.com  / user123" -ForegroundColor White
Write-Host ""
Write-Host "=== Demo Akışı Hatırlatma ===" -ForegroundColor Cyan
Write-Host "  1. Admin ile giris → Dashboard metriklerini goster" -ForegroundColor White
Write-Host "  2. Harita → Depo ve toplanma alanlari" -ForegroundColor White
Write-Host "  3. Vatandas arama → En yakin depo sorgusu" -ForegroundColor White
Write-Host "  4. SOS butonuna bas → Acil bildirim gonder" -ForegroundColor White
Write-Host "  5. Admin paneli → Bildirimi gor ve stok guncelle" -ForegroundColor White
Write-Host "  6. QR Kimlik → Karti indir" -ForegroundColor White
Write-Host ""
Write-Host "Demo hazir! Frontend: https://<proje-adi>.vercel.app" -ForegroundColor Green
Write-Host ""
