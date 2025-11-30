#!/usr/bin/env node

/**
 * Firebase Setup Verification Script
 * Run this script to verify your Firebase configuration
 */

const fs = require('fs');
const path = require('path');

console.log('🔥 Firebase Setup Verification\n');

// Check if .env file exists
const envPath = path.join(__dirname, '.env');
const envExamplePath = path.join(__dirname, '.env.example');

console.log('📋 Checking configuration files...\n');

if (!fs.existsSync(envPath)) {
  console.log('❌ .env file not found');
  console.log('   → Copy .env.example to .env and add your Firebase credentials');
  console.log('   → Run: cp .env.example .env\n');
} else {
  console.log('✅ .env file exists');
  
  // Read and check for Firebase variables
  const envContent = fs.readFileSync(envPath, 'utf8');
  const requiredVars = [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_STORAGE_BUCKET',
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    'VITE_FIREBASE_APP_ID'
  ];
  
  const missingVars = [];
  const placeholderVars = [];
  
  requiredVars.forEach(varName => {
    if (!envContent.includes(varName)) {
      missingVars.push(varName);
    } else {
      const match = envContent.match(new RegExp(`${varName}=(.+)`));
      if (match && (match[1].includes('your_') || match[1].includes('here'))) {
        placeholderVars.push(varName);
      }
    }
  });
  
  if (missingVars.length > 0) {
    console.log('❌ Missing Firebase variables:');
    missingVars.forEach(v => console.log(`   - ${v}`));
    console.log('');
  }
  
  if (placeholderVars.length > 0) {
    console.log('⚠️  Firebase variables have placeholder values:');
    placeholderVars.forEach(v => console.log(`   - ${v}`));
    console.log('   → Update these with your actual Firebase credentials\n');
  }
  
  if (missingVars.length === 0 && placeholderVars.length === 0) {
    console.log('✅ All Firebase variables are configured\n');
  }
}

// Check if required files exist
console.log('📁 Checking required files...\n');

const requiredFiles = [
  'src/config/firebase.ts',
  'src/contexts/AuthContext.tsx',
  'src/types/user.ts',
  'src/components/ProtectedRoute.tsx',
  'src/pages/Login.tsx',
  'src/pages/Signup.tsx',
  'src/pages/StudentDashboard.tsx',
  'src/pages/TeacherDashboard.tsx',
  'firestore.rules',
  'firebase.json'
];

let allFilesExist = true;

requiredFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - MISSING`);
    allFilesExist = false;
  }
});

console.log('');

// Check package.json for Firebase
const packageJsonPath = path.join(__dirname, 'package.json');
if (fs.existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  
  console.log('📦 Checking dependencies...\n');
  
  if (packageJson.dependencies && packageJson.dependencies.firebase) {
    console.log(`✅ Firebase SDK installed (v${packageJson.dependencies.firebase})`);
  } else {
    console.log('❌ Firebase SDK not installed');
    console.log('   → Run: npm install firebase');
    console.log('   → Or: bun add firebase\n');
  }
}

// Final summary
console.log('\n' + '='.repeat(50));
console.log('📊 Setup Summary\n');

if (!fs.existsSync(envPath)) {
  console.log('⚠️  Next Steps:');
  console.log('1. Copy .env.example to .env');
  console.log('2. Add your Firebase credentials to .env');
  console.log('3. Run: npm install firebase');
  console.log('4. Read FIREBASE_SETUP.md for detailed instructions');
} else if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const hasPlaceholders = envContent.includes('your_') || envContent.includes('here');
  
  if (hasPlaceholders) {
    console.log('⚠️  Next Steps:');
    console.log('1. Update .env with your actual Firebase credentials');
    console.log('2. Ensure Firebase SDK is installed: npm install firebase');
    console.log('3. Deploy Firestore rules: firebase deploy --only firestore:rules');
    console.log('4. Start development server: npm run dev');
  } else if (allFilesExist) {
    console.log('✅ Configuration looks good!');
    console.log('\n📚 Next Steps:');
    console.log('1. Deploy Firestore rules: firebase deploy --only firestore:rules');
    console.log('2. Start development server: npm run dev');
    console.log('3. Visit http://localhost:5173/signup to create your first user');
  }
}

console.log('\n📖 Documentation:');
console.log('   - Full Setup Guide: FIREBASE_SETUP.md');
console.log('   - Quick Reference: FIREBASE_QUICK_REFERENCE.md');
console.log('   - Implementation Details: IMPLEMENTATION_SUMMARY.md');
console.log('='.repeat(50) + '\n');
