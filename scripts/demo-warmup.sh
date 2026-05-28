#!/usr/bin/env bash
# ============================================================
# GeoSafe Demo Warmup Script (Linux/macOS bash)
# Demo başlamadan 5-10 dakika önce çalıştırın.
# ============================================================

BACKEND_URL="${1:-https://geosafe-backend.onrender.com}"
MAX_ATTEMPTS=6
WAIT_SECONDS=10

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'

echo ""
echo -e "${CYAN}=== GeoSafe Demo Warmup ===${NC}"
echo -e "Backend: ${BACKEND_URL}"
echo ""

# 1. Backend health check
echo -e "${YELLOW}1. Backend health check (max $((MAX_ATTEMPTS * WAIT_SECONDS)) sn)...${NC}"
READY=false
for i in $(seq 1 $MAX_ATTEMPTS); do
    echo -e "   Deneme $i/$MAX_ATTEMPTS..."
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 "${BACKEND_URL}/health")
    if [ "$HTTP_CODE" = "200" ]; then
        READY=true
        echo -e "   ${GREEN}Backend hazir! (HTTP 200)${NC}"
        break
    fi
    if [ "$i" -lt "$MAX_ATTEMPTS" ]; then
        echo -e "   Bekleniyor ${WAIT_SECONDS} sn..."
        sleep $WAIT_SECONDS
    fi
done

if [ "$READY" = false ]; then
    echo -e "\n${RED}UYARI: Backend yanit vermedi. Render log kontrol edin.${NC}"
    exit 1
fi

# 2. Endpoint ısınma
echo ""
echo -e "${YELLOW}2. Kritik endpointler kontrol ediliyor...${NC}"
check() {
    local url="$1" label="$2"
    code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 "$url")
    if [ "$code" = "200" ]; then
        echo -e "  ${GREEN}[OK]${NC} $label"
    else
        echo -e "  ${RED}[!!]${NC} $label (HTTP $code)"
    fi
}
check "${BACKEND_URL}/api/v1/warehouses"    "Depolar (warehouses)"
check "${BACKEND_URL}/api/v1/safe-zones"   "Toplanma Alanları (safe-zones)"
check "${BACKEND_URL}/api/v1/earthquakes"  "Deprem feed (earthquakes)"
check "${BACKEND_URL}/api/v1/announcements" "Duyurular (announcements)"

# 3. Özet
echo ""
echo -e "${CYAN}=== Demo Hesapları ===${NC}"
echo -e "  Admin  : admin@geosafe.com / admin123"
echo -e "  User   : user@geosafe.com  / user123"
echo ""
echo -e "${CYAN}=== Demo Akışı ===${NC}"
echo -e "  1. Admin ile giris → Dashboard metriklerini goster"
echo -e "  2. Harita → Depo ve toplanma alanlari goster"
echo -e "  3. Vatandas arama → En yakin depo sorgusu calistir"
echo -e "  4. SOS butonu → Acil bildirim gonder"
echo -e "  5. Admin paneli → Bildirimi gor, stok guncelle"
echo -e "  6. QR Kimlik → Karti indir"
echo ""
echo -e "${GREEN}Demo hazir!${NC}"
echo ""
