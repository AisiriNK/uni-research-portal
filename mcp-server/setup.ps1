# MCP Server Setup Script for Windows
# Run with: .\setup.ps1

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  MCP Server Setup (Windows)" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

# Check Python version
Write-Host "`n1. Checking Python version..." -ForegroundColor Yellow
try {
    $pythonVersion = & python --version 2>&1
    Write-Host "✓ $pythonVersion" -ForegroundColor Green
    
    $version = python -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"
    if ([version]$version -lt [version]"3.10") {
        Write-Host "❌ Python 3.10+ required. You have: $pythonVersion" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Python not found. Please install Python 3.10+" -ForegroundColor Red
    exit 1
}

# Check Docker
Write-Host "`n2. Checking Docker..." -ForegroundColor Yellow
$hasDocker = $false
try {
    $dockerVersion = & docker --version 2>&1
    Write-Host "✓ Docker found: $dockerVersion" -ForegroundColor Green
    $hasDocker = $true
} catch {
    Write-Host "⚠ Docker not found. Will use local Python setup." -ForegroundColor Yellow
}

# Create .env file
Write-Host "`n3. Setting up environment..." -ForegroundColor Yellow
if (-Not (Test-Path .env)) {
    Copy-Item .env.example .env
    Write-Host "✓ Created .env file" -ForegroundColor Green
    Write-Host "⚠ Please edit .env and set your API keys!" -ForegroundColor Yellow
} else {
    Write-Host "✓ .env already exists" -ForegroundColor Green
}

# Install Python dependencies
Write-Host "`n4. Installing Python dependencies..." -ForegroundColor Yellow
pip install -r requirements.txt
Write-Host "✓ Dependencies installed" -ForegroundColor Green

# Choose setup method
if ($hasDocker) {
    Write-Host "`n5. Choose setup method:" -ForegroundColor Yellow
    Write-Host "   1) Docker Compose (recommended)"
    Write-Host "   2) Local Python"
    $choice = Read-Host "Enter choice [1-2]"
    
    if ($choice -eq "1") {
        Write-Host "`nStarting with Docker Compose..." -ForegroundColor Yellow
        docker-compose up -d
        Write-Host "✓ Services started" -ForegroundColor Green
        
        # Wait for services
        Write-Host "Waiting for services to be ready..." -ForegroundColor Yellow
        Start-Sleep -Seconds 5
        
        # Health check
        try {
            $response = Invoke-WebRequest -Uri http://localhost:8001/health -UseBasicParsing
            Write-Host "✓ MCP Server is healthy!" -ForegroundColor Green
        } catch {
            Write-Host "⚠ Server might not be ready yet. Check logs: docker-compose logs" -ForegroundColor Yellow
        }
    } else {
        Write-Host "`nLocal setup selected." -ForegroundColor Yellow
        Write-Host "Please ensure Redis is running"
        Write-Host "Then start the server: python main.py"
    }
} else {
    Write-Host "`n5. Install Redis if not already installed" -ForegroundColor Yellow
    Write-Host "Download from: https://github.com/microsoftarchive/redis/releases"
    Write-Host "Then run: python main.py"
}

Write-Host "`n=========================================" -ForegroundColor Cyan
Write-Host "  Setup Complete!" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Edit .env and set API_KEY and other credentials"
Write-Host "  2. Test the server:"
Write-Host "     Invoke-WebRequest http://localhost:8001/health"
Write-Host "  3. Read QUICKSTART.md for usage examples"
Write-Host ""
Write-Host "For help, see:"
Write-Host "  - QUICKSTART.md (5-minute guide)"
Write-Host "  - README.md (full documentation)"
Write-Host ""
