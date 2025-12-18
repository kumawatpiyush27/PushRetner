# Quick Deployment Script for Vercel
# Run this script to deploy both backend and frontend

Write-Host "🚀 Starting Vercel Deployment..." -ForegroundColor Cyan
Write-Host ""

# Check if user is logged in to Vercel
Write-Host "📋 Step 1: Checking Vercel login status..." -ForegroundColor Yellow
vercel whoami
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Not logged in to Vercel. Please login first:" -ForegroundColor Red
    Write-Host "   Run: vercel login" -ForegroundColor White
    exit 1
}

Write-Host ""
Write-Host "✅ Logged in to Vercel!" -ForegroundColor Green
Write-Host ""

# Deploy Backend
Write-Host "📦 Step 2: Deploying Backend..." -ForegroundColor Yellow
Write-Host ""
Set-Location backend

Write-Host "⚠️  IMPORTANT: Make sure you have set these environment variables in Vercel Dashboard:" -ForegroundColor Magenta
Write-Host "   - PUBLIC_KEY" -ForegroundColor White
Write-Host "   - PRIVATE_KEY" -ForegroundColor White
Write-Host "   - MONGODB_URI" -ForegroundColor White
Write-Host ""
Write-Host "Press any key to continue with backend deployment..." -ForegroundColor Cyan
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

vercel --prod

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Backend deployed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📝 COPY YOUR BACKEND URL from above!" -ForegroundColor Yellow
    Write-Host "   You'll need it for the frontend deployment." -ForegroundColor White
    Write-Host ""
    
    $backendUrl = Read-Host "Paste your backend URL here (e.g., https://your-backend.vercel.app)"
    
    # Deploy Frontend
    Write-Host ""
    Write-Host "📱 Step 3: Deploying Frontend..." -ForegroundColor Yellow
    Write-Host ""
    Set-Location ..\frontend
    
    # Create .env.production file
    Write-Host "Creating .env.production file..." -ForegroundColor Cyan
    @"
REACT_APP_API_URL=$backendUrl
REACT_APP_PUBLIC_KEY=BN2u6-t6iC6o0CKza2ifWfNy_OSovucgNlZwgeWoMbAYME6b5qdgdDD6WIX6c_SOAF-R15ZepMt0N4eTdFZlU04
"@ | Out-File -FilePath .env.production -Encoding utf8
    
    Write-Host "✅ Environment file created!" -ForegroundColor Green
    Write-Host ""
    
    vercel --prod
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "🎉 DEPLOYMENT COMPLETE!" -ForegroundColor Green
        Write-Host ""
        Write-Host "✅ Backend: $backendUrl" -ForegroundColor Cyan
        Write-Host "✅ Frontend: Check the URL above" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "🔔 Test your push notifications now!" -ForegroundColor Yellow
    } else {
        Write-Host ""
        Write-Host "❌ Frontend deployment failed. Check the errors above." -ForegroundColor Red
    }
} else {
    Write-Host ""
    Write-Host "❌ Backend deployment failed. Check the errors above." -ForegroundColor Red
}

Set-Location ..
Write-Host ""
Write-Host "Done! 🚀" -ForegroundColor Cyan
