# GeoSafe Quick Start Script for Windows PowerShell
# This script automates the entire setup process

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "GeoSafe Quick Start Setup" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Check prerequisites
Write-Host "Checking prerequisites..." -ForegroundColor Yellow

$checks = @{
    "docker" = "Docker and Docker Compose"
    "node" = "Node.js"
    "python" = "Python"
}

$allGood = $true
foreach ($cmd in $checks.Keys) {
    try {
        $null = & $cmd --version 2>$null
        Write-Host "   OK: $($checks[$cmd]) found" -ForegroundColor Green
    } catch {
        Write-Host "   MISSING: $($checks[$cmd]) not found" -ForegroundColor Red
        $allGood = $false
    }
}

if (-not $allGood) {
    Write-Host ""
    Write-Host "Missing prerequisites. Please install them first." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "All prerequisites found." -ForegroundColor Green
Write-Host ""

# Step 1: Start Docker containers
Write-Host "Step 1: Starting Docker containers..." -ForegroundColor Cyan
Write-Host "   Running: docker-compose up -d" -ForegroundColor Gray
docker-compose up -d
Start-Sleep -Seconds 3
Write-Host "   OK: Containers started" -ForegroundColor Green
Write-Host ""

# Step 2: Run migrations
Write-Host "Step 2: Running database migrations..." -ForegroundColor Cyan
Write-Host "   Running: alembic -c alembic\alembic.ini upgrade head" -ForegroundColor Gray
Push-Location backend
python -m alembic -c alembic\alembic.ini upgrade head
if ($LASTEXITCODE -eq 0) {
    Write-Host "   OK: Migrations applied" -ForegroundColor Green
} else {
    Write-Host "   ERROR: Migration failed" -ForegroundColor Red
    Pop-Location
    exit 1
}
Pop-Location
Write-Host ""

# Step 3: Seed database
Write-Host "Step 3: Seeding database with sample data..." -ForegroundColor Cyan
Write-Host "   Running: python scripts/seed_db.py" -ForegroundColor Gray
python scripts/seed_db.py
if ($LASTEXITCODE -eq 0) {
    Write-Host "   OK: Database seeded" -ForegroundColor Green
} else {
    Write-Host "   ERROR: Seeding failed" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 4: Install backend dependencies
Write-Host "Step 4: Installing backend dependencies..." -ForegroundColor Cyan
Write-Host "   Running: pip install -r requirements.txt" -ForegroundColor Gray
pip install -r requirements.txt -q
Write-Host "   OK: Dependencies installed" -ForegroundColor Green
Write-Host ""

# Step 5: Install frontend dependencies
Write-Host "Step 5: Installing frontend dependencies..." -ForegroundColor Cyan
Write-Host "   Running: npm install (in frontend/)" -ForegroundColor Gray
Push-Location frontend
npm install --silent 2>$null
Write-Host "   OK: Frontend dependencies installed" -ForegroundColor Green
Pop-Location
Write-Host ""

# Setup complete!
Write-Host "=====================================" -ForegroundColor Green
Write-Host "Setup Complete!" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host ""
Write-Host "Terminal 1 - Start Backend:" -ForegroundColor Cyan
Write-Host "   cd backend" -ForegroundColor Gray
Write-Host "   uvicorn app.main:app --reload" -ForegroundColor Gray
Write-Host ""
Write-Host "Terminal 2 - Start Frontend:" -ForegroundColor Cyan
Write-Host "   cd frontend" -ForegroundColor Gray
Write-Host "   npm start" -ForegroundColor Gray
Write-Host ""
Write-Host "Then visit:" -ForegroundColor Yellow
Write-Host "   Frontend:  http://localhost:3000" -ForegroundColor Cyan
Write-Host "   Backend:   http://localhost:8000/docs" -ForegroundColor Cyan
Write-Host ""
Write-Host "Happy coding! GeoSafe is ready for development." -ForegroundColor Green
Write-Host ""
