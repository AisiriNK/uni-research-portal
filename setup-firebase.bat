@echo off
REM Firebase Authentication Setup - Installation Script for Windows
REM This script will guide you through the Firebase setup process

echo.
echo ===================================
echo 🔥 Firebase Authentication Setup
echo ===================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Node.js is not installed. Please install Node.js first.
    exit /b 1
)

echo ✅ Node.js found
node --version
echo.

REM Install Firebase SDK
echo 📦 Installing Firebase SDK...
where bun >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo Using bun...
    bun add firebase
) else (
    echo Using npm...
    npm install firebase
)

echo.
echo ✅ Firebase SDK installed
echo.

REM Check if .env exists
if not exist .env (
    echo 📝 Creating .env file from template...
    copy .env.example .env
    echo ✅ .env file created
    echo.
    echo ⚠️  IMPORTANT: Edit .env and add your Firebase credentials
    echo    Get them from: https://console.firebase.google.com/
    echo.
) else (
    echo ✅ .env file already exists
    echo.
)

REM Check if Firebase CLI is installed
echo 🔧 Checking Firebase CLI...
where firebase >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Firebase CLI not found
    echo    Install it with: npm install -g firebase-tools
    echo.
    set /p INSTALL="Install Firebase CLI now? (y/n): "
    if /i "%INSTALL%"=="y" (
        npm install -g firebase-tools
        echo ✅ Firebase CLI installed
    )
) else (
    echo ✅ Firebase CLI found
    firebase --version
)

echo.
echo ===================================
echo 📋 Next Steps:
echo ===================================
echo.
echo 1. Edit .env file with your Firebase credentials
echo    → Open .env and replace placeholder values
echo.
echo 2. Login to Firebase:
echo    → firebase login
echo.
echo 3. Initialize Firebase (if not done):
echo    → firebase init
echo    → Select Firestore and Hosting
echo.
echo 4. Deploy Firestore security rules:
echo    → firebase deploy --only firestore:rules
echo.
echo 5. Start development server:
echo    → npm run dev
echo.
echo 6. Create your first user:
echo    → Visit http://localhost:5173/signup
echo.
echo ===================================
echo 📚 Documentation:
echo ===================================
echo.
echo Complete Setup:     FIREBASE_SETUP.md
echo Quick Reference:    FIREBASE_QUICK_REFERENCE.md
echo Implementation:     IMPLEMENTATION_SUMMARY.md
echo Quick Start:        QUICKSTART.md
echo Main README:        FIREBASE_AUTH_README.md
echo.
echo 🎉 Setup complete! Follow the next steps above.
echo.
pause
