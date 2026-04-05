/**
 * Backend Admin Account Creation Script
 * Uses Firebase Admin SDK to bypass permission restrictions
 * 
 * Usage: node create-admin-backend.js
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

async function createAdmin() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('   🔐 Admin Account Creation (Backend) - BNM Institute');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  try {
    // Get admin details from user
    const adminId = await question('Enter Admin ID (e.g., ADMIN001): ');
    const name = await question('Enter Admin Name: ');
    const email = await question('Enter Admin Email: ');
    const password = await question('Enter Admin Password (min 8 chars): ');
    const departmentId = await question('Enter Department ID (or "ALL" for super admin): ');
    
    if (!adminId || !name || !email || !password) {
      throw new Error('All fields are required');
    }
    
    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }
    
    const isSuperAdmin = departmentId.toUpperCase() === 'ALL';
    
    console.log('\n🔄 Creating Firebase Auth account...');
    
    // Create Firebase Auth user
    const userRecord = await auth.createUser({
      email: email,
      password: password,
      displayName: name,
    });
    
    const uid = userRecord.uid;
    console.log(`✓ Auth account created with UID: ${uid}`);
    
    console.log('\n🔄 Creating Firestore admin profile...');
    
    // Create admin document
    await db.collection('admins').doc(adminId).set({
      adminId: adminId,
      name: name,
      email: email,
      departmentId: isSuperAdmin ? 'ALL' : departmentId,
      role: isSuperAdmin ? 'super_admin' : 'department_admin',
      uid: uid,
      createdBy: uid,
      createdAt: admin.firestore.Timestamp.now(),
      canManageAccounts: true,
      canGenerateHallTickets: true,
      canViewReports: true,
    });
    
    console.log('✓ Firestore admin profile created');
    
    // Create users document for role mapping
    console.log('\n🔄 Creating users role mapping...');
    await db.collection('users').doc(uid).set({
      uid: uid,
      role: isSuperAdmin ? 'admin' : 'department_admin',
      profileId: adminId,
      email: email,
      createdAt: admin.firestore.Timestamp.now(),
    });
    
    console.log('✓ Users role mapping created');
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('   ✅ Admin Account Successfully Created!');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('\n📋 Admin Login Credentials:');
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
    console.log(`   Admin ID: ${adminId}`);
    console.log(`   Role: ${isSuperAdmin ? 'Super Admin' : 'Department Admin'}`);
    console.log(`\n🔑 Firebase UID: ${uid}\n`);
    
    rl.close();
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Error creating admin account:', error.message);
    rl.close();
    process.exit(1);
  }
}

createAdmin();
