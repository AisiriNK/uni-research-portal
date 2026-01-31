/**
 * Firestore Connection Diagnostic Tool
 * Tests connectivity and permissions to Firestore
 */

import { config } from 'dotenv';
import admin from 'firebase-admin';
import { readFileSync, existsSync } from 'fs';

config();

console.log('🔍 Firestore Connection Diagnostic\n');
console.log('═'.repeat(50));

// Step 1: Check environment
console.log('\n1️⃣ Checking Environment Variables...');
console.log('   Project ID:', process.env.VITE_FIREBASE_PROJECT_ID || '❌ MISSING');

if (!process.env.VITE_FIREBASE_PROJECT_ID) {
  console.error('   ❌ VITE_FIREBASE_PROJECT_ID not found in .env');
  process.exit(1);
}
console.log('   ✓ Environment OK\n');

// Step 2: Check service account
console.log('2️⃣ Checking Service Account Key...');
const serviceAccountPath = './serviceAccountKey.json';

if (!existsSync(serviceAccountPath)) {
  console.error('   ❌ serviceAccountKey.json not found');
  console.error('   Download from Firebase Console > Project Settings > Service Accounts');
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
console.log('   ✓ Service account file found');
console.log('   Project ID from key:', serviceAccount.project_id);
console.log('   Client email:', serviceAccount.client_email);

if (serviceAccount.project_id !== process.env.VITE_FIREBASE_PROJECT_ID) {
  console.warn('   ⚠️  Project ID mismatch!');
  console.warn('      .env:', process.env.VITE_FIREBASE_PROJECT_ID);
  console.warn('      key:', serviceAccount.project_id);
}
console.log();

// Step 3: Initialize Firebase Admin
console.log('3️⃣ Initializing Firebase Admin SDK...');
try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  });
  console.log('   ✓ Firebase Admin initialized\n');
} catch (error) {
  console.error('   ❌ Initialization failed:', error.message);
  process.exit(1);
}

const db = admin.firestore();

// Step 4: Test read operation
console.log('4️⃣ Testing READ operation...');
const readTimeout = setTimeout(() => {
  console.error('   ❌ Read operation timed out (10s)');
  console.error('   This suggests network connectivity issues');
  process.exit(1);
}, 10000);

try {
  const snapshot = await db.collection('admins').limit(1).get();
  clearTimeout(readTimeout);
  console.log('   ✓ Read successful');
  console.log('   Documents found:', snapshot.size);
  console.log();
} catch (error) {
  clearTimeout(readTimeout);
  console.error('   ❌ Read failed:', error.message);
  console.error('   Error code:', error.code);
  process.exit(1);
}

// Step 5: Test write operation
console.log('5️⃣ Testing WRITE operation...');
const writeTimeout = setTimeout(() => {
  console.error('   ❌ Write operation timed out (10s)');
  console.error('   Possible causes:');
  console.error('      - Firewall blocking outbound connections');
  console.error('      - Corporate proxy/VPN');
  console.error('      - Firestore security rules blocking writes');
  process.exit(1);
}, 10000);

try {
  const testRef = db.collection('_diagnostic_test').doc('connection_test');
  await testRef.set({ 
    test: true, 
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    message: 'Diagnostic test successful'
  });
  clearTimeout(writeTimeout);
  console.log('   ✓ Write successful');
  
  // Clean up test document
  await testRef.delete();
  console.log('   ✓ Cleanup successful');
  console.log();
} catch (error) {
  clearTimeout(writeTimeout);
  console.error('   ❌ Write failed:', error.message);
  console.error('   Error code:', error.code);
  
  if (error.code === 'PERMISSION_DENIED') {
    console.error('\n   🔧 Solution: Check Firestore security rules');
    console.error('      Service account should bypass rules, but verify');
  }
  process.exit(1);
}

// Step 6: Network diagnostics
console.log('6️⃣ Network Diagnostics...');
console.log('   Testing connection to firestore.googleapis.com...');

const https = await import('https');
const testConnection = new Promise((resolve, reject) => {
  const timeout = setTimeout(() => {
    req.destroy();
    reject(new Error('Connection timeout'));
  }, 5000);
  
  const req = https.get('https://firestore.googleapis.com', (res) => {
    clearTimeout(timeout);
    resolve(res.statusCode);
  });
  
  req.on('error', (err) => {
    clearTimeout(timeout);
    reject(err);
  });
});

try {
  const statusCode = await testConnection;
  console.log('   ✓ Network connection OK (Status:', statusCode + ')');
} catch (error) {
  console.error('   ❌ Network connection failed:', error.message);
  console.error('   Possible causes:');
  console.error('      - No internet connection');
  console.error('      - Firewall blocking HTTPS to Google APIs');
  console.error('      - Proxy configuration needed');
  process.exit(1);
}

// Success!
console.log('\n' + '═'.repeat(50));
console.log('✅ ALL TESTS PASSED!');
console.log('═'.repeat(50));
console.log('\nYour Firestore connection is working correctly.');
console.log('You can now run: node seed-nodue-database.js');
console.log();

await admin.app().delete();
process.exit(0);
