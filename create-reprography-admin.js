/**
 * Reprography Admin Account Creation Script
 * Uses Firebase Admin SDK to create reprography admin accounts
 * 
 * Usage: node create-reprography-admin.js
 */

import admin from 'firebase-admin';
import fs from 'fs';
import * as readline from 'readline';

const serviceAccount = JSON.parse(
  fs.readFileSync('./backend/uni-research-portal-firebase-adminsdk-fbsvc-06a58aaf08.json', 'utf8')
);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
const auth = admin.auth();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function createReprographyAdmin() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('   📠 Reprography Admin Account Creation - BNM Institute');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  try {
    // Get admin details from user
    const profileId = await question('Enter Profile ID (e.g., REPRO001): ');
    const name = await question('Enter Reprography Admin Name: ');
    const email = await question('Enter Email: ');
    const password = await question('Enter Password (min 8 chars): ');
    const phone = await question('Enter Phone Number (optional): ');
    const location = await question('Enter Reprography Location/Name (e.g., Main Reprography): ');
    
    if (!profileId || !name || !email || !password) {
      throw new Error('Profile ID, Name, Email, and Password are required');
    }
    
    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }
    
    console.log('\n🔄 Creating Firebase Auth account...');
    
    // Create Firebase Auth user
    const userRecord = await auth.createUser({
      email: email,
      password: password,
      displayName: name,
    });
    
    const uid = userRecord.uid;
    console.log(`✓ Auth account created with UID: ${uid}`);
    
    console.log('\n🔄 Creating reprography admin profile...');
    
    // Create reprography_admins document
    await db.collection('reprography_admins').doc(profileId).set({
      profileId: profileId,
      name: name,
      email: email,
      phone: phone || '',
      location: location || 'Main Reprography',
      uid: uid,
      createdBy: uid,
      createdAt: admin.firestore.Timestamp.now(),
      canManagePrintRequests: true,
      canViewStatistics: true,
      status: 'active',
    });
    
    console.log('✓ Reprography admin profile created');
    
    // Create users document for role mapping
    console.log('\n🔄 Creating users role mapping...');
    await db.collection('users').doc(uid).set({
      uid: uid,
      role: 'reprography_admin',
      profileId: profileId,
      email: email,
      createdAt: admin.firestore.Timestamp.now(),
    });
    
    console.log('✓ Users role mapping created');
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('   ✅ Reprography Admin Account Successfully Created!');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('\n📋 Reprography Admin Login Credentials:');
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
    console.log(`   Profile ID: ${profileId}`);
    console.log(`   Role: Reprography Admin`);
    console.log(`   Location: ${location}`);
    console.log(`\n🔑 Firebase UID: ${uid}`);
    console.log(`\n📍 Access the Reprography Dashboard at: /reprography-dashboard\n`);
    
    rl.close();
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Error creating reprography admin account:', error.message);
    rl.close();
    process.exit(1);
  }
}

createReprographyAdmin();
