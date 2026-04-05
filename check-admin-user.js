import admin from 'firebase-admin';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./backend/uni-research-portal-firebase-adminsdk-fbsvc-06a58aaf08.json', 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkAdminUser() {
  // Find the admin ADMIN002's auth UID from createdBy
  const admin002 = await db.collection('admins').doc('ADMIN002').get();
  const authUid = admin002.data().createdBy;
  
  console.log('Admin ADMIN002:');
  console.log('  Auth UID:', authUid);
  console.log('  Role:', admin002.data().role);
  console.log('  Email:', admin002.data().email);
  
  // Check if users document exists for this UID
  const userDoc = await db.collection('users').doc(authUid).get();
  if (userDoc.data()) {
    console.log('\nUsers document EXISTS:');
    console.log('  Role:', userDoc.data().role);
    console.log('  ProfileId:', userDoc.data().profileId);
  } else {
    console.log('\n❌ Users document MISSING for auth UID:', authUid);
    console.log('   Need to create users/' + authUid + ' with role: department_admin, profileId: ADMIN002');
  }
  
  process.exit(0);
}

checkAdminUser().catch(console.error);
