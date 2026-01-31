/**
 * One-Time Admin Account Setup Script
 * 
 * Creates the first super admin account for the system.
 * Run this ONCE after Firebase setup to create initial admin.
 * 
 * Usage: node create-admin.js
 */

import { config } from 'dotenv';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import * as readline from 'readline';

// Load environment variables from .env file
config();

// Firebase configuration from environment
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

// Validate configuration
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error('❌ Firebase configuration is missing!');
  console.error('Please ensure your .env file exists with Firebase credentials.');
  process.exit(1);
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function createAdmin() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('   🔐 Admin Account Creation - BNM Institute of Technology');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  try {
    // Get admin details from user
    const adminId = await question('Enter Admin ID (e.g., ADMIN001): ');
    const name = await question('Enter Admin Name: ');
    const email = await question('Enter Admin Email: ');
    const password = await question('Enter Admin Password (min 8 chars): ');
    const departmentId = await question('Enter Department ID (or "ALL" for all departments): ');
    
    if (!adminId || !name || !email || !password) {
      throw new Error('All fields are required');
    }
    
    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }
    
    console.log('\n🔄 Creating Firebase Auth account...');
    
    // Create Firebase Auth user
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;
    
    console.log(`✓ Auth account created with UID: ${uid}`);
    console.log('\n🔄 Creating Firestore admin profile...');
    
    // Create Firestore admin document
    await setDoc(doc(db, 'admins', adminId), {
      adminId: adminId,
      name: name,
      email: email,
      departmentId: departmentId,
      role: 'super_admin',
      uid: uid,
      createdAt: new Date(),
      canManageAccounts: true,
      canGenerateHallTickets: true,
      canViewReports: true,
    });
    
    console.log('✓ Firestore admin profile created');
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('   ✅ Admin Account Successfully Created!');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('\n📋 Admin Login Credentials:');
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
    console.log(`   Admin ID: ${adminId}`);
    console.log('\n⚠️  IMPORTANT: Save these credentials securely!');
    console.log('   You can now log in to the admin dashboard.\n');
    
  } catch (error) {
    console.error('\n❌ Error creating admin account:', error.message);
    
    if (error.code === 'auth/email-already-in-use') {
      console.error('   This email is already registered. Use a different email.');
    } else if (error.code === 'auth/weak-password') {
      console.error('   Password is too weak. Use a stronger password.');
    } else if (error.code === 'auth/invalid-email') {
      console.error('   Invalid email format. Use a valid email address.');
    }
  } finally {
    rl.close();
    process.exit(0);
  }
}

// Run admin creation
createAdmin();
