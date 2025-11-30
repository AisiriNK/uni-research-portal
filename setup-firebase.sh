#!/bin/bash

# Firebase Authentication Setup - Installation Script
# This script will guide you through the Firebase setup process

echo "🔥 Firebase Authentication Setup"
echo "=================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

echo "✅ Node.js found: $(node --version)"
echo ""

# Install Firebase SDK
echo "📦 Installing Firebase SDK..."
if command -v bun &> /dev/null; then
    echo "Using bun..."
    bun add firebase
else
    echo "Using npm..."
    npm install firebase
fi

echo ""
echo "✅ Firebase SDK installed"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "✅ .env file created"
    echo ""
    echo "⚠️  IMPORTANT: Edit .env and add your Firebase credentials"
    echo "   Get them from: https://console.firebase.google.com/"
    echo ""
else
    echo "✅ .env file already exists"
    echo ""
fi

# Check if Firebase CLI is installed
echo "🔧 Checking Firebase CLI..."
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI not found"
    echo "   Install it with: npm install -g firebase-tools"
    echo ""
    read -p "Install Firebase CLI now? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        npm install -g firebase-tools
        echo "✅ Firebase CLI installed"
    fi
else
    echo "✅ Firebase CLI found: $(firebase --version)"
fi

echo ""
echo "=================================="
echo "📋 Next Steps:"
echo "=================================="
echo ""
echo "1. Edit .env file with your Firebase credentials"
echo "   → Open .env and replace placeholder values"
echo ""
echo "2. Login to Firebase:"
echo "   → firebase login"
echo ""
echo "3. Initialize Firebase (if not done):"
echo "   → firebase init"
echo "   → Select Firestore and Hosting"
echo ""
echo "4. Deploy Firestore security rules:"
echo "   → firebase deploy --only firestore:rules"
echo ""
echo "5. Start development server:"
echo "   → npm run dev"
echo ""
echo "6. Create your first user:"
echo "   → Visit http://localhost:5173/signup"
echo ""
echo "=================================="
echo "📚 Documentation:"
echo "=================================="
echo ""
echo "Complete Setup:     FIREBASE_SETUP.md"
echo "Quick Reference:    FIREBASE_QUICK_REFERENCE.md"
echo "Implementation:     IMPLEMENTATION_SUMMARY.md"
echo "Quick Start:        QUICKSTART.md"
echo "Main README:        FIREBASE_AUTH_README.md"
echo ""
echo "🎉 Setup complete! Follow the next steps above."
